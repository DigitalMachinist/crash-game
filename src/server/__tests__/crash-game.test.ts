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
