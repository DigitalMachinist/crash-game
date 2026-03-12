import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it } from 'vitest';
import type { GameStateSnapshot, PlayerSnapshot } from '../../../types';
import { gameState, myPlayerId, players } from '../../lib/stores';
import PlayerList from '../PlayerList.svelte';

type Phase = 'WAITING' | 'STARTING' | 'RUNNING' | 'CRASHED';

function makePlayer(overrides: Partial<PlayerSnapshot> = {}): PlayerSnapshot {
  return {
    id: 'conn-1',
    playerId: 'p1',
    name: 'Alice',
    wager: 100,
    cashedOut: false,
    cashoutMultiplier: null,
    payout: null,
    autoCashout: null,
    ...overrides,
  };
}

function makeGameState(phase: Phase): GameStateSnapshot {
  return {
    phase,
    roundId: 1,
    countdown: 0,
    multiplier: 1.0,
    elapsed: 0,
    crashPoint: null,
    players: [],
    chainCommitment: '',
    drandRound: null,
    drandRandomness: null,
    history: [],
  };
}

beforeEach(() => {
  players.set({});
  gameState.set(null);
  myPlayerId.set('');
});

describe('PlayerList component', () => {
  it('shows "No players yet" when players store is empty', () => {
    render(PlayerList);
    expect(screen.getByText('No players yet')).toBeTruthy();
  });

  it('does NOT show "No players yet" when players are present', () => {
    players.set({ p1: makePlayer() });
    render(PlayerList);
    expect(screen.queryByText('No players yet')).toBeNull();
  });

  it('shows player name and wager in the table', () => {
    players.set({ p1: makePlayer({ name: 'Alice', wager: 100 }) });
    render(PlayerList);
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('100')).toBeTruthy();
  });

  it("local player's row has class 'me'", () => {
    myPlayerId.set('p1');
    players.set({ p1: makePlayer({ playerId: 'p1', name: 'Alice' }) });
    render(PlayerList);
    const nameCell = screen.getByText('Alice');
    const row = nameCell.closest('tr');
    expect(row).not.toBeNull();
    expect(row!.classList.contains('me')).toBe(true);
  });

  it("non-local player's row does NOT have class 'me'", () => {
    myPlayerId.set('p2');
    players.set({ p1: makePlayer({ playerId: 'p1', name: 'Alice' }) });
    render(PlayerList);
    const nameCell = screen.getByText('Alice');
    const row = nameCell.closest('tr');
    expect(row).not.toBeNull();
    expect(row!.classList.contains('me')).toBe(false);
  });

  it('shows auto-cashout badge "Auto: 2.00x" when autoCashout is set', () => {
    players.set({ p1: makePlayer({ autoCashout: 2.0 }) });
    render(PlayerList);
    expect(screen.getByText('Auto: 2.00x')).toBeTruthy();
  });

  it('does NOT show auto-cashout badge when autoCashout is null', () => {
    players.set({ p1: makePlayer({ autoCashout: null }) });
    render(PlayerList);
    expect(screen.queryByText(/Auto:/)).toBeNull();
  });

  it('shows cashed-out result "2.50x (+250)" when player has cashedOut=true and cashoutMultiplier set', () => {
    players.set({
      p1: makePlayer({ cashedOut: true, cashoutMultiplier: 2.5, payout: 250 }),
    });
    render(PlayerList);
    expect(screen.getByText('2.50x (+250)')).toBeTruthy();
  });

  it('shows "Lost" when phase is CRASHED and player has cashedOut=false', () => {
    gameState.set(makeGameState('CRASHED'));
    players.set({ p1: makePlayer({ cashedOut: false }) });
    render(PlayerList);
    expect(screen.getByText('Lost')).toBeTruthy();
  });

  it('shows "—" during RUNNING when player has not cashed out yet', () => {
    gameState.set(makeGameState('RUNNING'));
    players.set({ p1: makePlayer({ cashedOut: false }) });
    render(PlayerList);
    expect(screen.getByText('—')).toBeTruthy();
  });
});
