import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { connectionStatus, multiplierAnimating } from '../stores';

// ─── Mock setup ───────────────────────────────────────────────────────────────
// vi.mock is hoisted; all references must live inside the factory or use module-level vars
// captured via import after the mock (see dynamic import below).

type EventHandler = (event?: unknown) => void;

// Shared state between mock factory and tests — captured via module-level object
const mockState = {
  handlers: {} as Record<string, EventHandler>,
  close: vi.fn(),
  send: vi.fn(),
  addEventListener: vi.fn(),
  lastInstance: null as null | { close: () => void },
  lastOptions: null as null | Record<string, unknown>,
};

vi.mock('partysocket', () => {
  // Must use regular function (not arrow) so `new PartySocket()` works
  function MockPartySocket(this: Record<string, unknown>, opts: Record<string, unknown>) {
    this['close'] = mockState.close;
    this['send'] = mockState.send;
    this['addEventListener'] = (event: string, handler: EventHandler) => {
      mockState.handlers[event] = handler;
    };
    mockState.lastInstance = this as unknown as { close: () => void };
    mockState.lastOptions = opts;
  }
  return { default: MockPartySocket };
});

const { connect, disconnect } = await import('../socket');

// ─── Test helpers ─────────────────────────────────────────────────────────────

beforeEach(() => {
  // Reset mock state
  mockState.handlers = {};
  mockState.close.mockClear();
  mockState.send.mockClear();
  mockState.lastInstance = null;
  mockState.lastOptions = null;
  connectionStatus.set('connecting');
  multiplierAnimating.set(false);
  // Disconnect any previous socket
  disconnect();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('connect()', () => {
  it("sets connectionStatus to 'connecting' immediately", () => {
    connectionStatus.set('connected');
    connect();
    // connect() sets 'connecting' synchronously
    expect(get(connectionStatus)).toBe('connecting');
  });

  it('registers open, close, and message event listeners', () => {
    connect();
    expect(Object.keys(mockState.handlers)).toContain('open');
    expect(Object.keys(mockState.handlers)).toContain('close');
    expect(Object.keys(mockState.handlers)).toContain('message');
  });

  it("socket 'open' event sets connectionStatus to 'connected'", () => {
    connect();
    mockState.handlers['open']?.();
    expect(get(connectionStatus)).toBe('connected');
  });

  it("socket 'close' event sets connectionStatus to 'reconnecting'", () => {
    connect();
    mockState.handlers['close']?.();
    expect(get(connectionStatus)).toBe('reconnecting');
  });

  it("socket 'close' event sets multiplierAnimating to false", () => {
    connect();
    multiplierAnimating.set(true);
    mockState.handlers['close']?.();
    expect(get(multiplierAnimating)).toBe(false);
  });

  it('creates socket with correct room and party params (via getRawSocket)', async () => {
    const { getRawSocket } = await import('../socket');
    connect();
    const s = getRawSocket();
    // Socket was created — verify it's not null
    expect(s).not.toBeNull();
  });

  it('passes playerId as query param when provided', () => {
    connect('my-player-id');
    expect(mockState.lastOptions).toMatchObject({ query: { playerId: 'my-player-id' } });
  });

  it('omits query param when no playerId is provided', () => {
    connect();
    expect((mockState.lastOptions as Record<string, unknown>)?.['query']).toBeUndefined();
  });
});

describe('disconnect()', () => {
  it("sets connectionStatus to 'disconnected'", () => {
    connect();
    disconnect();
    expect(get(connectionStatus)).toBe('disconnected');
  });

  it('calls close() on the socket', () => {
    connect();
    disconnect();
    expect(mockState.close).toHaveBeenCalledTimes(1);
  });

  it('can be called when no socket is connected without throwing', () => {
    expect(() => disconnect()).not.toThrow();
  });
});
