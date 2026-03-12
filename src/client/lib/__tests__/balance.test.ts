import { beforeEach, describe, expect, it } from 'vitest';
import { CLIENT_HISTORY_LIMIT } from '../../../config';
import type { RoundResult } from '../../../types';
import {
  addHistoryEntry,
  applyBet,
  applyCashout,
  getBalance,
  getHistory,
  getOrCreatePlayerId,
  hasPendingResult,
} from '../balance';

function makeRoundResult(roundId: number): RoundResult {
  return {
    roundId,
    wager: 10,
    payout: 0,
    cashoutMultiplier: null,
    crashPoint: 1.5,
    timestamp: Date.now(),
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('getOrCreatePlayerId', () => {
  it('returns a UUID v4 on first call', () => {
    const id = getOrCreatePlayerId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('returns the same value on second call', () => {
    const first = getOrCreatePlayerId();
    const second = getOrCreatePlayerId();
    expect(second).toBe(first);
  });

  it('returns a different value after clearing storage', () => {
    const first = getOrCreatePlayerId();
    localStorage.clear();
    const second = getOrCreatePlayerId();
    expect(second).not.toBe(first);
  });
});

describe('getBalance', () => {
  it('returns 0 when absent', () => {
    expect(getBalance()).toBe(0);
  });

  it('returns stored value', () => {
    localStorage.setItem('crashBalance', '123.45');
    expect(getBalance()).toBe(123.45);
  });

  it('returns 0 on corrupted value', () => {
    localStorage.setItem('crashBalance', 'notanumber');
    expect(getBalance()).toBe(0);
  });
});

describe('applyBet', () => {
  it('reduces balance by wager', () => {
    localStorage.setItem('crashBalance', '100');
    applyBet(30);
    expect(getBalance()).toBe(70);
  });

  it('can go negative', () => {
    localStorage.setItem('crashBalance', '10');
    const result = applyBet(25);
    expect(result).toBe(-15);
    expect(getBalance()).toBe(-15);
  });

  it('persists the new balance', () => {
    localStorage.setItem('crashBalance', '50');
    applyBet(10);
    expect(localStorage.getItem('crashBalance')).toBe('40');
  });

  it('returns the new balance', () => {
    localStorage.setItem('crashBalance', '100');
    const result = applyBet(40);
    expect(result).toBe(60);
  });
});

describe('applyCashout', () => {
  it('increases balance by payout', () => {
    localStorage.setItem('crashBalance', '50');
    applyCashout(25);
    expect(getBalance()).toBe(75);
  });

  it('persists the new balance', () => {
    localStorage.setItem('crashBalance', '50');
    applyCashout(25);
    expect(localStorage.getItem('crashBalance')).toBe('75');
  });

  it('returns the new balance', () => {
    localStorage.setItem('crashBalance', '50');
    const result = applyCashout(25);
    expect(result).toBe(75);
  });
});

describe('addHistoryEntry', () => {
  it('prepends entry so newest is first', () => {
    const first = makeRoundResult(1);
    const second = makeRoundResult(2);
    addHistoryEntry(first);
    addHistoryEntry(second);
    const history = getHistory();
    expect(history[0]!.roundId).toBe(2);
    expect(history[1]!.roundId).toBe(1);
  });

  it('trims to CLIENT_HISTORY_LIMIT entries when adding beyond the limit', () => {
    for (let i = 0; i < CLIENT_HISTORY_LIMIT + 1; i++) {
      addHistoryEntry(makeRoundResult(i));
    }
    const history = getHistory();
    expect(history.length).toBe(CLIENT_HISTORY_LIMIT);
  });
});

describe('hasPendingResult', () => {
  it('returns false for unknown roundId', () => {
    expect(hasPendingResult(999)).toBe(false);
  });

  it('returns true after addHistoryEntry for that roundId', () => {
    addHistoryEntry(makeRoundResult(42));
    expect(hasPendingResult(42)).toBe(true);
  });
});
