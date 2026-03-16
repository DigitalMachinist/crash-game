import { beforeEach, describe, expect, it, vi } from 'vitest';
import { myPlayerId } from '../stores';

// ─── Mock socket module ───────────────────────────────────────────────────────

const mockSend = vi.fn();
let mockSocketInstance: { send: typeof mockSend } | null = { send: mockSend };

vi.mock('../socket', () => ({
  getSocket: () => mockSocketInstance,
}));

// ─── Import after mock ────────────────────────────────────────────────────────

const { sendJoin, sendCashout } = await import('../commands');

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockSend.mockClear();
  mockSocketInstance = { send: mockSend };
  myPlayerId.set('');
});

describe('sendJoin()', () => {
  it('sends a join message with the correct structure', () => {
    myPlayerId.set('player-uuid-123');
    sendJoin(100, 'Alice', null);
    expect(mockSend).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(mockSend.mock.calls[0]![0] as string);
    expect(sent).toEqual({
      type: 'join',
      playerId: 'player-uuid-123',
      wager: 100,
      name: 'Alice',
      autoCashout: null,
    });
  });

  it('includes autoCashout when provided', () => {
    myPlayerId.set('player-uuid-456');
    sendJoin(50, 'Bob', 2.5);
    const sent = JSON.parse(mockSend.mock.calls[0]![0] as string);
    expect(sent.autoCashout).toBe(2.5);
  });

  it('uses the current value of myPlayerId from the store', () => {
    myPlayerId.set('store-player-id');
    sendJoin(10, 'Carol', null);
    const sent = JSON.parse(mockSend.mock.calls[0]![0] as string);
    expect(sent.playerId).toBe('store-player-id');
  });

  it('does nothing if socket is null', () => {
    mockSocketInstance = null;
    sendJoin(100, 'Alice', null);
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe('sendCashout()', () => {
  it('sends a cashout message', () => {
    sendCashout();
    expect(mockSend).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(mockSend.mock.calls[0]![0] as string);
    expect(sent).toEqual({ type: 'cashout' });
  });

  it('does nothing if socket is null', () => {
    mockSocketInstance = null;
    sendCashout();
    expect(mockSend).not.toHaveBeenCalled();
  });
});
