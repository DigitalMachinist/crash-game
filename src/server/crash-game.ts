/**
 * `CrashGame` Durable Object — the authoritative game server.
 *
 * Extends `partyserver.Server` to handle WebSocket connections, the game alarm
 * loop, and HTTP debug requests. Delegates all pure state transitions to
 * `game-state.ts` and uses `hash-chain.ts`, `drand.ts`, and `crash-math.ts`
 * for provably fair seed and crash point computation.
 *
 * @see docs/project-architecture.md §1.4
 * @see docs/game-state-machine.md
 */
import { type Connection, type ConnectionContext, Server } from 'partyserver';
import {
  CHAIN_LENGTH,
  CHAIN_ROTATION_THRESHOLD,
  COUNTDOWN_TICK_MS,
  CRASHED_DISPLAY_MS,
  MAX_PENDING_PAYOUTS,
  TICK_INTERVAL_MS,
  WAITING_DURATION_MS,
} from '../config';
import type { ServerMessage } from '../types';
import { deriveCrashPoint } from './crash-math';
import { computeEffectiveSeedFromBeacon, fetchDrandBeacon, getCurrentDrandRound } from './drand';
import {
  buildStateSnapshot,
  createInitialState,
  type GameState,
  handleCashout,
  handleCountdownTick,
  handleCrash,
  handleJoin,
  handleStartingComplete,
  handleTick,
  transitionToWaiting,
} from './game-state';
import {
  computeTerminalHash,
  generateRootSeed,
  getChainSeedForGame,
  sha256Hex,
} from './hash-chain';
import { isValidClientMessage, isValidStoredGameData } from './validation';

interface Env {
  CRASH_DEBUG?: string;
}

interface PendingPayout {
  roundId: number;
  wager: number;
  payout: number;
  cashoutMultiplier: number;
  crashPoint: number;
}

export class CrashGame extends Server<Env> {
  private gameState!: GameState;
  private rootSeed!: string;
  private gameNumber!: number;
  private pendingPayouts: Map<string, PendingPayout> = new Map();

  // partyserver calls this when the DO is initialized (replaces constructor)
  override async onStart(): Promise<void> {
    try {
      // Load persisted state, validating structure before use [High-3]
      const stored = await this.ctx.storage.get('gameData');

      if (stored && isValidStoredGameData(stored)) {
        this.rootSeed = stored.rootSeed;
        this.gameNumber = stored.gameNumber;
        this.pendingPayouts = new Map(stored.pendingPayouts ?? []);
        this.gameState = createInitialState(stored.chainCommitment, stored.gameNumber + 1);
        this.gameState = { ...this.gameState, history: stored.history ?? [] };
      } else {
        if (stored) {
          console.warn('CrashGame: stored state failed validation, reinitializing from scratch');
        }
        // First run or corrupted state — generate hash chain
        this.rootSeed = await generateRootSeed();
        this.gameNumber = 0;
        const terminalHash = await computeTerminalHash(this.rootSeed);
        this.gameState = createInitialState(terminalHash);
        await this.persistState();
      }

      // Start the alarm loop if not already running, or if the stored alarm is stale (past timestamp from a previous wrangler dev run)
      const alarm = await this.ctx.storage.getAlarm();
      const now = Date.now();
      if (alarm === null || alarm <= now) {
        await this.ctx.storage.setAlarm(now + COUNTDOWN_TICK_MS);
      }
    } catch (error) {
      console.error('CrashGame initialization failed:', error);
      // Attempt to initialize fresh state so the game loop can continue [Backend-3]
      try {
        this.rootSeed = await generateRootSeed();
        this.gameNumber = 0;
        const terminalHash = await computeTerminalHash(this.rootSeed);
        this.gameState = createInitialState(terminalHash);
        await this.persistState();
        const now = Date.now();
        await this.ctx.storage.setAlarm(now + COUNTDOWN_TICK_MS);
      } catch (fallbackError) {
        // If even fresh initialization fails, log and let the DO restart naturally
        console.error('CrashGame fallback initialization also failed:', fallbackError);
      }
    }
  }

  override async onConnect(conn: Connection, _ctx: ConnectionContext): Promise<void> {
    // Send current game state snapshot to the newly connected client
    const snapshot = buildStateSnapshot(this.gameState);
    const stateMsg: ServerMessage = { type: 'state', ...snapshot, history: this.gameState.history };
    conn.send(JSON.stringify(stateMsg));
  }

