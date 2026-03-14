import { describe, expect, it } from 'vitest';
import {
  HISTORY_LENGTH,
  MAX_PLAYER_ID_LENGTH,
  MAX_PLAYERS_PER_ROUND,
  MAX_WAGER,
  MIN_WAGER,
  WAITING_DURATION_MS,
} from '../../config';
import {
  buildStateSnapshot,
  createInitialState,
  handleCashout,
  handleCountdownTick,
  handleCrash,
  handleJoin,
  handleStartingComplete,
  handleTick,
  transitionToWaiting,
} from '../game-state';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRunningState(crashPoint = 3.0, nowMs = 1_000_000) {
  let state = createInitialState('commitment123');
  state = handleStartingComplete(
    state,
    {
      crashPoint: crashPoint,
      chainSeed: 'seed1',
      drandRound: 1,
      drandRandomness: 'rand1',
      nextChainCommitment: 'nextcommit',
    },
    nowMs,
  ).state;
  return { state, nowMs };
}

// ─── handleJoin ──────────────────────────────────────────────────────────────

describe('handleJoin', () => {
  it('accepts valid join during WAITING and returns playerJoined broadcast', () => {
    const state = createInitialState('abc');
    const { state: newState, messages } = handleJoin(
      state,
      { playerId: 'player1', name: 'Alice', wager: 100, autoCashout: null },
      'conn1',
    );

    expect(newState.players.has('player1')).toBe(true);
    expect(messages).toHaveLength(1);
    expect(messages[0].broadcast).toBe(true);
    if (messages[0].broadcast) {
      expect(messages[0].message.type).toBe('playerJoined');
      if (messages[0].message.type === 'playerJoined') {
        expect(messages[0].message.playerId).toBe('player1');
        expect(messages[0].message.name).toBe('Alice');
        expect(messages[0].message.wager).toBe(100);
      }
    }
  });

  it('returns error if phase is STARTING', () => {
    const state = { ...createInitialState('abc'), phase: 'STARTING' as const };
    const { state: newState, messages } = handleJoin(
      state,
      { playerId: 'player1', wager: 50, autoCashout: null },
      'conn1',
    );

    expect(newState.players.size).toBe(0);
    expect(messages).toHaveLength(1);
    expect(messages[0].broadcast).toBe(false);
    if (!messages[0].broadcast) {
      expect(messages[0].message.type).toBe('error');
    }
  });

  it('returns error if phase is RUNNING', () => {
    const { state } = makeRunningState();
    const { messages } = handleJoin(
      state,
      { playerId: 'player1', wager: 50, autoCashout: null },
      'conn1',
    );

    expect(messages[0].broadcast).toBe(false);
    if (!messages[0].broadcast) {
      expect(messages[0].message.type).toBe('error');
    }
  });

  it('returns error if phase is CRASHED', () => {
    let state = {
      ...createInitialState('abc'),
      chainSeed: 'seed',
      drandRound: 1,
      drandRandomness: 'rand',
    };
    state = handleCrash(state, Date.now()).state;
    const { messages } = handleJoin(
      state,
      { playerId: 'player1', wager: 50, autoCashout: null },
      'conn1',
    );

    expect(messages[0].broadcast).toBe(false);
    if (!messages[0].broadcast) {
      expect(messages[0].message.type).toBe('error');
    }
  });

  it('returns error if wager is 0', () => {
    const state = createInitialState('abc');
    const { messages } = handleJoin(
      state,
      { playerId: 'player1', wager: 0, autoCashout: null },
      'conn1',
    );

    expect(messages[0].broadcast).toBe(false);
    if (!messages[0].broadcast) {
      expect(messages[0].message.type).toBe('error');
    }
  });

  it('returns error if wager is negative', () => {
    const state = createInitialState('abc');
    const { messages } = handleJoin(
      state,
      { playerId: 'player1', wager: -10, autoCashout: null },
      'conn1',
    );

    expect(messages[0].broadcast).toBe(false);
    if (!messages[0].broadcast) {
      expect(messages[0].message.type).toBe('error');
    }
  });

  it('returns error if wager is NaN', () => {
    const state = createInitialState('abc');
    const { messages } = handleJoin(
      state,
      { playerId: 'player1', wager: Number.NaN, autoCashout: null },
      'conn1',
    );

    expect(messages[0].broadcast).toBe(false);
    if (!messages[0].broadcast) {
      expect(messages[0].message.type).toBe('error');
    }
  });

  it('returns error if same playerId is already in the round', () => {
    const state = createInitialState('abc');
    const { state: stateAfterFirst } = handleJoin(
      state,
      { playerId: 'player1', wager: 100, autoCashout: null },
      'conn1',
    );
    const { messages } = handleJoin(
      stateAfterFirst,
      { playerId: 'player1', wager: 50, autoCashout: null },
      'conn2',
    );

    expect(messages[0].broadcast).toBe(false);
    if (!messages[0].broadcast) {
      expect(messages[0].message.type).toBe('error');
    }
  });

  // ─── [High-5] Idempotent join ─────────────────────────────────────────────

  it('[High-5] same playerId rejoins with same wager → returns success, state unchanged', () => {
    const state = createInitialState('abc');
    const { state: stateAfterFirst } = handleJoin(
      state,
      { playerId: 'player1', wager: 10, autoCashout: null },
      'conn1',
    );

    const { state: stateAfterSecond, messages } = handleJoin(
      stateAfterFirst,
      { playerId: 'player1', wager: 10, autoCashout: null },
      'conn2',
    );

    // Should return a success (broadcast) message
    expect(messages).toHaveLength(1);
    expect(messages[0].broadcast).toBe(true);
    if (messages[0].broadcast) {
      expect(messages[0].message.type).toBe('playerJoined');
    }

    // State should be unchanged — only 1 player, wager unchanged
    expect(stateAfterSecond.players.size).toBe(1);
    expect(stateAfterSecond.players.get('player1')?.wager).toBe(10);
  });

  it('[Phase 4.6] reconnect during RUNNING updates player.id silently (no messages)', () => {
    const { state: waiting } = handleJoin(
      createInitialState('abc'),
      { playerId: 'player1', wager: 10, autoCashout: null },
      'conn1',
    );
    const { state: running } = makeRunningState();
    // Inject player into a RUNNING state
    const runningWithPlayer = {
      ...running,
      players: new Map([['player1', waiting.players.get('player1')!]]),
    };

    const { state: reconnected, messages } = handleJoin(
      runningWithPlayer,
      { playerId: 'player1', wager: 10, autoCashout: null },
      'conn2',
    );

    expect(messages).toHaveLength(0);
    expect(reconnected.players.get('player1')?.id).toBe('conn2');
  });

  it('[Phase 4.6] reconnect during RUNNING with wrong wager returns error', () => {
    const { state: waiting } = handleJoin(
      createInitialState('abc'),
      { playerId: 'player1', wager: 10, autoCashout: null },
      'conn1',
    );
    const { state: running } = makeRunningState();
    const runningWithPlayer = {
      ...running,
      players: new Map([['player1', waiting.players.get('player1')!]]),
    };

    const { messages } = handleJoin(
      runningWithPlayer,
      { playerId: 'player1', wager: 99, autoCashout: null },
      'conn2',
    );

    expect(messages).toHaveLength(1);
    expect(messages[0].broadcast).toBe(false);
    if (!messages[0].broadcast) {
      expect(messages[0].message.type).toBe('error');
    }
  });

  it('[Phase 4.6] new player join during RUNNING still returns phase error', () => {
    const { state: running } = makeRunningState();

    const { messages } = handleJoin(
      running,
      { playerId: 'brand-new-player', wager: 10, autoCashout: null },
      'conn1',
    );

    expect(messages).toHaveLength(1);
    if (!messages[0].broadcast) {
      expect(messages[0].message.type).toBe('error');
      if (messages[0].message.type === 'error') {
        expect(messages[0].message.message).toContain('RUNNING');
      }
    }
  });

  it('[Phase 4.6] idempotent reconnect with new connId updates player.id in state', () => {
    const state = createInitialState('abc');
    const { state: s1 } = handleJoin(
      state,
      { playerId: 'player1', wager: 10, autoCashout: null },
      'conn1',
    );
    expect(s1.players.get('player1')?.id).toBe('conn1');

    const { state: s2 } = handleJoin(
      s1,
      { playerId: 'player1', wager: 10, autoCashout: null },
      'conn2',
    );
    // Connection ID must be updated so sendToTarget can route to the new connection
    expect(s2.players.get('player1')?.id).toBe('conn2');
  });

  it('[Phase 4.6] handleCashout resolves player by playerId — independent of connection ID', () => {
    // Verifies the pure-function half of reconnect cashout: handleCashout looks up
    // players by playerId, not by conn.id, so it works regardless of which connection
    // ID was recorded. The DO layer (crash-game.ts) handles mapping conn.id → playerId.
    const state = createInitialState('abc');
    const { state: s1 } = handleJoin(
      state,
      { playerId: 'player1', wager: 100, autoCashout: null },
      'conn1',
    );
    const nowMs = 1_000_000;
    const s2 = handleStartingComplete(
      s1,
      {
        crashPoint: 3.0,
        chainSeed: 'seed',
        drandRound: 1,
        drandRandomness: 'rand',
        nextChainCommitment: 'nextcommit',
      },
      nowMs,
    ).state;

    // Cashout by playerId works even though we never updated player.id to a new conn
    const elapsed = Math.log(1.5) / 0.00006;
    const { messages } = handleCashout(s2, 'player1', nowMs + elapsed);

    const cashoutMsg = messages.find((m) => m.broadcast && m.message.type === 'playerCashedOut');
    expect(cashoutMsg).toBeDefined();
  });

  it('[High-5] same playerId rejoins with different wager → returns error "Already joined with different wager"', () => {
    const state = createInitialState('abc');
    const { state: stateAfterFirst } = handleJoin(
      state,
      { playerId: 'player1', wager: 10, autoCashout: null },
      'conn1',
    );

    const { state: stateAfterSecond, messages } = handleJoin(
      stateAfterFirst,
      { playerId: 'player1', wager: 20, autoCashout: null },
      'conn2',
    );

    // Should return an error targeted at the player
    expect(messages).toHaveLength(1);
    expect(messages[0].broadcast).toBe(false);
    if (!messages[0].broadcast) {
      expect(messages[0].message.type).toBe('error');
      if (messages[0].message.type === 'error') {
        expect(messages[0].message.message).toBe('Already joined with different wager');
      }
    }

    // State should be unchanged — wager still 10
    expect(stateAfterSecond.players.size).toBe(1);
    expect(stateAfterSecond.players.get('player1')?.wager).toBe(10);
  });

  it('defaults name to first 8 chars of playerId if name is absent', () => {
    const state = createInitialState('abc');
    const playerId = 'abcdef1234567890';
    const { state: newState } = handleJoin(
      state,
      { playerId, wager: 100, autoCashout: null },
      'conn1',
    );

    expect(newState.players.get(playerId)?.name).toBe('abcdef12');
  });

  it('defaults name to first 8 chars of playerId if name is empty string', () => {
    const state = createInitialState('abc');
    const playerId = 'abcdef1234567890';
    const { state: newState } = handleJoin(
      state,
      { playerId, name: '   ', wager: 100, autoCashout: null },
      'conn1',
    );

    // Empty after trim → falls back to slice(0, 8)
    expect(newState.players.get(playerId)?.name).toBe('abcdef12');
  });

  it('stores player keyed by playerId in returned state', () => {
    const state = createInitialState('abc');
    const { state: newState } = handleJoin(
      state,
      { playerId: 'myplayer', name: 'Test', wager: 200, autoCashout: null },
      'connX',
    );

    expect(newState.players.has('myplayer')).toBe(true);
    expect(newState.players.get('myplayer')?.playerId).toBe('myplayer');
  });

  // ─── [Security-3] autoCashout validation ─────────────────────────────────

  it('returns error if autoCashout is negative', () => {
    const state = createInitialState('abc');
    const { state: newState, messages } = handleJoin(
      state,
      { playerId: 'p1', wager: 100, autoCashout: -1 },
      'conn1',
    );
    expect(newState.players.size).toBe(0);
    expect(messages[0].broadcast).toBe(false);
    if (!messages[0].broadcast) {
      expect(messages[0].message.type).toBe('error');
    }
  });

  it('returns error if autoCashout is 0.5 (below 1.0)', () => {
    const state = createInitialState('abc');
    const { messages } = handleJoin(
      state,
      { playerId: 'p1', wager: 100, autoCashout: 0.5 },
      'conn1',
    );
    expect(messages[0].broadcast).toBe(false);
    if (!messages[0].broadcast) {
      expect(messages[0].message.type).toBe('error');
    }
  });

  it('returns error if autoCashout is exactly 1.0 (would cashout immediately at 0 profit)', () => {
    const state = createInitialState('abc');
    const { messages } = handleJoin(
      state,
      { playerId: 'p1', wager: 100, autoCashout: 1.0 },
      'conn1',
    );
    expect(messages[0].broadcast).toBe(false);
    if (!messages[0].broadcast) {
      expect(messages[0].message.type).toBe('error');
    }
  });

  it('returns error if autoCashout is NaN', () => {
    const state = createInitialState('abc');
    const { messages } = handleJoin(
      state,
      { playerId: 'p1', wager: 100, autoCashout: NaN },
      'conn1',
    );
    expect(messages[0].broadcast).toBe(false);
    if (!messages[0].broadcast) {
      expect(messages[0].message.type).toBe('error');
    }
  });

  it('returns error if autoCashout is Infinity', () => {
    const state = createInitialState('abc');
    const { messages } = handleJoin(
      state,
      { playerId: 'p1', wager: 100, autoCashout: Infinity },
      'conn1',
    );
    expect(messages[0].broadcast).toBe(false);
    if (!messages[0].broadcast) {
      expect(messages[0].message.type).toBe('error');
    }
  });

  it('accepts autoCashout of 1.01', () => {
    const state = createInitialState('abc');
    const { state: newState, messages } = handleJoin(
      state,
      { playerId: 'p1', wager: 100, autoCashout: 1.01 },
      'conn1',
    );
    expect(newState.players.has('p1')).toBe(true);
    expect(messages[0].broadcast).toBe(true);
  });

  // ─── [Security-4] playerId length validation ──────────────────────────────

  it('returns error if playerId exceeds MAX_PLAYER_ID_LENGTH', () => {
    const state = createInitialState('abc');
    const longId = 'x'.repeat(MAX_PLAYER_ID_LENGTH + 1);
    const { state: newState, messages } = handleJoin(
      state,
      { playerId: longId, wager: 100, autoCashout: null },
      'conn1',
    );
    expect(newState.players.size).toBe(0);
    expect(messages[0].broadcast).toBe(false);
    if (!messages[0].broadcast) {
      expect(messages[0].message.type).toBe('error');
    }
  });

  it('accepts playerId at exactly MAX_PLAYER_ID_LENGTH', () => {
    const state = createInitialState('abc');
    const maxId = 'x'.repeat(MAX_PLAYER_ID_LENGTH);
    const { state: newState, messages } = handleJoin(
      state,
      { playerId: maxId, wager: 100, autoCashout: null },
      'conn1',
    );
    expect(newState.players.has(maxId)).toBe(true);
    expect(messages[0].broadcast).toBe(true);
  });

  it('returns error if playerId is empty string', () => {
    const state = createInitialState('abc');
    const { messages } = handleJoin(
      state,
      { playerId: '', wager: 100, autoCashout: null },
      'conn1',
    );
    expect(messages[0].broadcast).toBe(false);
    if (!messages[0].broadcast) {
      expect(messages[0].message.type).toBe('error');
    }
  });

  // ─── [High-11] Max players per round ─────────────────────────────────────

  it('allows join when player count is below MAX_PLAYERS_PER_ROUND', () => {
    const state = createInitialState('abc');
    const { state: newState, messages } = handleJoin(
      state,
      { playerId: 'p1', wager: 100, autoCashout: null },
      'conn1',
    );
    expect(newState.players.has('p1')).toBe(true);
    expect(messages[0].broadcast).toBe(true);
  });

  it('returns "Room full" error when player count equals MAX_PLAYERS_PER_ROUND', () => {
    let state = createInitialState('abc');
    // Fill the room to capacity
    for (let i = 0; i < MAX_PLAYERS_PER_ROUND; i++) {
      const r = handleJoin(state, { playerId: `p${i}`, wager: 100, autoCashout: null }, `c${i}`);
      state = r.state;
    }
    const { state: fullState, messages } = handleJoin(
      state,
      { playerId: 'overflow', wager: 100, autoCashout: null },
      'conn-overflow',
    );
    expect(fullState.players.has('overflow')).toBe(false);
    expect(messages[0].broadcast).toBe(false);
    if (!messages[0].broadcast && messages[0].message.type === 'error') {
      expect(messages[0].message.message).toBe('Room full');
    }
  });

  // ─── [High-16] Min/max wager limits ──────────────────────────────────────

  it('returns error when wager is below MIN_WAGER', () => {
    const state = createInitialState('abc');
    const { messages } = handleJoin(
      state,
      { playerId: 'p1', wager: MIN_WAGER - 0.01, autoCashout: null },
      'conn1',
    );
    expect(messages[0].broadcast).toBe(false);
    if (!messages[0].broadcast) {
      expect(messages[0].message.type).toBe('error');
    }
  });

  it('allows join when wager equals MIN_WAGER', () => {
    const state = createInitialState('abc');
    const { state: newState, messages } = handleJoin(
      state,
      { playerId: 'p1', wager: MIN_WAGER, autoCashout: null },
      'conn1',
    );
    expect(newState.players.has('p1')).toBe(true);
    expect(messages[0].broadcast).toBe(true);
  });

  it('allows join when wager equals MAX_WAGER', () => {
    const state = createInitialState('abc');
    const { state: newState, messages } = handleJoin(
      state,
      { playerId: 'p1', wager: MAX_WAGER, autoCashout: null },
      'conn1',
    );
    expect(newState.players.has('p1')).toBe(true);
    expect(messages[0].broadcast).toBe(true);
  });

  it('returns error when wager exceeds MAX_WAGER', () => {
    const state = createInitialState('abc');
    const { messages } = handleJoin(
      state,
      { playerId: 'p1', wager: MAX_WAGER + 0.01, autoCashout: null },
      'conn1',
    );
    expect(messages[0].broadcast).toBe(false);
    if (!messages[0].broadcast) {
      expect(messages[0].message.type).toBe('error');
    }
  });

  it('stores autoCashout: null correctly', () => {
    const state = createInitialState('abc');
    const { state: newState } = handleJoin(
      state,
      { playerId: 'p1', wager: 100, autoCashout: null },
      'conn1',
    );

    expect(newState.players.get('p1')?.autoCashout).toBeNull();
  });

  it('stores autoCashout: 2.5 correctly', () => {
    const state = createInitialState('abc');
    const { state: newState } = handleJoin(
      state,
      { playerId: 'p1', wager: 100, autoCashout: 2.5 },
      'conn1',
    );

    expect(newState.players.get('p1')?.autoCashout).toBe(2.5);
  });

  it('does NOT mutate the original state players map', () => {
    const state = createInitialState('abc');
    const originalSize = state.players.size;
    handleJoin(state, { playerId: 'p1', wager: 100, autoCashout: null }, 'conn1');

    expect(state.players.size).toBe(originalSize);
  });
});

