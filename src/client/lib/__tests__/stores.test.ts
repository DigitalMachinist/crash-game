import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';
import type { GameStateSnapshot, PlayerSnapshot } from '../../../types';
import {
  connectionStatus,
  countdown,
  displayMultiplier,
  gameState,
  isInRound,
  multiplierAnimating,
  myPlayerId,
  phase,
  players,
  playersList,
} from '../stores';

function makeGameState(overrides: Partial<GameStateSnapshot> = {}): GameStateSnapshot {
  return {
    phase: 'WAITING',
    roundId: 1,
    countdown: 5000,
    multiplier: 1.0,
    elapsed: 0,
    crashPoint: null,
    players: [],
    chainCommitment: 'abc',
    drandRound: null,
    drandRandomness: null,
    history: [],
    ...overrides,
  };
}

function makePlayer(overrides: Partial<PlayerSnapshot> = {}): PlayerSnapshot {
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
  myPlayerId.set('');
  connectionStatus.set('connecting');
});

describe('phase derived store', () => {
  it("returns 'WAITING' when gameState is null", () => {
    expect(get(phase)).toBe('WAITING');
  });

  it('reflects gameState.phase when set', () => {
    gameState.set(makeGameState({ phase: 'RUNNING' }));
    expect(get(phase)).toBe('RUNNING');
  });

  it('reflects STARTING phase', () => {
    gameState.set(makeGameState({ phase: 'STARTING' }));
    expect(get(phase)).toBe('STARTING');
  });

  it('reflects CRASHED phase', () => {
    gameState.set(makeGameState({ phase: 'CRASHED' }));
    expect(get(phase)).toBe('CRASHED');
  });
});

describe('countdown derived store', () => {
  it('returns 10000 when gameState is null', () => {
    expect(get(countdown)).toBe(10000);
  });

  it('reflects gameState.countdown when set', () => {
    gameState.set(makeGameState({ countdown: 3500 }));
    expect(get(countdown)).toBe(3500);
  });

  it('returns 0 when countdown is 0', () => {
    gameState.set(makeGameState({ countdown: 0 }));
    expect(get(countdown)).toBe(0);
  });
});

describe('displayMultiplier writable store', () => {
  it('starts at 1.0', () => {
    expect(get(displayMultiplier)).toBe(1.0);
  });

  it('can be updated', () => {
    displayMultiplier.set(3.14);
    expect(get(displayMultiplier)).toBe(3.14);
  });
});

describe('multiplierAnimating writable store', () => {
  it('starts at false', () => {
    expect(get(multiplierAnimating)).toBe(false);
  });

  it('can be set to true', () => {
    multiplierAnimating.set(true);
    expect(get(multiplierAnimating)).toBe(true);
  });
});

describe('connectionStatus writable store', () => {
  it("starts at 'connecting'", () => {
    expect(get(connectionStatus)).toBe('connecting');
  });

  it("can be set to 'connected'", () => {
    connectionStatus.set('connected');
    expect(get(connectionStatus)).toBe('connected');
  });

  it("can be set to 'reconnecting'", () => {
    connectionStatus.set('reconnecting');
    expect(get(connectionStatus)).toBe('reconnecting');
  });

  it("can be set to 'disconnected'", () => {
    connectionStatus.set('disconnected');
    expect(get(connectionStatus)).toBe('disconnected');
  });
});

