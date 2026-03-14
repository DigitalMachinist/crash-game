/**
 * Pure (no I/O) game state transition functions for the Crash game loop.
 *
 * Each function accepts the current `GameState` and returns `{ state, messages }`.
 * `CrashGame` in `crash-game.ts` calls these functions and then broadcasts
 * the returned `OutboundMessage[]`.
 *
 * @see docs/game-state-machine.md
 */

import {
  COUNTDOWN_TICK_MS,
  HISTORY_LENGTH,
  MAX_PLAYER_ID_LENGTH,
  MAX_PLAYERS_PER_ROUND,
  MAX_WAGER,
  MIN_WAGER,
  WAITING_DURATION_MS,
} from '../config';
import type { HistoryEntry, Phase, Player, PlayerSnapshot, ServerMessage } from '../types';
import { computeCrashTimeMs, multiplierAtTime } from './crash-math';

const SERVER_VERSION = '1.0.0';

export interface GameState {
  phase: Phase;
  roundId: number;
  countdown: number;
  roundStartTime: number | null;
  crashPoint: number | null;
  crashTimeMs: number | null;
  players: Map<string, Player>; // keyed by playerId
  chainSeed: string | null;
  drandRound: number | null;
  drandRandomness: string | null;
  chainCommitment: string;
  history: HistoryEntry[];
}

export type OutboundMessage =
  | { broadcast: true; message: ServerMessage }
  | { broadcast: false; targetPlayerId: string; message: ServerMessage };

export function createInitialState(chainCommitment: string, roundId = 1): GameState {
  return {
    phase: 'WAITING',
    roundId,
    countdown: WAITING_DURATION_MS,
    roundStartTime: null,
    crashPoint: null,
    crashTimeMs: null,
    players: new Map(),
    chainSeed: null,
    drandRound: null,
    drandRandomness: null,
    chainCommitment,
    history: [],
  };
}

function playerToSnapshot(p: Player): PlayerSnapshot {
  return {
    id: p.id,
    playerId: p.playerId,
    name: p.name,
    wager: p.wager,
    cashedOut: p.cashedOut,
    cashoutMultiplier: p.cashoutMultiplier,
    payout: p.payout,
    autoCashout: p.autoCashout,
  };
}

function getPlayerSnapshots(state: GameState): PlayerSnapshot[] {
  return Array.from(state.players.values()).map(playerToSnapshot);
}

/**
 * Processes a player's bet. Only valid during WAITING phase.
 * Returns a `playerJoined` broadcast on success, or an `error` to the player.
 *
 * Validation rules (returns error message if violated):
 * - `playerId` must be a non-empty string of at most `MAX_PLAYER_ID_LENGTH` (256) characters.
 * - `wager` must be a finite positive number.
 * - `autoCashout`, if non-null, must be a finite number strictly greater than 1.0.
 * - Player must not already be in the current round.
 *
 * @see docs/game-state-machine.md §3.4
 */