// ─── handleCashout ───────────────────────────────────────────────────────────

// Helper: join during WAITING then transition to RUNNING
function makeRunningStateWithPlayer(
  playerId: string,
  wager: number,
  autoCashout: number | null,
  connectionId: string,
  crashPoint = 5.0,
  nowMs = 1_000_000,
) {
  const state = createInitialState('abc');
  const { state: withPlayer } = handleJoin(state, { playerId, wager, autoCashout }, connectionId);
  const running = handleStartingComplete(
    withPlayer,
    {
      crashPoint,
      chainSeed: 'seed',
      drandRound: 1,
      drandRandomness: 'rand',
      nextChainCommitment: 'next',
    },
    nowMs,
  ).state;
  return { state: running, nowMs };
}

describe('handleCashout', () => {
  it('returns playerCashedOut with correct payout (wager × multiplier, floored to 2dp)', () => {
    const nowMs = 1_000_000;
    const { state } = makeRunningStateWithPlayer('p1', 100, null, 'conn1', 5.0, nowMs);

    // Advance 5000ms — multiplierAtTime(5000) = e^(0.00006*5000) = e^0.3 ≈ 1.3499
    const cashoutTime = nowMs + 5000;
    const { messages } = handleCashout(state, 'p1', cashoutTime);

    expect(messages[0].broadcast).toBe(true);
    if (messages[0].broadcast) {
      expect(messages[0].message.type).toBe('playerCashedOut');
    }
  });

  it('payout floor: wager=100, multiplier=1.855 → payout = 185.50', () => {
    // multiplierAtTime(elapsed) = e^(GROWTH_RATE * elapsed)
    // We want e^(GROWTH_RATE * elapsed) ≈ 1.855
    // elapsed = ln(1.855) / GROWTH_RATE ≈ 10237ms
    // floor(100 * 1.855 * 100) / 100 = floor(18550) / 100 = 185.50
    const GROWTH_RATE = 0.00006;
    const targetMultiplier = 1.855;
    const elapsed = Math.log(targetMultiplier) / GROWTH_RATE;

    const nowMs = 1_000_000;
    const { state } = makeRunningStateWithPlayer('p1', 100, null, 'conn1', 5.0, nowMs);

    const cashoutTime = nowMs + elapsed;
    const { messages, state: afterCashout } = handleCashout(state, 'p1', cashoutTime);

    expect(messages[0].broadcast).toBe(true);
    if (messages[0].broadcast && messages[0].message.type === 'playerCashedOut') {
      // The payout should be floored to 2dp; 1.855 * 100 = 185.50 exactly
      const payout = messages[0].message.payout;
      // Use toBeCloseTo to handle floating-point round-trip; floor semantics mean ≤ expected
      expect(payout).toBeGreaterThanOrEqual(185.49);
      expect(payout).toBeLessThanOrEqual(185.5);
      // Verify it is exactly 2 decimal places
      expect(Math.round(payout * 100) / 100).toBe(payout);
    }
    const statePayout = afterCashout.players.get('p1')?.payout;
    expect(statePayout).toBeGreaterThanOrEqual(185.49);
    expect(statePayout).toBeLessThanOrEqual(185.5);
  });

  it('returns error if phase is not RUNNING', () => {
    const state = createInitialState('abc');
    const { messages } = handleCashout(state, 'p1', Date.now());

    expect(messages[0].broadcast).toBe(false);
    if (!messages[0].broadcast) {
      expect(messages[0].message.type).toBe('error');
    }
  });

  it('returns error if playerId not in current round', () => {
    const { state, nowMs } = makeRunningState();
    const { messages } = handleCashout(state, 'nonexistent', nowMs + 1000);

    expect(messages[0].broadcast).toBe(false);
    if (!messages[0].broadcast) {
      expect(messages[0].message.type).toBe('error');
    }
  });

  it('returns error if player already cashed out', () => {
    const nowMs = 1_000_000;
    const { state } = makeRunningStateWithPlayer('p1', 100, null, 'conn1', 5.0, nowMs);

    const { state: afterFirst } = handleCashout(state, 'p1', nowMs + 1000);
    const { messages } = handleCashout(afterFirst, 'p1', nowMs + 2000);

    expect(messages[0].broadcast).toBe(false);
    if (!messages[0].broadcast) {
      expect(messages[0].message.type).toBe('error');
    }
  });

  it('marks player as cashed out in returned state', () => {
    const nowMs = 1_000_000;
    const { state } = makeRunningStateWithPlayer('p1', 100, null, 'conn1', 5.0, nowMs);

    const { state: afterCashout } = handleCashout(state, 'p1', nowMs + 1000);

    expect(afterCashout.players.get('p1')?.cashedOut).toBe(true);
    expect(afterCashout.players.get('p1')?.cashoutMultiplier).not.toBeNull();
  });
});

