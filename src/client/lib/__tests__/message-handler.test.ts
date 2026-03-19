import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';
import type { GameStateSnapshot } from '../../../types';
import { makeGameState, makePlayer } from '../../__tests__/factories';
import { dispatchMessage } from '../message-handler';
import {
  balance,
  displayMultiplier,
  gameState,
  history,
  lastCrashResult,
  lastError,
  lastPendingPayout,
  latency,
  multiplierAnimating,
  myPlayerId,
  players,
} from '../stores';

beforeEach(() => {
  gameState.set(null);
  players.set({});
  displayMultiplier.set(1.0);
  multiplierAnimating.set(false);
  history.set([]);
  myPlayerId.set('');
  balance.set(0);
  lastCrashResult.set(null);
  lastPendingPayout.set(null);
  lastError.set(null);
  latency.set(null);
  localStorage.clear();
});

describe("dispatchMessage — 'state'", () => {
  it('updates gameState with the snapshot', () => {
    const state = makeGameState({ phase: 'WAITING', roundId: 10 });
    dispatchMessage({ type: 'state', ...state });
    const gs = get(gameState);
    expect(gs?.phase).toBe('WAITING');
    expect(gs?.roundId).toBe(10);
  });

  it('converts players array to Record keyed by playerId', () => {
    const p1 = makePlayer({ playerId: 'p1', id: 'conn-1', name: 'Alice' });
    const p2 = makePlayer({ playerId: 'p2', id: 'conn-2', name: 'Bob' });
    const state = makeGameState({ players: [p1, p2] });
    dispatchMessage({ type: 'state', ...state });
    const ps = get(players);
    expect(ps['p1']).toEqual(p1);
    expect(ps['p2']).toEqual(p2);
  });

  it('sets history when provided in snapshot', () => {
    const histEntry = {
      roundId: 1,
      crashPoint: 2.5,
      roundSeed: 'seed123',
      drandRound: 50,
      drandRandomness: 'rand123',
      chainCommitment: 'chain123',
    };
    const state = makeGameState({ history: [histEntry] });
    dispatchMessage({ type: 'state', ...state });
    expect(get(history)).toEqual([histEntry]);
  });

  it('deduplicates history entries by roundId, keeping first occurrence', () => {
    const entry1 = {
      roundId: 1,
      crashPoint: 2.5,
      roundSeed: 'seed-1',
      drandRound: 50,
      drandRandomness: 'rand-1',
      chainCommitment: 'chain-1',
    };
    const entry2 = {
      roundId: 2,
      crashPoint: 3.0,
      roundSeed: 'seed-2',
      drandRound: 51,
      drandRandomness: 'rand-2',
      chainCommitment: 'chain-2',
    };
    const duplicate1 = {
      roundId: 1,
      crashPoint: 9.99,
      roundSeed: 'seed-dup',
      drandRound: 999,
      drandRandomness: 'rand-dup',
      chainCommitment: 'chain-dup',
    };
    const state = makeGameState({ history: [entry1, entry2, duplicate1] });
    dispatchMessage({ type: 'state', ...state });
    const h = get(history);
    expect(h).toHaveLength(2);
    expect(h[0]).toEqual(entry1);
    expect(h[1]).toEqual(entry2);
  });

  it('overwrites existing players Record on each state message', () => {
    players.set({ old: makePlayer({ playerId: 'old' }) });
    const state = makeGameState({ players: [makePlayer({ playerId: 'new-player' })] });
    dispatchMessage({ type: 'state', ...state });
    const ps = get(players);
    expect('old' in ps).toBe(false);
    expect('new-player' in ps).toBe(true);
  });
});

describe("dispatchMessage — 'tick'", () => {
  it('sets multiplierAnimating to true', () => {
    dispatchMessage({ type: 'tick', multiplier: 1.5, elapsed: 1000 });
    expect(get(multiplierAnimating)).toBe(true);
  });

  it('updates displayMultiplier', () => {
    dispatchMessage({ type: 'tick', multiplier: 3.14, elapsed: 2000 });
    expect(get(displayMultiplier)).toBe(3.14);
  });
});

