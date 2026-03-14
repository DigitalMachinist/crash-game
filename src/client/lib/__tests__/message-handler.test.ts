import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';
import type { GameStateSnapshot, PlayerSnapshot } from '../../../types';
import { handleMessage } from '../message-handler';
import {
  balance,
  displayMultiplier,
  gameState,
  history,
  lastCrashResult,
  lastError,
  lastPendingPayout,
  multiplierAnimating,
  myPlayerId,
  players,
} from '../stores';

function makeGameState(overrides: Partial<GameStateSnapshot> = {}): GameStateSnapshot {
  return {
    phase: 'RUNNING',
    roundId: 42,
    countdown: 0,
    multiplier: 2.5,
    elapsed: 5000,
    crashPoint: null,
    players: [],
    chainCommitment: 'chain-abc',
    drandRound: 100,
    drandRandomness: null,
    history: [],
    ...overrides,
  };
}

function makePlayerSnapshot(overrides: Partial<PlayerSnapshot> = {}): PlayerSnapshot {
  return {
    id: 'conn-1',
    playerId: 'player-1',
    name: 'Alice',
    wager: 100,
    cashedOut: false,
    cashoutMultiplier: null,
    payout: null,
    autoCashout: null,
    ...overrides,
  };
}

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
  localStorage.clear();
});

describe("handleMessage — 'state'", () => {
  it('updates gameState with the snapshot', () => {
    const state = makeGameState({ phase: 'WAITING', roundId: 10 });
    handleMessage({ type: 'state', ...state });
    const gs = get(gameState);
    expect(gs?.phase).toBe('WAITING');
    expect(gs?.roundId).toBe(10);
  });

  it('converts players array to Record keyed by playerId', () => {
    const p1 = makePlayerSnapshot({ playerId: 'p1', id: 'conn-1', name: 'Alice' });
    const p2 = makePlayerSnapshot({ playerId: 'p2', id: 'conn-2', name: 'Bob' });
    const state = makeGameState({ players: [p1, p2] });
    handleMessage({ type: 'state', ...state });
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
    handleMessage({ type: 'state', ...state });
    expect(get(history)).toEqual([histEntry]);
  });

  it('overwrites existing players Record on each state message', () => {
    players.set({ old: makePlayerSnapshot({ playerId: 'old' }) });
    const state = makeGameState({ players: [makePlayerSnapshot({ playerId: 'new-player' })] });
    handleMessage({ type: 'state', ...state });
    const ps = get(players);
    expect('old' in ps).toBe(false);
    expect('new-player' in ps).toBe(true);
  });
});

describe("handleMessage — 'tick'", () => {
  it('sets multiplierAnimating to true', () => {
    handleMessage({ type: 'tick', multiplier: 1.5, elapsed: 1000 });
    expect(get(multiplierAnimating)).toBe(true);
  });

  it('updates displayMultiplier', () => {
    handleMessage({ type: 'tick', multiplier: 3.14, elapsed: 2000 });
    expect(get(displayMultiplier)).toBe(3.14);
  });
});

describe("handleMessage — 'state' with phase CRASHED", () => {
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
    handleMessage({ type: 'state', ...makeCrashedState() });
    expect(get(multiplierAnimating)).toBe(false);
  });

  it('updates gameState phase to CRASHED', () => {
    handleMessage({ type: 'state', ...makeCrashedState() });
    expect(get(gameState)?.phase).toBe('CRASHED');
  });

  it('sets gameState crashPoint to the crash value', () => {
    handleMessage({ type: 'state', ...makeCrashedState({ crashPoint: 3.14 }) });
    expect(get(gameState)?.crashPoint).toBe(3.14);
  });

  it('sets displayMultiplier to crashPoint', () => {
    handleMessage({ type: 'state', ...makeCrashedState({ crashPoint: 4.55 }) });
    expect(get(displayMultiplier)).toBe(4.55);
  });

  it('sets players Record with final player outcomes', () => {
    const p = makePlayerSnapshot({
      playerId: 'p1',
      cashedOut: true,
      cashoutMultiplier: 2.0,
      payout: 200,
    });
    handleMessage({ type: 'state', ...makeCrashedState({ players: [p] }) });
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
    handleMessage({ type: 'state', ...makeCrashedState({ roundId: 77, history: [histEntry] }) });
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
    handleMessage({ type: 'state', ...state });
    const result = get(lastCrashResult);
    expect(result).not.toBeNull();
    expect(result?.phase).toBe('CRASHED');
    expect(result?.crashPoint).toBe(3.14);
  });

  it('does not set displayMultiplier or set lastCrashResult when crashPoint is null', () => {
    displayMultiplier.set(1.0);
    // Simulate a CRASHED state with null crashPoint (shouldn't happen in practice but guards against it)
    handleMessage({ type: 'state', ...makeCrashedState({ crashPoint: null }) });
    expect(get(displayMultiplier)).toBe(1.0);
    expect(get(lastCrashResult)).toBeNull();
  });
});

describe("handleMessage — 'playerJoined'", () => {
  it('adds the new player to the players Record', () => {
    handleMessage({
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
    players.set({ existing: makePlayerSnapshot({ playerId: 'existing' }) });
    handleMessage({
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
    handleMessage({
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
    handleMessage({
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

describe("handleMessage — 'playerCashedOut'", () => {
  it('updates the correct player by playerId', () => {
    players.set({
      p1: makePlayerSnapshot({ playerId: 'p1', id: 'conn-1', cashedOut: false }),
      p2: makePlayerSnapshot({ playerId: 'p2', id: 'conn-2', cashedOut: false }),
    });
    handleMessage({
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
    const original = { p1: makePlayerSnapshot({ playerId: 'p1', id: 'conn-1' }) };
    players.set(original);
    handleMessage({
      type: 'playerCashedOut',
      id: 'conn-1',
      playerId: 'p-unknown',
      multiplier: 2.0,
      payout: 200,
    });
    expect(get(players)).toEqual(original);
  });
});

describe("handleMessage — 'pendingPayout'", () => {
  it('sets lastPendingPayout store to the message', () => {
    handleMessage({
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
    handleMessage({
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

describe("handleMessage — 'error'", () => {
  it('sets lastError store to the error message string', () => {
    handleMessage({ type: 'error', message: 'Something went wrong' });
    expect(get(lastError)).toBe('Something went wrong');
  });

  it('does not dispatch a crash:error CustomEvent', () => {
    let eventFired = false;
    const handler = () => {
      eventFired = true;
    };
    document.addEventListener('crash:error', handler);
    handleMessage({ type: 'error', message: 'Something went wrong' });
    document.removeEventListener('crash:error', handler);
    expect(eventFired).toBe(false);
  });
});

describe('handleMessage — unknown type', () => {
  it('does not throw for unknown message type', () => {
    expect(() => {
      // biome-ignore lint/suspicious/noExplicitAny: testing unknown message handling
      handleMessage({ type: 'unknown-type-xyz' } as any);
    }).not.toThrow();
  });
});