describe('isInRound derived store', () => {
  it('is false when phase is WAITING', () => {
    gameState.set(makeGameState({ phase: 'WAITING' }));
    myPlayerId.set('player-1');
    players.set({ 'player-1': makePlayer({ playerId: 'player-1' }) });
    expect(get(isInRound)).toBe(false);
  });

  it('is false when phase is CRASHED', () => {
    gameState.set(makeGameState({ phase: 'CRASHED' }));
    myPlayerId.set('player-1');
    players.set({ 'player-1': makePlayer({ playerId: 'player-1' }) });
    expect(get(isInRound)).toBe(false);
  });

  it('is false when gameState is null (default WAITING)', () => {
    myPlayerId.set('player-1');
    players.set({ 'player-1': makePlayer({ playerId: 'player-1' }) });
    expect(get(isInRound)).toBe(false);
  });

  it('is true when phase is RUNNING and myPlayerId is in players and not cashedOut', () => {
    gameState.set(makeGameState({ phase: 'RUNNING' }));
    myPlayerId.set('player-1');
    players.set({ 'player-1': makePlayer({ playerId: 'player-1', cashedOut: false }) });
    expect(get(isInRound)).toBe(true);
  });

  it('is true when phase is STARTING and myPlayerId is in players and not cashedOut', () => {
    gameState.set(makeGameState({ phase: 'STARTING' }));
    myPlayerId.set('player-1');
    players.set({ 'player-1': makePlayer({ playerId: 'player-1', cashedOut: false }) });
    expect(get(isInRound)).toBe(true);
  });

  it('is false when player has cashedOut', () => {
    gameState.set(makeGameState({ phase: 'RUNNING' }));
    myPlayerId.set('player-1');
    players.set({ 'player-1': makePlayer({ playerId: 'player-1', cashedOut: true }) });
    expect(get(isInRound)).toBe(false);
  });

  it('is false when myPlayerId is not in players', () => {
    gameState.set(makeGameState({ phase: 'RUNNING' }));
    myPlayerId.set('unknown-player');
    players.set({ 'player-1': makePlayer({ playerId: 'player-1', cashedOut: false }) });
    expect(get(isInRound)).toBe(false);
  });

  it('is false when myPlayerId is empty string', () => {
    gameState.set(makeGameState({ phase: 'RUNNING' }));
    myPlayerId.set('');
    players.set({ 'player-1': makePlayer({ playerId: 'player-1', cashedOut: false }) });
    expect(get(isInRound)).toBe(false);
  });
});

describe('playersList derived store', () => {
  it('is an empty array when players is empty', () => {
    expect(get(playersList)).toEqual([]);
  });

  it('returns an array of values from the players Record', () => {
    const alice = makePlayer({ playerId: 'p1', id: 'conn-1', name: 'Alice' });
    const bob = makePlayer({ playerId: 'p2', id: 'conn-2', name: 'Bob' });
    players.set({ p1: alice, p2: bob });
    const list = get(playersList);
    expect(list).toHaveLength(2);
    expect(list).toContainEqual(alice);
    expect(list).toContainEqual(bob);
  });

  it('updates reactively when players changes', () => {
    players.set({ p1: makePlayer({ playerId: 'p1' }) });
    expect(get(playersList)).toHaveLength(1);
    players.set({});
    expect(get(playersList)).toHaveLength(0);
  });

  it('returns a new array when a player is added', () => {
    const alice = makePlayer({ playerId: 'p1', id: 'conn-1', name: 'Alice' });
    players.set({ p1: alice });
    const list1 = get(playersList);
    const bob = makePlayer({ playerId: 'p2', id: 'conn-2', name: 'Bob' });
    players.set({ p1: alice, p2: bob });
    const list2 = get(playersList);
    expect(list2).toHaveLength(2);
    expect(list2).not.toBe(list1);
  });

  it('returns a new array when a player is removed', () => {
    const alice = makePlayer({ playerId: 'p1', id: 'conn-1', name: 'Alice' });
    const bob = makePlayer({ playerId: 'p2', id: 'conn-2', name: 'Bob' });
    players.set({ p1: alice, p2: bob });
    const list1 = get(playersList);
    players.set({ p1: alice });
    const list2 = get(playersList);
    expect(list2).toHaveLength(1);
    expect(list2).not.toBe(list1);
  });

  it('returns the same array reference when players store is set to an equal object (same keys and values)', () => {
    const alice = makePlayer({ playerId: 'p1', id: 'conn-1', name: 'Alice' });
    players.set({ p1: alice });
    const list1 = get(playersList);
    // Set to a new object with same content — memoization should detect no key/value change
    players.set({ p1: alice });
    const list2 = get(playersList);
    expect(list2).toBe(list1);
  });

  it('reflects updated player data (e.g. cashout) when player set changes', () => {
    const alice = makePlayer({ playerId: 'p1', id: 'conn-1', name: 'Alice', cashedOut: false });
    players.set({ p1: alice });
    const list1 = get(playersList);
    expect(list1[0]?.cashedOut).toBe(false);
    const aliceCashedOut = makePlayer({
      playerId: 'p1',
      id: 'conn-1',
      name: 'Alice',
      cashedOut: true,
      cashoutMultiplier: 2.5,
    });
    players.set({ p1: aliceCashedOut });
    const list2 = get(playersList);
    expect(list2[0]?.cashedOut).toBe(true);
    expect(list2[0]?.cashoutMultiplier).toBe(2.5);
    expect(list2).not.toBe(list1);
  });
});