describe("dispatchMessage — 'state' with phase CRASHED", () => {
  function makeCrashedState(overrides: Partial<GameStateSnapshot> = {}): GameStateSnapshot {
    return makeGameState({
      phase: 'CRASHED',
      crashPoint: 2.0,
      drandRound: 100,
      drandRandomness: 'rand',
      ...overrides,
    });
  }

  it('sets multiplierAnimating to false', () => {
    multiplierAnimating.set(true);
    dispatchMessage({ type: 'state', ...makeCrashedState() });
    expect(get(multiplierAnimating)).toBe(false);
  });

  it('updates gameState phase to CRASHED', () => {
    dispatchMessage({ type: 'state', ...makeCrashedState() });
    expect(get(gameState)?.phase).toBe('CRASHED');
  });

  it('sets gameState crashPoint to the crash value', () => {
    dispatchMessage({ type: 'state', ...makeCrashedState({ crashPoint: 3.14 }) });
    expect(get(gameState)?.crashPoint).toBe(3.14);
  });

  it('sets displayMultiplier to crashPoint', () => {
    dispatchMessage({ type: 'state', ...makeCrashedState({ crashPoint: 4.55 }) });
    expect(get(displayMultiplier)).toBe(4.55);
  });

  it('sets players Record with final player outcomes', () => {
    const p = makePlayer({
      playerId: 'p1',
      cashedOut: true,
      cashoutMultiplier: 2.0,
      payout: 200,
    });
    dispatchMessage({ type: 'state', ...makeCrashedState({ players: [p] }) });
    expect(get(players)['p1']).toEqual(p);
  });

  it('sets history from the snapshot', () => {
    const histEntry = {
      roundId: 77,
      crashPoint: 3.0,
      roundSeed: 'seed-abc',
      drandRound: 200,
      drandRandomness: 'rand-abc',
      chainCommitment: 'chain-77',
    };
    dispatchMessage({ type: 'state', ...makeCrashedState({ roundId: 77, history: [histEntry] }) });
    const h = get(history);
    expect(h).toHaveLength(1);
    expect(h[0]!.roundId).toBe(77);
    expect(h[0]!.crashPoint).toBe(3.0);
    expect(h[0]!.roundSeed).toBe('seed-abc');
    expect(h[0]!.drandRound).toBe(200);
    expect(h[0]!.drandRandomness).toBe('rand-abc');
    expect(h[0]!.chainCommitment).toBe('chain-77');
  });

  it('sets lastCrashResult store to the snapshot when phase is CRASHED and crashPoint is non-null', () => {
    const state = makeCrashedState({ crashPoint: 3.14 });
    dispatchMessage({ type: 'state', ...state });
    const result = get(lastCrashResult);
    expect(result).not.toBeNull();
    expect(result?.phase).toBe('CRASHED');
    expect(result?.crashPoint).toBe(3.14);
  });

  it('does not set displayMultiplier or set lastCrashResult when crashPoint is null', () => {
    displayMultiplier.set(1.0);
    // Simulate a CRASHED state with null crashPoint (shouldn't happen in practice but guards against it)
    dispatchMessage({ type: 'state', ...makeCrashedState({ crashPoint: null }) });
    expect(get(displayMultiplier)).toBe(1.0);
    expect(get(lastCrashResult)).toBeNull();
  });
});

describe("dispatchMessage — 'playerJoined'", () => {
  it('adds the new player to the players Record', () => {
    dispatchMessage({
      type: 'playerJoined',
      id: 'conn-99',
      playerId: 'p99',
      name: 'Charlie',
      wager: 50,
      autoCashout: 2.0,
    });
    const ps = get(players);
    expect(ps['p99']).toBeDefined();
    expect(ps['p99']!.name).toBe('Charlie');
    expect(ps['p99']!.wager).toBe(50);
    expect(ps['p99']!.cashedOut).toBe(false);
    expect(ps['p99']!.cashoutMultiplier).toBeNull();
    expect(ps['p99']!.payout).toBeNull();
    expect(ps['p99']!.autoCashout).toBe(2.0);
  });

  it('does not remove existing players', () => {
    players.set({ existing: makePlayer({ playerId: 'existing' }) });
    dispatchMessage({
      type: 'playerJoined',
      id: 'conn-100',
      playerId: 'new-p',
      name: 'Dave',
      wager: 25,
      autoCashout: null,
    });
    const ps = get(players);
    expect('existing' in ps).toBe(true);
    expect('new-p' in ps).toBe(true);
  });

  it('deducts balance when the joined player is the local player', () => {
    myPlayerId.set('local-player');
    localStorage.setItem('crashBalance', '100');
    balance.set(100);
    dispatchMessage({
      type: 'playerJoined',
      id: 'conn-local',
      playerId: 'local-player',
      name: 'Me',
      wager: 30,
      autoCashout: null,
    });
    expect(get(balance)).toBe(70);
  });

  it('does not deduct balance for other players joining', () => {
    myPlayerId.set('local-player');
    balance.set(100);
    dispatchMessage({
      type: 'playerJoined',
      id: 'conn-other',
      playerId: 'other-player',
      name: 'Other',
      wager: 30,
      autoCashout: null,
    });
    expect(get(balance)).toBe(100);
  });
});