// ─── handleTick ──────────────────────────────────────────────────────────────

describe('handleTick', () => {
  it('shouldCrash is false when multiplier < crashPoint', () => {
    const nowMs = 1_000_000;
    let state = createInitialState('abc');
    // crashPoint = 10.0 — far in the future
    state = handleStartingComplete(
      state,
      {
        crashPoint: 10.0,
        chainSeed: 'seed',
        drandRound: 1,
        drandRandomness: 'rand',
        nextChainCommitment: 'next',
      },
      nowMs,
    ).state;

    // Only 100ms elapsed — multiplier ≈ 1.006, well below 10.0
    const { shouldCrash } = handleTick(state, nowMs + 100);
    expect(shouldCrash).toBe(false);
  });

  it('shouldCrash is true when multiplier >= crashPoint', () => {
    const nowMs = 1_000_000;
    let state = createInitialState('abc');
    // crashPoint = 1.0 — crashes immediately
    state = handleStartingComplete(
      state,
      {
        crashPoint: 1.0,
        chainSeed: 'seed',
        drandRound: 1,
        drandRandomness: 'rand',
        nextChainCommitment: 'next',
      },
      nowMs,
    ).state;

    // At t=0, multiplierAtTime(0) = 1.0 >= 1.0
    const { shouldCrash } = handleTick(state, nowMs);
    expect(shouldCrash).toBe(true);
  });

  it('auto-cashout triggers for player whose target is reached', () => {
    const nowMs = 1_000_000;
    const { state } = makeRunningStateWithPlayer('p1', 100, 2.0, 'conn1', 5.0, nowMs);

    // Compute elapsed where multiplier > 2.0
    const GROWTH_RATE = 0.00006;
    const elapsed = Math.log(2.1) / GROWTH_RATE; // ~12397ms
    const { state: afterTick, messages } = handleTick(state, nowMs + elapsed);

    expect(afterTick.players.get('p1')?.cashedOut).toBe(true);
    const cashoutMsg = messages.find((m) => m.broadcast && m.message.type === 'playerCashedOut');
    expect(cashoutMsg).toBeDefined();
  });

  it('auto-cashout uses exact player target, not tick multiplier', () => {
    const nowMs = 1_000_000;
    const { state } = makeRunningStateWithPlayer('p1', 100, 2.5, 'conn1', 5.0, nowMs);

    // Tick multiplier crosses 2.51, auto-cashout should trigger at exactly 2.5
    const GROWTH_RATE = 0.00006;
    const elapsed = Math.log(2.51) / GROWTH_RATE;
    const { messages } = handleTick(state, nowMs + elapsed);

    const cashoutMsg = messages.find((m) => m.broadcast && m.message.type === 'playerCashedOut');
    expect(cashoutMsg).toBeDefined();
    if (cashoutMsg?.broadcast && cashoutMsg.message.type === 'playerCashedOut') {
      expect(cashoutMsg.message.multiplier).toBe(2.5);
      // payout = floor(100 * 2.5 * 100) / 100 = 250.00
      expect(cashoutMsg.message.payout).toBe(250.0);
    }
  });

  it('multiple auto-cashouts in a single tick are all processed', () => {
    const nowMs = 1_000_000;
    // Join all players during WAITING, then transition to RUNNING
    const state = createInitialState('abc');
    const { state: s1 } = handleJoin(state, { playerId: 'p1', wager: 100, autoCashout: 2.0 }, 'c1');
    const { state: s2 } = handleJoin(s1, { playerId: 'p2', wager: 50, autoCashout: 2.0 }, 'c2');
    const { state: s3 } = handleJoin(s2, { playerId: 'p3', wager: 75, autoCashout: 3.0 }, 'c3');
    const running = handleStartingComplete(
      s3,
      {
        crashPoint: 5.0,
        chainSeed: 'seed',
        drandRound: 1,
        drandRandomness: 'rand',
        nextChainCommitment: 'next',
      },
      nowMs,
    ).state;

    // Tick to 2.1x — p1 and p2 should auto-cashout, p3 should not
    const GROWTH_RATE = 0.00006;
    const elapsed = Math.log(2.1) / GROWTH_RATE;
    const { state: afterTick, messages } = handleTick(running, nowMs + elapsed);

    expect(afterTick.players.get('p1')?.cashedOut).toBe(true);
    expect(afterTick.players.get('p2')?.cashedOut).toBe(true);
    expect(afterTick.players.get('p3')?.cashedOut).toBe(false);

    const cashoutMsgs = messages.filter((m) => m.broadcast && m.message.type === 'playerCashedOut');
    expect(cashoutMsgs).toHaveLength(2);
  });

  it('players already cashed out are not re-processed', () => {
    const nowMs = 1_000_000;
    const { state } = makeRunningStateWithPlayer('p1', 100, 2.0, 'conn1', 5.0, nowMs);

    const GROWTH_RATE = 0.00006;
    const elapsed1 = Math.log(2.1) / GROWTH_RATE;
    const { state: afterFirst } = handleTick(state, nowMs + elapsed1);
    expect(afterFirst.players.get('p1')?.cashedOut).toBe(true);

    // Second tick even further — p1 should not be re-processed
    const elapsed2 = Math.log(2.5) / GROWTH_RATE;
    const { messages: msgs2 } = handleTick(afterFirst, nowMs + elapsed2);
    const cashoutMsgs = msgs2.filter((m) => m.broadcast && m.message.type === 'playerCashedOut');
    expect(cashoutMsgs).toHaveLength(0);
  });

  it('elapsed is computed as nowMs - roundStartTime', () => {
    const nowMs = 1_000_000;
    let state = createInitialState('abc');
    state = handleStartingComplete(
      state,
      {
        crashPoint: 10.0,
        chainSeed: 'seed',
        drandRound: 1,
        drandRandomness: 'rand',
        nextChainCommitment: 'next',
      },
      nowMs,
    ).state;

    const tickTime = nowMs + 3000;
    const { messages } = handleTick(state, tickTime);

    const tickMsg = messages.find((m) => m.broadcast && m.message.type === 'tick');
    expect(tickMsg).toBeDefined();
    if (tickMsg?.broadcast && tickMsg.message.type === 'tick') {
      expect(tickMsg.message.elapsed).toBe(3000);
    }
  });

  it('returns no messages and shouldCrash=false when phase is not RUNNING', () => {
    const state = createInitialState('abc');
    const { messages, shouldCrash } = handleTick(state, Date.now());
    expect(messages).toHaveLength(0);
    expect(shouldCrash).toBe(false);
  });
});