export function handleJoin(
  state: GameState,
  msg: { playerId: string; name?: string; wager: number; autoCashout: number | null },
  connectionId: string,
): { state: GameState; messages: OutboundMessage[] } {
  // Handle existing player first (any phase) — must precede phase check so reconnects during
  // RUNNING/STARTING are handled silently rather than returning a spurious phase error. [Phase 4.6]
  if (state.players.has(msg.playerId)) {
    const existing = state.players.get(msg.playerId)!;
    if (existing.wager !== msg.wager) {
      return {
        state,
        messages: [
          {
            broadcast: false,
            targetPlayerId: msg.playerId,
            message: { type: 'error', message: 'Already joined with different wager' },
          },
        ],
      };
    }
    if (existing.id === connectionId) {
      return { state, messages: [] }; // Same connection — no-op
    }
    const updatedPlayer = { ...existing, id: connectionId };
    const updatedPlayers = new Map(state.players);
    updatedPlayers.set(msg.playerId, updatedPlayer);
    const updatedState = { ...state, players: updatedPlayers };
    if (state.phase !== 'WAITING') {
      // Reconnect during RUNNING/STARTING: update connection ID silently.
      // All clients already know this player is in the round; re-broadcasting playerJoined
      // would cause the reconnecting client to double-deduct their balance.
      return { state: updatedState, messages: [] };
    }
    return {
      state: updatedState,
      messages: [
        {
          broadcast: true,
          message: {
            type: 'playerJoined',
            id: connectionId,
            playerId: msg.playerId,
            name: existing.name,
            wager: existing.wager,
            autoCashout: existing.autoCashout,
          },
        },
      ],
    };
  }

  if (state.phase !== 'WAITING') {
    return {
      state,
      messages: [
        {
          broadcast: false,
          targetPlayerId: msg.playerId,
          message: { type: 'error', message: `Cannot join during ${state.phase} phase` },
        },
      ],
    };
  }

  if (!msg.playerId || msg.playerId.length > MAX_PLAYER_ID_LENGTH) {
    return {
      state,
      messages: [
        {
          broadcast: false,
          targetPlayerId: msg.playerId || 'unknown',
          message: { type: 'error', message: 'Invalid playerId' },
        },
      ],
    };
  }

  if (state.players.size >= MAX_PLAYERS_PER_ROUND) {
    return {
      state,
      messages: [
        {
          broadcast: false,
          targetPlayerId: msg.playerId,
          message: { type: 'error', message: 'Room full' },
        },
      ],
    };
  }

  if (!Number.isFinite(msg.wager) || msg.wager <= 0) {
    return {
      state,
      messages: [
        {
          broadcast: false,
          targetPlayerId: msg.playerId,
          message: { type: 'error', message: 'Wager must be a positive number' },
        },
      ],
    };
  }

  if (msg.wager < MIN_WAGER) {
    return {
      state,
      messages: [
        {
          broadcast: false,
          targetPlayerId: msg.playerId,
          message: { type: 'error', message: `Minimum wager is $${MIN_WAGER.toFixed(2)}` },
        },
      ],
    };
  }

  if (msg.wager > MAX_WAGER) {
    return {
      state,
      messages: [
        {
          broadcast: false,
          targetPlayerId: msg.playerId,
          message: { type: 'error', message: `Maximum wager is $${MAX_WAGER.toFixed(2)}` },
        },
      ],
    };
  }

  if (msg.autoCashout != null && (!Number.isFinite(msg.autoCashout) || msg.autoCashout <= 1.0)) {
    return {
      state,
      messages: [
        {
          broadcast: false,
          targetPlayerId: msg.playerId,
          message: { type: 'error', message: 'autoCashout must be greater than 1.0' },
        },
      ],
    };
  }

  const name = msg.name?.trim() || msg.playerId.slice(0, 8);
  const player: Player = {
    id: connectionId,
    playerId: msg.playerId,
    name,
    wager: msg.wager,
    autoCashout: msg.autoCashout,
    cashedOut: false,
    cashoutMultiplier: null,
    payout: null,
  };

  const newPlayers = new Map(state.players);
  newPlayers.set(msg.playerId, player);

  return {
    state: { ...state, players: newPlayers },
    messages: [
      {
        broadcast: true,
        message: {
          type: 'playerJoined',
          id: connectionId,
          playerId: msg.playerId,
          name,
          wager: msg.wager,
          autoCashout: msg.autoCashout,
        },
      },
    ],
  };
}

/**
 * Processes a manual cashout request. Only valid during RUNNING phase.
 * Payout is `floor(wager × currentMultiplier × 100) / 100`.
 *
 * @see docs/game-state-machine.md §3.4
 */
export function handleCashout(
  state: GameState,
  playerId: string,
  nowMs: number,
): { state: GameState; messages: OutboundMessage[] } {
  if (state.phase !== 'RUNNING') {
    return {
      state,
      messages: [
        {
          broadcast: false,
          targetPlayerId: playerId,
          message: { type: 'error', message: `Cannot cashout during ${state.phase} phase` },
        },
      ],
    };
  }

  const player = state.players.get(playerId);
  if (!player) {
    return {
      state,
      messages: [
        {
          broadcast: false,
          targetPlayerId: playerId,
          message: { type: 'error', message: 'Not in current round' },
        },
      ],
    };
  }

  if (player.cashedOut) {
    return {
      state,
      messages: [
        {
          broadcast: false,
          targetPlayerId: playerId,
          message: { type: 'error', message: 'Already cashed out' },
        },
      ],
    };
  }

  const elapsed = nowMs - (state.roundStartTime ?? nowMs);
  const multiplier = multiplierAtTime(elapsed);

  // Must be strictly less than crash point
  if (state.crashPoint !== null && multiplier >= state.crashPoint) {
    return {
      state,
      messages: [
        {
          broadcast: false,
          targetPlayerId: playerId,
          message: { type: 'error', message: 'Round has already crashed' },
        },
      ],
    };
  }

  const payout = Math.floor(player.wager * multiplier * 100) / 100;
  const updatedPlayer: Player = {
    ...player,
    cashedOut: true,
    cashoutMultiplier: multiplier,
    payout,
  };
  const newPlayers = new Map(state.players);
  newPlayers.set(playerId, updatedPlayer);

  return {
    state: { ...state, players: newPlayers },
    messages: [
      {
        broadcast: true,
        message: {
          type: 'playerCashedOut',
          id: player.id,
          playerId,
          multiplier,
          payout,
        },
      },
    ],
  };
}