describe("dispatchMessage — 'playerCashedOut'", () => {
  it('updates the correct player by playerId', () => {
    players.set({
      p1: makePlayer({ playerId: 'p1', id: 'conn-1', cashedOut: false }),
      p2: makePlayer({ playerId: 'p2', id: 'conn-2', cashedOut: false }),
    });
    dispatchMessage({
      type: 'playerCashedOut',
      id: 'conn-1',
      playerId: 'p1',
      multiplier: 2.5,
      payout: 250,
    });
    const ps = get(players);
    expect(ps['p1']!.cashedOut).toBe(true);
    expect(ps['p1']!.cashoutMultiplier).toBe(2.5);
    expect(ps['p1']!.payout).toBe(250);
    // p2 should remain unchanged
    expect(ps['p2']!.cashedOut).toBe(false);
  });

  it('does nothing if playerId is not in players', () => {
    const original = { p1: makePlayer({ playerId: 'p1', id: 'conn-1' }) };
    players.set(original);
    dispatchMessage({
      type: 'playerCashedOut',
      id: 'conn-1',
      playerId: 'p-unknown',
      multiplier: 2.0,
      payout: 200,
    });
    expect(get(players)).toEqual(original);
  });
});

describe("dispatchMessage — 'pendingPayout'", () => {
  it('sets lastPendingPayout store to the message', () => {
    dispatchMessage({
      type: 'pendingPayout',
      roundId: 1,
      wager: 100,
      payout: 200,
      cashoutMultiplier: 2.0,
      crashPoint: 3.0,
    });
    const result = get(lastPendingPayout);
    expect(result).toMatchObject({ roundId: 1, payout: 200 });
  });

  it('does not dispatch a crash:pendingPayout CustomEvent', () => {
    let eventFired = false;
    const handler = () => {
      eventFired = true;
    };
    document.addEventListener('crash:pendingPayout', handler);
    dispatchMessage({
      type: 'pendingPayout',
      roundId: 1,
      wager: 100,
      payout: 200,
      cashoutMultiplier: 2.0,
      crashPoint: 3.0,
    });
    document.removeEventListener('crash:pendingPayout', handler);
    expect(eventFired).toBe(false);
  });
});

describe("dispatchMessage — 'error'", () => {
  it('sets lastError store to the error message string', () => {
    dispatchMessage({ type: 'error', message: 'Something went wrong' });
    expect(get(lastError)).toBe('Something went wrong');
  });

  it('does not dispatch a crash:error CustomEvent', () => {
    let eventFired = false;
    const handler = () => {
      eventFired = true;
    };
    document.addEventListener('crash:error', handler);
    dispatchMessage({ type: 'error', message: 'Something went wrong' });
    document.removeEventListener('crash:error', handler);
    expect(eventFired).toBe(false);
  });
});

describe("dispatchMessage — 'pong'", () => {
  it('sets latency store to approximate round-trip time', () => {
    const now = Date.now();
    dispatchMessage({ type: 'pong', t: now - 42 });
    const lat = get(latency);
    // Should be approximately 42ms (allow some margin for test execution time)
    expect(lat).toBeGreaterThanOrEqual(42);
    expect(lat).toBeLessThan(100);
  });
});

describe('dispatchMessage — unknown type', () => {
  it('does not throw for unknown message type', () => {
    expect(() => {
      // biome-ignore lint/suspicious/noExplicitAny: testing unknown message handling
      dispatchMessage({ type: 'unknown-type-xyz' } as any);
    }).not.toThrow();
  });
});