// ─── handleCrash ─────────────────────────────────────────────────────────────

describe('handleCrash', () => {
  it('all non-cashed-out players have payout = 0 in returned state', () => {
    const nowMs = 1_000_000;
    // Join during WAITING then transition to RUNNING
    const state = createInitialState('abc');
    const { state: s1 } = handleJoin(
      state,
      { playerId: 'p1', wager: 100, autoCashout: null },
      'c1',
    );
    const { state: s2 } = handleJoin(s1, { playerId: 'p2', wager: 50, autoCashout: null }, 'c2');
    const running = handleStartingComplete(
      s2,
      {
        crashPoint: 5.0,
        chainSeed: 'seed',
        drandRound: 1,
        drandRandomness: 'rand',
        nextChainCommitment: 'next',
      },
      nowMs,
    ).state;

    const { state: crashed } = handleCrash(running, nowMs + 5000);

    expect(crashed.players.get('p1')?.payout).toBe(0);
    expect(crashed.players.get('p2')?.payout).toBe(0);
  });

  it('already-cashed-out players retain their payout', () => {
    const nowMs = 1_000_000;
    const { state } = makeRunningStateWithPlayer('p1', 100, null, 'c1', 5.0, nowMs);
    const { state: afterCashout } = handleCashout(state, 'p1', nowMs + 5000);
    const payoutBefore = afterCashout.players.get('p1')?.payout;

    const { state: crashed } = handleCrash(afterCashout, nowMs + 10000);

    expect(crashed.players.get('p1')?.payout).toBe(payoutBefore);
    expect(crashed.players.get('p1')?.cashedOut).toBe(true);
  });

  it('broadcasts state message with phase CRASHED and reveals crashPoint, drandRound, drandRandomness', () => {
    const nowMs = 1_000_000;
    let state = createInitialState('abc');
    state = handleStartingComplete(
      state,
      {
        crashPoint: 2.5,
        chainSeed: 'revealedSeed',
        drandRound: 99,
        drandRandomness: 'drandRand',
        nextChainCommitment: 'next',
      },
      nowMs,
    ).state;

    const { messages } = handleCrash(state, nowMs + 3000);

    expect(messages).toHaveLength(1);
    expect(messages[0].broadcast).toBe(true);
    if (messages[0].broadcast && messages[0].message.type === 'state') {
      expect(messages[0].message.phase).toBe('CRASHED');
      expect(messages[0].message.crashPoint).toBe(2.5);
      expect(messages[0].message.drandRound).toBe(99);
      expect(messages[0].message.drandRandomness).toBe('drandRand');
      expect(Array.isArray(messages[0].message.players)).toBe(true);
      // roundSeed is in history[0], not directly in the state message
      expect(messages[0].message.history[0]?.roundSeed).toBe('revealedSeed');
    }
  });

  it('phase transitions to CRASHED', () => {
    const nowMs = 1_000_000;
    let state = createInitialState('abc');
    state = handleStartingComplete(
      state,
      {
        crashPoint: 2.0,
        chainSeed: 'seed',
        drandRound: 1,
        drandRandomness: 'rand',
        nextChainCommitment: 'next',
      },
      nowMs,
    ).state;

    const { state: crashed } = handleCrash(state, nowMs + 5000);
    expect(crashed.phase).toBe('CRASHED');
  });

  it('history entry added with correct roundId, crashPoint, roundSeed', () => {
    const nowMs = 1_000_000;
    let state = createInitialState('abc', 5);
    state = handleStartingComplete(
      state,
      {
        crashPoint: 3.14,
        chainSeed: 'theSeed',
        drandRound: 7,
        drandRandomness: 'theRand',
        nextChainCommitment: 'next',
      },
      nowMs,
    ).state;

    const { state: crashed } = handleCrash(state, nowMs + 5000);

    expect(crashed.history).toHaveLength(1);
    expect(crashed.history[0].roundId).toBe(5);
    expect(crashed.history[0].crashPoint).toBe(3.14);
    expect(crashed.history[0].roundSeed).toBe('theSeed');
  });

  it('history is prepended and capped at HISTORY_LENGTH entries', () => {
    const nowMs = 1_000_000;

    // Build up HISTORY_LENGTH + 2 entries
    let state = createInitialState('abc', 1);
    const existingHistory = Array.from({ length: HISTORY_LENGTH + 2 }, (_, i) => ({
      roundId: i + 1,
      crashPoint: 2.0,
      roundSeed: `seed${i}`,
      drandRound: i,
      drandRandomness: `rand${i}`,
      chainCommitment: 'commit',
    }));
    state = { ...state, history: existingHistory };
    state = handleStartingComplete(
      state,
      {
        crashPoint: 2.0,
        chainSeed: 'newseed',
        drandRound: 99,
        drandRandomness: 'newrand',
        nextChainCommitment: 'next',
      },
      nowMs,
    ).state;

    const { state: crashed } = handleCrash(state, nowMs + 1000);

    expect(crashed.history.length).toBe(HISTORY_LENGTH);
    expect(crashed.history[0].roundSeed).toBe('newseed');
  });
});