/**
 * Processes one alarm tick during RUNNING phase.
 * Evaluates auto-cashouts at the player's exact target multiplier (not the
 * current tick multiplier, preventing overshoot). Returns `shouldCrash = true`
 * when the multiplier has reached or exceeded `crashPoint`.
 *
 * @see docs/game-state-machine.md §3.7 (auto-cashout)
 * @see docs/game-state-machine.md §3.6 (multiplier curve)
 */
export function handleTick(
  state: GameState,
  nowMs: number,
): { state: GameState; messages: OutboundMessage[]; shouldCrash: boolean } {
  if (state.phase !== 'RUNNING' || state.roundStartTime === null || state.crashPoint === null) {
    return { state, messages: [], shouldCrash: false };
  }

  const elapsed = nowMs - state.roundStartTime;
  const currentMultiplier = multiplierAtTime(elapsed);
  const messages: OutboundMessage[] = [];
  const newPlayers = new Map(state.players);

  for (const [pid, player] of newPlayers) {
    if (player.cashedOut || player.autoCashout === null) continue;
    if (currentMultiplier >= player.autoCashout) {
      // Use player's exact auto-cashout target, not current tick multiplier
      const autoCashoutMultiplier = player.autoCashout;
      const payout = Math.floor(player.wager * autoCashoutMultiplier * 100) / 100;
      newPlayers.set(pid, {
        ...player,
        cashedOut: true,
        cashoutMultiplier: autoCashoutMultiplier,
        payout,
      });
      messages.push({
        broadcast: true,
        message: {
          type: 'playerCashedOut',
          id: player.id,
          playerId: pid,
          multiplier: autoCashoutMultiplier,
          payout,
        },
      });
    }
  }

  const shouldCrash = currentMultiplier >= state.crashPoint;

  messages.push({
    broadcast: true,
    message: { type: 'tick', multiplier: currentMultiplier, elapsed },
  });

  return {
    state: { ...state, players: newPlayers },
    messages,
    shouldCrash,
  };
}

/**
 * Transitions the game to CRASHED phase. Marks all non-cashed-out players as
 * lost (payout = 0) and broadcasts a `state{phase:'CRASHED'}` message that reveals
 * the provably-fair ingredients (`chainSeed` stored as `roundSeed` in history,
 * `drandRound`, `drandRandomness`).
 *
 * @see docs/game-state-machine.md §3.1 (CRASHED transition)
 */
export function handleCrash(
  state: GameState,
  nowMs: number,
): { state: GameState; messages: OutboundMessage[] } {
  const elapsed = state.roundStartTime !== null ? nowMs - state.roundStartTime : 0;
  const crashPoint = state.crashPoint ?? 1.0;
  // Callers guard that these are non-null before calling handleCrash
  const chainSeed = state.chainSeed!;
  const drandRound = state.drandRound!;
  const drandRandomness = state.drandRandomness!;

  // Mark all non-cashed-out players as lost
  const newPlayers = new Map(state.players);
  for (const [pid, player] of newPlayers) {
    if (!player.cashedOut) {
      newPlayers.set(pid, { ...player, payout: 0 });
    }
  }

  const playerSnapshots = Array.from(newPlayers.values()).map(playerToSnapshot);

  const historyEntry: HistoryEntry = {
    roundId: state.roundId,
    crashPoint,
    roundSeed: chainSeed,
    drandRound,
    drandRandomness,
    chainCommitment: state.chainCommitment,
  };

  const newHistory = [historyEntry, ...state.history].slice(0, HISTORY_LENGTH);

  const newState: GameState = {
    ...state,
    phase: 'CRASHED',
    players: newPlayers,
    history: newHistory,
  };

  return {
    state: newState,
    messages: [
      {
        broadcast: true,
        message: {
          type: 'state',
          phase: 'CRASHED',
          roundId: state.roundId,
          countdown: state.countdown,
          multiplier: 1.0,
          elapsed,
          crashPoint,
          players: playerSnapshots,
          chainCommitment: state.chainCommitment,
          drandRound,
          drandRandomness,
          history: newHistory,
          serverVersion: SERVER_VERSION,
        },
      },
    ],
  };
}

/**
 * Transitions the game from STARTING to RUNNING after a successful drand fetch.
 * Sets `crashPoint`, `chainSeed`, `drandRound`, `drandRandomness`, and updates
 * `chainCommitment` to `SHA-256(chainSeed)` for the next round's commitment.
 * Returns no messages — the state broadcast is sent by `CrashGame.startRound()`.
 *
 * @see docs/provably-fair.md §2.4
 */
export interface RoundIngredients {
  crashPoint: number;
  chainSeed: string;
  drandRound: number;
  drandRandomness: string;
  nextChainCommitment: string;
}