  override async onMessage(conn: Connection, message: string): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(message);
    } catch {
      conn.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' } satisfies ServerMessage));
      return;
    }

    // Runtime validation — reject malformed messages before processing [High-1][High-4]
    if (!isValidClientMessage(parsed)) {
      conn.send(
        JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
        } satisfies ServerMessage),
      );
      return;
    }

    const msg = parsed;

    if (msg.type === 'join') {
      // Check for pending payout before processing join
      const pending = this.pendingPayouts.get(msg.playerId);
      if (pending) {
        this.pendingPayouts.delete(msg.playerId);
        conn.send(
          JSON.stringify({
            type: 'pendingPayout',
            ...pending,
          } satisfies ServerMessage),
        );
        await this.persistState();
      }

      const result = handleJoin(
        this.gameState,
        {
          playerId: msg.playerId,
          ...(msg.name !== undefined ? { name: msg.name } : {}),
          wager: msg.wager,
          autoCashout: msg.autoCashout ?? null,
        },
        conn.id,
      );
      this.gameState = result.state;

      // Persist player join so DO eviction does not lose the wager [Backend-1]
      const joinSucceeded = result.messages.some(
        (m) => m.broadcast && m.message.type === 'playerJoined',
      );
      if (joinSucceeded) {
        await this.persistState();
      }

      for (const outbound of result.messages) {
        if (outbound.broadcast) {
          this.broadcast(JSON.stringify(outbound.message));
        } else {
          this.sendToTarget(outbound.targetPlayerId, conn).send(JSON.stringify(outbound.message));
        }
      }
    } else if (msg.type === 'cashout') {
      // Find the player by connection ID
      const player = Array.from(this.gameState.players.values()).find((p) => p.id === conn.id);
      if (!player) {
        conn.send(
          JSON.stringify({
            type: 'error',
            message: 'Not in current round',
          } satisfies ServerMessage),
        );
        return;
      }

      const result = handleCashout(this.gameState, player.playerId, Date.now());
      this.gameState = result.state;

      // Persist cashout so DO eviction does not lose the payout record [Backend-2]
      const cashoutSucceeded = result.messages.some(
        (m) => m.broadcast && m.message.type === 'playerCashedOut',
      );
      if (cashoutSucceeded) {
        await this.persistState();
      }

      for (const outbound of result.messages) {
        if (outbound.broadcast) {
          this.broadcast(JSON.stringify(outbound.message));
        } else {
          this.sendToTarget(outbound.targetPlayerId, conn).send(JSON.stringify(outbound.message));
        }
      }
    }
  }

  /**
   * Intentional no-op. Disconnected players' entries persist in `gameState.players`
   * so that server-side auto-cashout processing continues to fire on every alarm
   * tick. If an auto-cashout fires for a disconnected player, the payout is stored
   * in `pendingPayouts` (keyed by `playerId`) and delivered on their next `join`.
   *
   * @see docs/game-state-machine.md §3.5
   */
  override onClose(_conn: Connection, _code: number, _reason: string, _wasClean: boolean): void {
    // If player had an active bet (no auto-cashout), their bet is lost on disconnect.
    // Auto-cashout stays active on server — the player entry persists in gameState.players
    // so auto-cashout processing in onAlarm continues to work.
    // No-op here intentionally.
  }

  /**
   * Game loop driver. Dispatches to the appropriate phase handler:
   * - WAITING → `handleCountdownTick`; triggers `startRound` when countdown = 0.
   * - STARTING → safety reschedule (alarm fired while `blockConcurrencyWhile` in progress).
   * - RUNNING → `handleTick`; triggers `crashRound` when multiplier ≥ crashPoint.
   * - CRASHED → `nextRound` after display timer.
   *
   * Wrapped in try/catch so that any unexpected error is logged and the game loop
   * is always rescheduled via the finally block. [Backend-4]
   *
   * @see docs/game-state-machine.md §3.1
   */
  override async onAlarm(): Promise<void> {
    const now = Date.now();
    // Track whether we are in the CRASHED→WAITING transition so the finally
    // block can skip rescheduling if nextRound() already scheduled the alarm.
    let alarmScheduled = false;

    try {
      if (this.gameState.phase === 'WAITING') {
        const result = handleCountdownTick(this.gameState, now);
        this.gameState = result.state;

        for (const outbound of result.messages) {
          if (outbound.broadcast) {
            this.broadcast(JSON.stringify(outbound.message));
          }
        }

        if (result.shouldStartRound) {
          // Transition to STARTING — use blockConcurrencyWhile for isolation
          await this.ctx.blockConcurrencyWhile(async () => {
            await this.startRound();
          });
          alarmScheduled = true; // startRound() schedules its own alarm
        } else {
          await this.ctx.storage.setAlarm(now + COUNTDOWN_TICK_MS);
          alarmScheduled = true;
        }
      } else if (this.gameState.phase === 'RUNNING') {
        const result = handleTick(this.gameState, now);
        this.gameState = result.state;

        for (const outbound of result.messages) {
          if (outbound.broadcast) {
            this.broadcast(JSON.stringify(outbound.message));
          }
        }

        if (result.shouldCrash) {
          await this.crashRound(now);
          alarmScheduled = true; // crashRound() schedules its own alarm
        } else {
          await this.ctx.storage.setAlarm(now + TICK_INTERVAL_MS);
          alarmScheduled = true;
        }
      } else if (this.gameState.phase === 'CRASHED') {
        // Display timer expired — transition to WAITING
        await this.nextRound();
        alarmScheduled = true; // nextRound() schedules its own alarm
      } else if (this.gameState.phase === 'STARTING') {
        // Alarm fired while still in STARTING (drand fetch in progress or failed).
        // Reschedule and wait for blockConcurrencyWhile to complete or retry.
        await this.ctx.storage.setAlarm(now + COUNTDOWN_TICK_MS);
        alarmScheduled = true;
      } else {
        // Exhaustive check — TypeScript will error here if a new Phase is added [High-13]
        const _exhaustive: never = this.gameState.phase;
        throw new Error(`Unhandled phase: ${_exhaustive}`);
      }
    } catch (error) {
      console.error('CrashGame alarm error:', error);
      // Broadcast error to all connected clients so they can display a retry indicator
      this.broadcast(
        JSON.stringify({
          type: 'error',
          message: 'Server error \u2014 retrying',
        } satisfies ServerMessage),
      );
    } finally {
      // Always reschedule the alarm unless the successful handler already did so,
      // ensuring the game loop never freezes after an unexpected error. [Backend-4]
      if (!alarmScheduled) {
        try {
          await this.ctx.storage.setAlarm(Date.now() + COUNTDOWN_TICK_MS);
        } catch (rescheduleError) {
          console.error('CrashGame: failed to reschedule alarm after error:', rescheduleError);
        }
      }
    }
  }

  /**
   * Transitions from STARTING to RUNNING. Runs inside `blockConcurrencyWhile`
   * so no WebSocket messages can interleave during the drand fetch and crash
   * point computation. On `DrandFetchError`, rewinds `gameNumber` and resets
   * to WAITING (void round).
   *
   * @see docs/provably-fair.md §2.4
   * @see docs/game-state-machine.md §3.2 (void rounds)
   */
  private async startRound(): Promise<void> {
    // STARTING phase: fetch drand beacon and compute crash point.
    // Runs inside blockConcurrencyWhile so no messages can interleave.
    this.gameNumber += 1;

    // Rotate chain if we are within CHAIN_ROTATION_THRESHOLD games of exhausting it
    if (this.gameNumber > CHAIN_LENGTH - CHAIN_ROTATION_THRESHOLD) {
      this.rootSeed = await generateRootSeed();
      this.gameNumber = 1;
    }

    const chainSeed = await getChainSeedForGame(this.rootSeed, this.gameNumber);
    const nextChainCommitment = await sha256Hex(chainSeed);

    let beacon: import('./drand').DrandBeacon;
    let drandRound: number;
    let drandRandomness: string;

    try {
      const round = getCurrentDrandRound();
      beacon = await fetchDrandBeacon(round);
      drandRound = beacon.round;
      drandRandomness = beacon.randomness;
    } catch {
      // Void round — drand fetch failed; rewind game number and return to WAITING
      this.gameNumber -= 1;
      this.gameState = { ...this.gameState, phase: 'WAITING', countdown: WAITING_DURATION_MS };
      await this.persistState();
      await this.ctx.storage.setAlarm(Date.now() + COUNTDOWN_TICK_MS);
      return;
    }

    const effectiveSeed = await computeEffectiveSeedFromBeacon(chainSeed, beacon);
    const crashPoint = deriveCrashPoint(effectiveSeed);
    const now = Date.now();

    const result = handleStartingComplete(
      this.gameState,
      crashPoint,
      chainSeed,
      drandRound,
      drandRandomness,
      nextChainCommitment,
      now,
    );
    this.gameState = result.state;

    // Broadcast full state update to all connections so clients know the round started
    const snapshot = buildStateSnapshot(this.gameState);
    const stateMsg: ServerMessage = { type: 'state', ...snapshot, history: this.gameState.history };
    this.broadcast(JSON.stringify(stateMsg));

    await this.persistState();
    await this.ctx.storage.setAlarm(now + TICK_INTERVAL_MS);
  }

  /**
   * Transitions from RUNNING to CRASHED. Broadcasts the `crashed` message with
   * provably-fair ingredients, then stores pending payouts for any auto-cashed-out
   * players who are no longer connected. A `Map<connectionId, Connection>` is
   * built once from `this.getConnections()` so disconnection checks are O(1) per
   * player rather than O(n) — keeping the overall loop O(n) instead of O(n²).
   *
   * @see docs/game-state-machine.md §3.8 (balance management)
   * @see docs/game-state-machine.md §3.5 (disconnect semantics)
   */
  private async crashRound(now: number): Promise<void> {
    if (
      !this.gameState.chainSeed ||
      this.gameState.drandRound === null ||
      !this.gameState.drandRandomness
    ) {
      return;
    }

    const result = handleCrash(
      this.gameState,
      this.gameState.chainSeed,
      this.gameState.drandRound,
      this.gameState.drandRandomness,
      now,
    );
    this.gameState = result.state;

    // Build a connection lookup map once (O(n)) to avoid O(n²) getConnections().some() per player
    const connectionMap = new Map<string, Connection>();
    for (const conn of this.getConnections()) {
      connectionMap.set(conn.id, conn);
    }

    // Store pending payouts for auto-cashed-out players who are disconnected
    for (const [, player] of this.gameState.players) {
      if (player.cashedOut && player.payout !== null && player.cashoutMultiplier !== null) {
        // O(1) lookup instead of O(n) scan per player
        const isConnected = connectionMap.has(player.id);
        if (!isConnected) {
          // Evict oldest entry if the map is at capacity [High-10]
          if (this.pendingPayouts.size >= MAX_PENDING_PAYOUTS) {
            const oldestPlayerId = this.pendingPayouts.keys().next().value as string;
            this.pendingPayouts.delete(oldestPlayerId);
            console.warn(`Evicting stale pending payout for ${oldestPlayerId}`);
          }
          this.pendingPayouts.set(player.playerId, {
            roundId: this.gameState.roundId,
            wager: player.wager,
            payout: player.payout,
            cashoutMultiplier: player.cashoutMultiplier,
            crashPoint: this.gameState.crashPoint ?? 1,
          });
        }
      }
    }

    for (const outbound of result.messages) {
      if (outbound.broadcast) {
        this.broadcast(JSON.stringify(outbound.message));
      }
    }

    await this.persistState();
    await this.ctx.storage.setAlarm(now + CRASHED_DISPLAY_MS);
  }

  private async nextRound(): Promise<void> {
    const result = transitionToWaiting(this.gameState, this.gameState.chainCommitment, Date.now());
    this.gameState = result.state;

    for (const outbound of result.messages) {
      if (outbound.broadcast) {
        this.broadcast(JSON.stringify(outbound.message));
      }
    }

    await this.persistState();
    await this.ctx.storage.setAlarm(Date.now() + COUNTDOWN_TICK_MS);
  }

  /**
   * Persists all durable game state under the single key `'gameData'`.
   * Called after every crash, void round, and pending payout consumption.
   * Not called on every tick to avoid unnecessary storage writes.
   *
   * @see docs/game-state-machine.md §3.9
   */
  /**
   * Resolves a targeted outbound message to the correct connection. [High-15]
   * Looks up the target player's current connection by playerId; falls back to
   * `fallback` (the sender) if the player is not found or disconnected.
   */
  private sendToTarget(targetPlayerId: string, fallback: Connection): Connection {
    const player = this.gameState.players.get(targetPlayerId);
    if (player) {
      const target = Array.from(this.getConnections()).find((c) => c.id === player.id);
      if (target) return target;
    }
    return fallback;
  }

  private async persistState(): Promise<void> {
    await this.ctx.storage.put('gameData', {
      rootSeed: this.rootSeed,
      gameNumber: this.gameNumber,
      chainCommitment: this.gameState.chainCommitment,
      history: this.gameState.history,
      pendingPayouts: Array.from(this.pendingPayouts.entries()),
    });
  }

  /**
   * Debug HTTP endpoint. Returns a JSON snapshot of non-sensitive game state.
   * Gated by `CRASH_DEBUG === 'true'` env var — disabled in production.
   * `crashPoint`, `chainSeed`, and `drandRandomness` are intentionally omitted
   * from the response to prevent leaking provably-fair ingredients.
   *
   * @see docs/project-architecture.md §1.7
   */
  // Debug HTTP endpoint (only when CRASH_DEBUG=true)
  override async onRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (url.searchParams.get('debug') === 'true' && this.env.CRASH_DEBUG === 'true') {
      return Response.json({
        phase: this.gameState.phase,
        roundId: this.gameState.roundId,
        countdown: this.gameState.countdown,
        playerCount: this.gameState.players.size,
        gameNumber: this.gameNumber,
        // SECURITY: crashPoint, chainSeed, and drandRandomness are intentionally omitted
      });
    }

    return new Response('Not found', { status: 404 });
  }
}