// ─── handleStartingComplete ───────────────────────────────────────────────────

describe('handleStartingComplete', () => {
  it('phase transitions to RUNNING', () => {
    const state = { ...createInitialState('abc'), phase: 'STARTING' as const };
    const { state: newState } = handleStartingComplete(
      state,
      {
        crashPoint: 2.5,
        chainSeed: 'seed',
        drandRound: 1,
        drandRandomness: 'rand',
        nextChainCommitment: 'nextcommit',
      },
      1_000_000,
    );
    expect(newState.phase).toBe('RUNNING');
  });

  it('sets crashPoint correctly', () => {
    const state = createInitialState('abc');
    const { state: newState } = handleStartingComplete(
      state,
      {
        crashPoint: 3.75,
        chainSeed: 'seed',
        drandRound: 1,
        drandRandomness: 'rand',
        nextChainCommitment: 'nextcommit',
      },
      1_000_000,
    );
    expect(newState.crashPoint).toBe(3.75);
  });

  it('sets roundStartTime to nowMs', () => {
    const state = createInitialState('abc');
    const nowMs = 9_999_000;
    const { state: newState } = handleStartingComplete(
      state,
      {
        crashPoint: 2.0,
        chainSeed: 'seed',
        drandRound: 1,
        drandRandomness: 'rand',
        nextChainCommitment: 'nextcommit',
      },
      nowMs,
    );
    expect(newState.roundStartTime).toBe(nowMs);
  });

  it('does NOT broadcast the crashPoint in any message (messages are empty)', () => {
    const state = createInitialState('abc');
    const { messages } = handleStartingComplete(
      state,
      {
        crashPoint: 2.0,
        chainSeed: 'seed',
        drandRound: 1,
        drandRandomness: 'rand',
        nextChainCommitment: 'nextcommit',
      },
      1_000_000,
    );
    expect(messages).toHaveLength(0);
  });

  it('sets crashTimeMs based on crashPoint', () => {
    const state = createInitialState('abc');
    const crashPoint = 2.0;
    const { state: newState } = handleStartingComplete(
      state,
      {
        crashPoint,
        chainSeed: 'seed',
        drandRound: 1,
        drandRandomness: 'rand',
        nextChainCommitment: 'nextcommit',
      },
      1_000_000,
    );
    // crashTimeMs(2.0) = ln(2) / 0.00006 ≈ 11552ms
    expect(newState.crashTimeMs).toBeGreaterThan(0);
    expect(newState.crashTimeMs).toBeCloseTo(Math.log(2) / 0.00006, 0);
  });
});