export function handleStartingComplete(
  state: GameState,
  ingredients: RoundIngredients,
  nowMs: number,
): { state: GameState; messages: OutboundMessage[] } {
  const { crashPoint, chainSeed, drandRound, drandRandomness, nextChainCommitment } = ingredients;
  const crashTime = computeCrashTimeMs(crashPoint);

  return {
    state: {
      ...state,
      phase: 'RUNNING',
      crashPoint,
      crashTimeMs: crashTime,
      roundStartTime: nowMs,
      chainSeed,
      drandRound,
      drandRandomness,
      chainCommitment: nextChainCommitment,
    },
    messages: [],
  };
}

/**
 * Decrements the countdown by 1000 ms and broadcasts the updated state.
 * When countdown reaches 0, sets `phase = 'STARTING'` and returns
 * `shouldStartRound = true` so `CrashGame.onAlarm()` triggers `startRound()`.
 *
 * @see docs/game-state-machine.md §3.1 (WAITING phase)
 */
export function handleCountdownTick(state: GameState): {
  state: GameState;
  messages: OutboundMessage[];
  shouldStartRound: boolean;
} {
  if (state.phase !== 'WAITING') {
    return { state, messages: [], shouldStartRound: false };
  }

  const newCountdown = Math.max(0, state.countdown - COUNTDOWN_TICK_MS);
  const shouldStartRound = newCountdown <= 0;

  const newState: GameState = {
    ...state,
    countdown: newCountdown,
    phase: shouldStartRound ? 'STARTING' : 'WAITING',
  };

  return {
    state: newState,
    messages: [
      {
        broadcast: true,
        message: {
          type: 'state',
          phase: newState.phase,
          roundId: newState.roundId,
          countdown: newCountdown,
          multiplier: 1.0,
          elapsed: 0,
          crashPoint: null,
          players: getPlayerSnapshots(newState),
          chainCommitment: newState.chainCommitment,
          drandRound: null,
          drandRandomness: null,
          history: newState.history,
          serverVersion: SERVER_VERSION,
        },
      },
    ],
    shouldStartRound,
  };
}

/**
 * Resets game state for the next round: increments `roundId`, clears players,
 * resets countdown, and broadcasts a WAITING `state` message.
 * Called after the CRASHED display timer expires.
 *
 * @see docs/game-state-machine.md §3.1 (CRASHED → WAITING transition)
 */
export function transitionToWaiting(
  state: GameState,
  nextChainCommitment: string,
): { state: GameState; messages: OutboundMessage[] } {
  const newState: GameState = {
    ...state,
    phase: 'WAITING',
    roundId: state.roundId + 1,
    countdown: WAITING_DURATION_MS,
    roundStartTime: null,
    crashPoint: null,
    crashTimeMs: null,
    players: new Map(),
    chainSeed: null,
    drandRound: null,
    drandRandomness: null,
    chainCommitment: nextChainCommitment,
  };

  return {
    state: newState,
    messages: [
      {
        broadcast: true,
        message: {
          type: 'state',
          phase: 'WAITING',
          roundId: newState.roundId,
          countdown: WAITING_DURATION_MS,
          multiplier: 1.0,
          elapsed: 0,
          crashPoint: null,
          players: [],
          chainCommitment: nextChainCommitment,
          drandRound: null,
          drandRandomness: null,
          history: newState.history,
          serverVersion: SERVER_VERSION,
        },
      },
    ],
  };
}

/**
 * Builds a `GameStateSnapshot` for the `state` message sent to clients.
 * `crashPoint` is always `null` unless `phase === 'CRASHED'` (security: prevents
 * foreknowledge of the crash point during an active round).
 *
 * @see docs/websocket-protocol.md §4.3
 */
export function buildStateSnapshot(
  state: GameState,
  nowMs: number = Date.now(),
): Omit<ServerMessage & { type: 'state' }, 'type'> {
  const elapsed = state.roundStartTime !== null ? nowMs - state.roundStartTime : 0;
  const multiplier =
    state.phase === 'RUNNING' && state.roundStartTime !== null ? multiplierAtTime(elapsed) : 1.0;

  return {
    phase: state.phase,
    roundId: state.roundId,
    countdown: state.countdown,
    multiplier,
    elapsed,
    crashPoint: state.phase === 'CRASHED' ? state.crashPoint : null,
    players: getPlayerSnapshots(state),
    chainCommitment: state.chainCommitment,
    drandRound: state.phase === 'CRASHED' ? state.drandRound : null,
    drandRandomness: state.phase === 'CRASHED' ? state.drandRandomness : null,
    history: state.history,
    serverVersion: SERVER_VERSION,
  };
}
