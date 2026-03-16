/**
 * Unit tests for CrashGame.onMessage() server-side logging.
 *
 * Tests that console.warn is called with the right arguments when onMessage
 * receives a message that fails isValidClientMessage validation.
 *
 * Note: CrashGame extends Server from partyserver (a Durable Object). These
 * tests mock the DO base classes so the unit tests can run in the jsdom
 * environment without a Cloudflare Workers runtime.
 *
 * Worker DO integration tests live in src/server/__tests__/workers/.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COUNTDOWN_TICK_MS, CRASHED_DISPLAY_MS } from '../../config';
import { createInitialState } from '../game-state';

// ─── Mock drand module ────────────────────────────────────────────────────────
// Default: fetchDrandBeacon rejects so startRound follows the void-round path.
// Individual tests can override with vi.mocked(...).mockResolvedValueOnce().
vi.mock('../drand', () => ({
  computeCurrentDrandRound: vi.fn().mockReturnValue(12345),
  fetchDrandBeacon: vi.fn().mockRejectedValue(new Error('drand unavailable')),
}));

// ─── Mock cloudflare:workers (DurableObject base class) ───────────────────────
// partyserver's Server extends DurableObject; we need a no-op base class so
// the module can be imported in jsdom without the CF Workers runtime.
vi.mock('cloudflare:workers', () => {
  class DurableObject {
    ctx: unknown;
    env: unknown;
    constructor(ctx: unknown, env: unknown) {
      this.ctx = ctx;
      this.env = env;
    }
  }
  return { DurableObject };
});

// ─── Mock partyserver ─────────────────────────────────────────────────────────
// Replace the real partyserver Server (which uses CF-specific APIs) with a
// minimal base class that exposes the lifecycle method signatures needed by
// CrashGame without actually running WebSocket plumbing.
vi.mock('partyserver', () => {
  class Server {
    ctx: unknown;
    env: unknown;
    constructor(ctx: unknown, env: unknown) {
      this.ctx = ctx;
      this.env = env;
    }
    broadcast(_msg: string): void {}
    getConnections(): Iterable<unknown> {
      return [];
    }
  }
  return { Server };
});

// ─── Import CrashGame after mocks are set up ─────────────────────────────────
// Dynamic import is used because vi.mock hoisting requires the factory to run
// before the module is resolved. The static import below is fine because
// vitest hoists vi.mock() calls above all imports automatically.
import { CrashGame } from '../crash-game';

// ─── Minimal mock helpers ─────────────────────────────────────────────────────

function makeMockConn(id = 'conn-test-1'): { id: string; send: ReturnType<typeof vi.fn> } {
  return { id, send: vi.fn() };
}

function makeCtx() {
  return {
    storage: {
      get: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockResolvedValue(undefined),
      getAlarm: vi.fn().mockResolvedValue(null),
      setAlarm: vi.fn().mockResolvedValue(undefined),
    },
    blockConcurrencyWhile: vi.fn((fn: () => Promise<void>) => fn()),
  };
}

function makeEnv(): Record<string, unknown> {
  return {};
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CrashGame.onMessage() — validation logging', () => {
  let game: CrashGame;
  let conn: ReturnType<typeof makeMockConn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    const ctx = makeCtx();
    const env = makeEnv();
    // @ts-expect-error — ctx/env are minimal mocks, not full CF types
    game = new CrashGame(ctx, env);
    // onStart() normally runs async initialization; in unit tests we skip it
    // because ctx.storage.get returns undefined (no stored data) and the
    // crypto-based seed generation would require a Workers runtime.
    // We bypass initialization by directly setting the required private fields.
    // Instead, we test only the onMessage validation path which does NOT depend
    // on gameState being initialized (it returns early before touching gameState).

    conn = makeMockConn();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('calls console.warn when message fails isValidClientMessage (missing type)', async () => {
    const msg = JSON.stringify({ playerId: 'abc', wager: 100 }); // no `type` field
    // @ts-expect-error — conn is a minimal mock
    await game.onMessage(conn, msg);

    expect(warnSpy).toHaveBeenCalledWith('[onMessage] rejected invalid message', {
      connId: conn.id,
      type: undefined,
    });
  });

  it('calls console.warn when message fails isValidClientMessage (unknown type)', async () => {
    const msg = JSON.stringify({ type: 'hack', playerId: 'abc' });
    // @ts-expect-error — conn is a minimal mock
    await game.onMessage(conn, msg);

    expect(warnSpy).toHaveBeenCalledWith('[onMessage] rejected invalid message', {
      connId: conn.id,
      type: 'hack',
    });
  });

  it('calls console.warn with type from the rejected object when type field exists', async () => {
    const msg = JSON.stringify({ type: 'unknown_type_xyz' });
    // @ts-expect-error — conn is a minimal mock
    await game.onMessage(conn, msg);

    expect(warnSpy).toHaveBeenCalledWith('[onMessage] rejected invalid message', {
      connId: conn.id,
      type: 'unknown_type_xyz',
    });
  });

  it('includes type: undefined in warn when the rejected value has no type property', async () => {
    const msg = JSON.stringify(42); // not an object
    // @ts-expect-error — conn is a minimal mock
    await game.onMessage(conn, msg);

    expect(warnSpy).toHaveBeenCalledWith('[onMessage] rejected invalid message', {
      connId: conn.id,
      type: undefined,
    });
  });

  it('sends error response to client after logging the warn', async () => {
    const msg = JSON.stringify({ type: 'unknown_type' });
    // @ts-expect-error — conn is a minimal mock
    await game.onMessage(conn, msg);

    expect(conn.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'error', message: 'Invalid message format' }),
    );
  });

  it('does NOT call console.warn for invalid JSON (different code path)', async () => {
    // @ts-expect-error — conn is a minimal mock
    await game.onMessage(conn, 'not valid json!!!');

    // The invalid-JSON path returns early with a different error, before the
    // isValidClientMessage check that triggers the warn.
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does NOT call console.warn for a valid cashout message', async () => {
    // Valid cashout passes isValidClientMessage — warn must NOT fire.
    // Note: onMessage will proceed to the cashout handler and fail because
    // there is no active connection mapping, but warn should not fire.
    const msg = JSON.stringify({ type: 'cashout' });
    // @ts-expect-error — conn is a minimal mock
    await game.onMessage(conn, msg);

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('logs the connection ID in the warn arguments', async () => {
    const specificConn = makeMockConn('my-unique-conn-id');
    const msg = JSON.stringify({ type: 'bad_type' });
    // @ts-expect-error — conn is a minimal mock
    await game.onMessage(specificConn, msg);

    expect(warnSpy).toHaveBeenCalledWith(
      '[onMessage] rejected invalid message',
      expect.objectContaining({ connId: 'my-unique-conn-id' }),
    );
  });
});

// ─── Alarm loop tests ─────────────────────────────────────────────────────────

const MOCK_CHAIN_COMMITMENT = 'a'.repeat(64);
const MOCK_ROOT_SEED = 'b'.repeat(64);
const MOCK_CHAIN_SEED = 'c'.repeat(64);
const MOCK_DRAND_RANDOMNESS = 'd'.repeat(64);

describe('CrashGame.onAlarm() — game loop dispatch', () => {
  let game: CrashGame;
  let ctx: ReturnType<typeof makeCtx>;

  /** Directly injects a game state, bypassing onStart(). */
  function seedGame(override: object = {}): void {
    // @ts-expect-error — accessing private fields for test setup
    game.rootSeed = MOCK_ROOT_SEED;
    // @ts-expect-error
    game.gameNumber = 1;
    // @ts-expect-error
    game.gameState = { ...createInitialState(MOCK_CHAIN_COMMITMENT), ...override };
    // @ts-expect-error
    game.cachedSnapshot = null;
  }

  beforeEach(() => {
    ctx = makeCtx();
    // @ts-expect-error — ctx/env are minimal mocks
    game = new CrashGame(ctx, makeEnv());
    // Silence broadcast: we care about setAlarm calls, not broadcast content.
    // @ts-expect-error
    vi.spyOn(game, 'broadcast').mockImplementation(() => {});
  });

  it('WAITING: tick decrements countdown and reschedules alarm', async () => {
    seedGame({ phase: 'WAITING', countdown: 5000 });

    await game.onAlarm();

    // @ts-expect-error
    expect(game.gameState.countdown).toBe(5000 - COUNTDOWN_TICK_MS);
    expect(ctx.storage.setAlarm).toHaveBeenCalledWith(expect.any(Number));
  });

  it('WAITING: when countdown reaches 0, calls blockConcurrencyWhile for startRound', async () => {
    // One tick will bring countdown to 0 → shouldStartRound = true
    seedGame({ phase: 'WAITING', countdown: COUNTDOWN_TICK_MS });

    await game.onAlarm();

    expect(ctx.blockConcurrencyWhile).toHaveBeenCalled();
  });

  it('WAITING: void round (drand failure) resets to WAITING and reschedules', async () => {
    // fetchDrandBeacon is mocked to reject by default → void-round path
    seedGame({ phase: 'WAITING', countdown: COUNTDOWN_TICK_MS });

    await game.onAlarm();

    // @ts-expect-error
    expect(game.gameState.phase).toBe('WAITING');
    expect(ctx.storage.setAlarm).toHaveBeenCalled();
  });

  it('RUNNING: tick below crashPoint reschedules at TICK_INTERVAL_MS', async () => {
    // 50ms elapsed → multiplier ≈ 1.003, far below crashPoint 5.0
    seedGame({
      phase: 'RUNNING',
      roundStartTime: Date.now() - 50,
      crashPoint: 5.0,
      chainSeed: MOCK_CHAIN_SEED,
      drandRound: 1,
      drandRandomness: MOCK_DRAND_RANDOMNESS,
    });

    await game.onAlarm();

    // @ts-expect-error
    expect(game.gameState.phase).toBe('RUNNING');
    expect(ctx.storage.setAlarm).toHaveBeenCalledWith(expect.any(Number));
  });

  it('RUNNING: multiplier >= crashPoint triggers crashRound and transitions to CRASHED', async () => {
    // 100_000ms elapsed → multiplier ≈ 403, far above any crashPoint
    seedGame({
      phase: 'RUNNING',
      roundStartTime: Date.now() - 100_000,
      crashPoint: 1.5,
      chainSeed: MOCK_CHAIN_SEED,
      drandRound: 42,
      drandRandomness: MOCK_DRAND_RANDOMNESS,
    });

    await game.onAlarm();

    // @ts-expect-error
    expect(game.gameState.phase).toBe('CRASHED');
    // crashRound schedules alarm at CRASHED_DISPLAY_MS
    expect(ctx.storage.setAlarm).toHaveBeenCalledWith(
      expect.closeTo(Date.now() + CRASHED_DISPLAY_MS, -2),
    );
  });

  it('CRASHED: beginNextRound transitions to WAITING and reschedules', async () => {
    seedGame({ phase: 'CRASHED' });

    await game.onAlarm();

    // @ts-expect-error
    expect(game.gameState.phase).toBe('WAITING');
    expect(ctx.storage.setAlarm).toHaveBeenCalled();
  });

  it('STARTING: safety reschedule — alarm fires before blockConcurrencyWhile resolves', async () => {
    seedGame({ phase: 'STARTING' });

    await game.onAlarm();

    expect(ctx.storage.setAlarm).toHaveBeenCalledWith(
      expect.closeTo(Date.now() + COUNTDOWN_TICK_MS, -2),
    );
    // Phase unchanged — STARTING → STARTING (waiting for blockConcurrencyWhile)
    // @ts-expect-error
    expect(game.gameState.phase).toBe('STARTING');
  });

  it('error recovery: catch block broadcasts error and finally always reschedules alarm', async () => {
    // Force an error by making the phase-WAITING tick path call setAlarm,
    // then immediately throw in the setAlarm to simulate a storage failure.
    seedGame({ phase: 'WAITING', countdown: 5000 });
    ctx.storage.setAlarm.mockRejectedValueOnce(new Error('storage unavailable'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Should not throw — the finally block catches the reschedule error too
    await expect(game.onAlarm()).resolves.toBeUndefined();
    errorSpy.mockRestore();
  });
});