// ─── handleCountdownTick ──────────────────────────────────────────────────────

describe('handleCountdownTick', () => {
  it('decrements countdown by 1000ms', () => {
    const state = createInitialState('abc');
    // initial countdown = WAITING_DURATION_MS = 10000
    const { state: newState } = handleCountdownTick(state);
    expect(newState.countdown).toBe(WAITING_DURATION_MS - 1000);
  });

  it('sets shouldStartRound = true when countdown reaches 0 (was 1000, now 0)', () => {
    const state = { ...createInitialState('abc'), countdown: 1000 };
    const { shouldStartRound, state: newState } = handleCountdownTick(state);
    expect(shouldStartRound).toBe(true);
    expect(newState.countdown).toBe(0);
  });

  it('phase transitions to STARTING when shouldStartRound is true', () => {
    const state = { ...createInitialState('abc'), countdown: 1000 };
    const { state: newState } = handleCountdownTick(state);
    expect(newState.phase).toBe('STARTING');
  });

  it('phase stays WAITING when countdown > 0 after decrement', () => {
    const state = createInitialState('abc'); // countdown = 10000
    const { state: newState } = handleCountdownTick(state);
    expect(newState.phase).toBe('WAITING');
  });

  it('broadcasts state message with updated countdown', () => {
    const state = createInitialState('abc');
    const { messages } = handleCountdownTick(state);

    expect(messages).toHaveLength(1);
    expect(messages[0].broadcast).toBe(true);
    if (messages[0].broadcast && messages[0].message.type === 'state') {
      expect(messages[0].message.countdown).toBe(WAITING_DURATION_MS - 1000);
    }
  });

  it('returns no messages and shouldStartRound=false when phase is not WAITING', () => {
    const { state } = makeRunningState();
    const { messages, shouldStartRound } = handleCountdownTick(state);
    expect(messages).toHaveLength(0);
    expect(shouldStartRound).toBe(false);
  });

  it('does not decrement below 0', () => {
    const state = { ...createInitialState('abc'), countdown: 500 };
    const { state: newState } = handleCountdownTick(state);
    expect(newState.countdown).toBe(0);
  });
});

// ─── transitionToWaiting ─────────────────────────────────────────────────────

describe('transitionToWaiting', () => {
  it('clears all players (players map is empty)', () => {
    const nowMs = 1_000_000;
    // Join during WAITING, then transition to RUNNING, then crash
    const { state: running } = makeRunningStateWithPlayer('p1', 100, null, 'c1', 2.0, nowMs);
    const { state: crashed } = handleCrash(running, nowMs + 5000);

    const { state: waiting } = transitionToWaiting(crashed, 'newcommit');
    expect(waiting.players.size).toBe(0);
  });

  it('increments roundId', () => {
    let state = createInitialState('abc', 3);
    state = { ...state, chainSeed: 'seed', drandRound: 1, drandRandomness: 'rand' };
    state = handleCrash(state, Date.now()).state;
    const { state: waiting } = transitionToWaiting(state, 'newcommit');
    expect(waiting.roundId).toBe(4);
  });

  it('resets countdown to WAITING_DURATION_MS', () => {
    let state = createInitialState('abc');
    state = { ...state, countdown: 0 };
    const { state: waiting } = transitionToWaiting(state, 'newcommit');
    expect(waiting.countdown).toBe(WAITING_DURATION_MS);
  });

  it('phase is WAITING', () => {
    let state = createInitialState('abc');
    state = { ...state, chainSeed: 'seed', drandRound: 1, drandRandomness: 'rand' };
    state = handleCrash(state, Date.now()).state;
    const { state: waiting } = transitionToWaiting(state, 'newcommit');
    expect(waiting.phase).toBe('WAITING');
  });

  it('broadcasts state message with empty players array', () => {
    let state = createInitialState('abc');
    state = { ...state, chainSeed: 'seed', drandRound: 1, drandRandomness: 'rand' };
    state = handleCrash(state, Date.now()).state;
    const { messages } = transitionToWaiting(state, 'newcommit');

    expect(messages).toHaveLength(1);
    expect(messages[0].broadcast).toBe(true);
    if (messages[0].broadcast && messages[0].message.type === 'state') {
      expect(messages[0].message.players).toEqual([]);
      expect(messages[0].message.phase).toBe('WAITING');
    }
  });

  it('uses the new chain commitment', () => {
    const state = createInitialState('oldcommit');
    const { state: waiting } = transitionToWaiting(state, 'freshcommit');
    expect(waiting.chainCommitment).toBe('freshcommit');
  });
});

// ─── Behavioral parity: O(n²) → O(n) fix (High-7) ───────────────────────────
//
// These tests confirm that handleTick and handleCrash behave correctly when
// processing many players — the pure-function layer used by the O(n) fix in
// crash-game.ts (connectionMap built once, then passed via lookup).

describe('handleTick — auto-cashout behavioral parity (High-7)', () => {
  it('all players with met auto-cashout targets are cashed out in a single tick', () => {
    const nowMs = 1_000_000;
    const state = createInitialState('abc');
    // Ten players each with autoCashout = 2.0
    let s = state;
    for (let i = 1; i <= 10; i++) {
      const { state: next } = handleJoin(
        s,
        { playerId: `player${i}`, wager: 10, autoCashout: 2.0 },
        `conn${i}`,
      );
      s = next;
    }
    const running = handleStartingComplete(
      s,
      {
        crashPoint: 5.0,
        chainSeed: 'seed',
        drandRound: 1,
        drandRandomness: 'rand',
        nextChainCommitment: 'next',
      },
      nowMs,
    ).state;

    const GROWTH_RATE = 0.00006;
    const elapsed = Math.log(2.1) / GROWTH_RATE; // ~12397ms — past 2.0x threshold
    const { state: afterTick, messages } = handleTick(running, nowMs + elapsed);

    // All 10 players should have auto-cashed out
    for (let i = 1; i <= 10; i++) {
      expect(afterTick.players.get(`player${i}`)?.cashedOut).toBe(true);
      expect(afterTick.players.get(`player${i}`)?.cashoutMultiplier).toBe(2.0);
    }
    const cashoutMsgs = messages.filter((m) => m.broadcast && m.message.type === 'playerCashedOut');
    expect(cashoutMsgs).toHaveLength(10);
  });

  it('players below their auto-cashout threshold are not cashed out', () => {
    const nowMs = 1_000_000;
    const state = createInitialState('abc');
    let s = state;
    for (let i = 1; i <= 5; i++) {
      // alternating thresholds: odd → 2.0 (triggered), even → 4.0 (not triggered)
      const autoCashout = i % 2 === 1 ? 2.0 : 4.0;
      const { state: next } = handleJoin(
        s,
        { playerId: `player${i}`, wager: 10, autoCashout },
        `conn${i}`,
      );
      s = next;
    }
    const running = handleStartingComplete(
      s,
      {
        crashPoint: 5.0,
        chainSeed: 'seed',
        drandRound: 1,
        drandRandomness: 'rand',
        nextChainCommitment: 'next',
      },
      nowMs,
    ).state;

    const GROWTH_RATE = 0.00006;
    const elapsed = Math.log(2.1) / GROWTH_RATE; // past 2.0x, not yet 4.0x
    const { state: afterTick } = handleTick(running, nowMs + elapsed);

    // Odd-indexed players (1, 3, 5) should have cashed out; even (2, 4) should not
    expect(afterTick.players.get('player1')?.cashedOut).toBe(true);
    expect(afterTick.players.get('player2')?.cashedOut).toBe(false);
    expect(afterTick.players.get('player3')?.cashedOut).toBe(true);
    expect(afterTick.players.get('player4')?.cashedOut).toBe(false);
    expect(afterTick.players.get('player5')?.cashedOut).toBe(true);
  });

  it('playerCashedOut messages carry the correct player connection id', () => {
    const nowMs = 1_000_000;
    const state = createInitialState('abc');
    const { state: s1 } = handleJoin(
      state,
      { playerId: 'alice', wager: 100, autoCashout: 2.0 },
      'conn-alice',
    );
    const { state: s2 } = handleJoin(
      s1,
      { playerId: 'bob', wager: 50, autoCashout: 2.0 },
      'conn-bob',
    );
    const running = handleStartingComplete(
      s2,
      {
        crashPoint: 5.0,
        chainSeed: 'seed',
        drandRound: 1,
        drandRandomness: 'rand',
        nextChainCommitment: 'next',
      },
      nowMs,
    ).state;

    const GROWTH_RATE = 0.00006;
    const elapsed = Math.log(2.1) / GROWTH_RATE;
    const { messages } = handleTick(running, nowMs + elapsed);

    const cashoutMsgs = messages.filter((m) => m.broadcast && m.message.type === 'playerCashedOut');
    expect(cashoutMsgs).toHaveLength(2);

    const ids = cashoutMsgs
      .filter((m) => m.broadcast && m.message.type === 'playerCashedOut')
      .map((m) => (m.message as { type: 'playerCashedOut'; id: string }).id);
    expect(ids).toContain('conn-alice');
    expect(ids).toContain('conn-bob');
  });
});

describe('handleCrash — behavioral parity (High-7)', () => {
  it('all non-cashed-out players have payout = 0 regardless of player count', () => {
    const nowMs = 1_000_000;
    const state = createInitialState('abc');
    let s = state;
    for (let i = 1; i <= 20; i++) {
      const { state: next } = handleJoin(
        s,
        { playerId: `player${i}`, wager: 10, autoCashout: null },
        `conn${i}`,
      );
      s = next;
    }
    const running = handleStartingComplete(
      s,
      {
        crashPoint: 2.0,
        chainSeed: 'seed',
        drandRound: 1,
        drandRandomness: 'rand',
        nextChainCommitment: 'next',
      },
      nowMs,
    ).state;
    const { state: crashed } = handleCrash(running, nowMs + 5000);

    for (let i = 1; i <= 20; i++) {
      expect(crashed.players.get(`player${i}`)?.payout).toBe(0);
    }
  });

  it('mixed cashed-out and non-cashed-out players retain correct payouts after crash', () => {
    const nowMs = 1_000_000;
    const state = createInitialState('abc');
    let s = state;
    // Players 1-5 get autoCashout, players 6-10 do not
    for (let i = 1; i <= 10; i++) {
      const autoCashout = i <= 5 ? 2.0 : null;
      const { state: next } = handleJoin(
        s,
        { playerId: `player${i}`, wager: 100, autoCashout },
        `conn${i}`,
      );
      s = next;
    }
    const running = handleStartingComplete(
      s,
      {
        crashPoint: 3.0,
        chainSeed: 'seed',
        drandRound: 1,
        drandRandomness: 'rand',
        nextChainCommitment: 'next',
      },
      nowMs,
    ).state;

    // Tick past 2.0x so players 1-5 auto-cashout
    const GROWTH_RATE = 0.00006;
    const elapsed = Math.log(2.1) / GROWTH_RATE;
    const { state: afterTick } = handleTick(running, nowMs + elapsed);

    // Then crash
    const { state: crashed } = handleCrash(afterTick, nowMs + elapsed + 1000);

    // Players 1-5 should retain their cashout payout (floor(100 * 2.0 * 100)/100 = 200)
    for (let i = 1; i <= 5; i++) {
      expect(crashed.players.get(`player${i}`)?.cashedOut).toBe(true);
      expect(crashed.players.get(`player${i}`)?.payout).toBe(200);
    }
    // Players 6-10 should have payout = 0 (lost)
    for (let i = 6; i <= 10; i++) {
      expect(crashed.players.get(`player${i}`)?.payout).toBe(0);
    }
  });
});

// ─── buildStateSnapshot ───────────────────────────────────────────────────────

describe('buildStateSnapshot', () => {
  it('returns expected structure during WAITING phase', () => {
    const state = createInitialState('testcommit');
    const snapshot = buildStateSnapshot(state);

    expect(snapshot.phase).toBe('WAITING');
    expect(snapshot.roundId).toBe(1);
    expect(snapshot.countdown).toBe(WAITING_DURATION_MS);
    expect(snapshot.multiplier).toBe(1.0);
    expect(snapshot.elapsed).toBe(0);
    expect(snapshot.crashPoint).toBeNull();
    expect(Array.isArray(snapshot.players)).toBe(true);
    expect(snapshot.players).toHaveLength(0);
    expect(snapshot.chainCommitment).toBe('testcommit');
    expect(snapshot.drandRound).toBeNull();
    expect(snapshot.drandRandomness).toBeNull();
    expect(Array.isArray(snapshot.history)).toBe(true);
  });

  it('includes all players in snapshot after joins', () => {
    let state = createInitialState('commit1');
    state = handleJoin(state, { playerId: 'p1', wager: 100, autoCashout: null }, 'conn1').state;
    state = handleJoin(state, { playerId: 'p2', wager: 50, autoCashout: 2.5 }, 'conn2').state;

    const snapshot = buildStateSnapshot(state);

    expect(snapshot.players).toHaveLength(2);
    const p1 = snapshot.players.find((p) => p.playerId === 'p1');
    const p2 = snapshot.players.find((p) => p.playerId === 'p2');
    expect(p1).toBeDefined();
    expect(p1?.wager).toBe(100);
    expect(p2).toBeDefined();
    expect(p2?.autoCashout).toBe(2.5);
  });

  it('does not expose crashPoint during RUNNING phase', () => {
    const nowMs = 1_000_000;
    let state = createInitialState('commit1');
    state = handleStartingComplete(
      state,
      {
        crashPoint: 3.5,
        chainSeed: 'seed',
        drandRound: 1,
        drandRandomness: 'rand',
        nextChainCommitment: 'next',
      },
      nowMs,
    ).state;

    const snapshot = buildStateSnapshot(state);

    expect(snapshot.phase).toBe('RUNNING');
    expect(snapshot.crashPoint).toBeNull();
    expect(snapshot.drandRound).toBeNull();
    expect(snapshot.drandRandomness).toBeNull();
  });

  it('reveals crashPoint, drandRound, drandRandomness during CRASHED phase', () => {
    const nowMs = 1_000_000;
    let state = createInitialState('commit1');
    state = handleStartingComplete(
      state,
      {
        crashPoint: 2.5,
        chainSeed: 'theSeed',
        drandRound: 42,
        drandRandomness: 'theRand',
        nextChainCommitment: 'next',
      },
      nowMs,
    ).state;
    state = handleCrash(state, nowMs + 5000).state;

    const snapshot = buildStateSnapshot(state);

    expect(snapshot.phase).toBe('CRASHED');
    expect(snapshot.crashPoint).toBe(2.5);
    expect(snapshot.drandRound).toBe(42);
    expect(snapshot.drandRandomness).toBe('theRand');
  });

  it('snapshot after playerJoined includes the new player', () => {
    // This validates behavioral parity: a connection joining after a playerJoined event
    // should see the joined player in the snapshot.
    let state = createInitialState('commit1');
    state = handleJoin(state, { playerId: 'p1', wager: 100, autoCashout: null }, 'conn1').state;

    const snapshot = buildStateSnapshot(state);

    expect(snapshot.players).toHaveLength(1);
    expect(snapshot.players[0].playerId).toBe('p1');
  });

  it('snapshot after cashout shows player as cashed out', () => {
    const nowMs = 1_000_000;
    let state = createInitialState('commit1');
    state = handleJoin(state, { playerId: 'p1', wager: 100, autoCashout: null }, 'conn1').state;
    state = handleStartingComplete(
      state,
      {
        crashPoint: 5.0,
        chainSeed: 'seed',
        drandRound: 1,
        drandRandomness: 'rand',
        nextChainCommitment: 'next',
      },
      nowMs,
    ).state;
    state = handleCashout(state, 'p1', nowMs + 5000).state;

    const snapshot = buildStateSnapshot(state);

    const p1 = snapshot.players.find((p) => p.playerId === 'p1');
    expect(p1?.cashedOut).toBe(true);
    expect(p1?.cashoutMultiplier).not.toBeNull();
  });

  it('snapshot reflects updated state after transitionToWaiting (empty players)', () => {
    let state = createInitialState('commit1');
    state = handleJoin(state, { playerId: 'p1', wager: 100, autoCashout: null }, 'conn1').state;
    state = { ...state, chainSeed: 'seed', drandRound: 1, drandRandomness: 'rand' };
    state = handleCrash(state, Date.now()).state;
    state = transitionToWaiting(state, 'newcomm').state;

    const snapshot = buildStateSnapshot(state);

    expect(snapshot.players).toHaveLength(0);
    expect(snapshot.phase).toBe('WAITING');
  });
});

// ─── Round lifecycle integration test ────────────────────────────────────────

describe('round lifecycle', () => {
  it('full round lifecycle: WAITING → join → countdown → STARTING → RUNNING → auto-cashout → crash → WAITING', async () => {
    // 1. Create initial state
    let state = createInitialState('commitment123');

    // 2. Two players join
    const r1 = handleJoin(
      state,
      { playerId: 'p1', wager: 100, autoCashout: 2.0, name: 'Alice' },
      'c1',
    );
    state = r1.state;
    const r2 = handleJoin(
      state,
      { playerId: 'p2', wager: 50, autoCashout: null, name: 'Bob' },
      'c2',
    );
    state = r2.state;
    expect(state.players.size).toBe(2);

    // 3. Countdown to STARTING
    for (let i = 0; i < 10; i++) {
      const r = handleCountdownTick(state);
      state = r.state;
    }
    expect(state.phase).toBe('STARTING');

    // 4. STARTING → RUNNING with crashPoint = 3.0 (so auto-cashout at 2x triggers)
    const now = Date.now();
    const r3 = handleStartingComplete(
      state,
      {
        crashPoint: 3.0,
        chainSeed: 'seed123',
        drandRound: 100,
        drandRandomness: 'rand456',
        nextChainCommitment: 'nextcommit',
      },
      now,
    );
    state = r3.state;
    expect(state.phase).toBe('RUNNING');

    // 5. Tick past auto-cashout target (2x) — compute elapsed where multiplier > 2.0
    // multiplierAtTime(elapsed) > 2.0 → elapsed > ln(2)/0.00006 ≈ 11553ms
    const elapsed = Math.log(2.1) / 0.00006; // ~12397ms
    const tickTime = now + elapsed;
    const r4 = handleTick(state, tickTime);
    state = r4.state;
    // Player 1 should have auto-cashed out at 2.0x
    expect(state.players.get('p1')?.cashedOut).toBe(true);
    expect(state.players.get('p1')?.cashoutMultiplier).toBe(2.0);
    expect(state.players.get('p1')?.payout).toBe(200); // floor(100 * 2.0 * 100) / 100 = 200

    // 6. Crash
    const r5 = handleCrash(state, tickTime + 1000);
    state = r5.state;
    expect(state.phase).toBe('CRASHED');
    expect(state.players.get('p2')?.payout).toBe(0); // Bob didn't cash out

    // 7. Transition to WAITING
    const r6 = transitionToWaiting(state, 'newcommit');
    state = r6.state;
    expect(state.phase).toBe('WAITING');
    expect(state.roundId).toBe(2);
    expect(state.players.size).toBe(0);
  });
});
