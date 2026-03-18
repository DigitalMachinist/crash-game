import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it } from 'vitest';
import type { GameStateSnapshot, PlayerSnapshot } from '../../../types';
import { displayMultiplier, gameState, myPlayerId, players } from '../../lib/stores';
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
  displayMultiplier.set(1.0);
});

describe('PlayerList component', () => {
  it('shows "No operators" when players store is empty', () => {
    render(PlayerList);
    expect(screen.getByText('No operators')).toBeTruthy();
  });

  it('does NOT show "No operators" when players are present', () => {
    players.set({ p1: makePlayer() });
    render(PlayerList);
    expect(screen.queryByText('No operators')).toBeNull();
  });

  it('shows player name and wager in CR format', () => {
    players.set({ p1: makePlayer({ name: 'Alice', wager: 100 }) });
    render(PlayerList);
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('100 CR')).toBeTruthy();
  });

  it("local player's row has class 'me'", () => {
    myPlayerId.set('p1');
    players.set({ p1: makePlayer({ playerId: 'p1', name: 'Alice' }) });
    render(PlayerList);
    const nameEl = screen.getByText('Alice');
    const row = nameEl.closest('li');
    expect(row).not.toBeNull();
    expect(row!.classList.contains('me')).toBe(true);
  });

  it("non-local player's row does NOT have class 'me'", () => {
    myPlayerId.set('p2');
    players.set({ p1: makePlayer({ playerId: 'p1', name: 'Alice' }) });
    render(PlayerList);
    const nameEl = screen.getByText('Alice');
    const row = nameEl.closest('li');
    expect(row).not.toBeNull();
    expect(row!.classList.contains('me')).toBe(false);
  });

  it('does NOT show ← YOU marker for any player', () => {
    myPlayerId.set('p1');
    players.set({ p1: makePlayer({ playerId: 'p1', name: 'Alice' }) });
    render(PlayerList);
    expect(screen.queryByText('← YOU')).toBeNull();
  });

  it('shows DC X.XXx status for cashed-out player', () => {
    players.set({
      p1: makePlayer({ cashedOut: true, cashoutMultiplier: 2.5, payout: 250 }),
    });
    render(PlayerList);
    expect(screen.getByText('DC 2.50x')).toBeTruthy();
  });

  it('shows RDY status during WAITING phase', () => {
    gameState.set(makeGameState('WAITING'));
    players.set({ p1: makePlayer({ cashedOut: false }) });
    render(PlayerList);
    expect(screen.getByText('RDY')).toBeTruthy();
  });

  it('shows — during RUNNING when player has not cashed out yet', () => {
    gameState.set(makeGameState('RUNNING'));
    players.set({ p1: makePlayer({ cashedOut: false }) });
    render(PlayerList);
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('applies crossed class at HIGH+ threat for cashed-out players', async () => {
    displayMultiplier.set(6.0); // HIGH threat
    gameState.set(makeGameState('RUNNING'));
    players.set({
      p1: makePlayer({ playerId: 'p1', cashedOut: true, cashoutMultiplier: 2.5, payout: 250 }),
    });
    render(PlayerList);
    const row = document.querySelector('li.crossed');
    expect(row).toBeTruthy();
  });

  it('does NOT apply crossed class at GHOST threat', () => {
    displayMultiplier.set(1.0); // GHOST
    players.set({
      p1: makePlayer({ cashedOut: true, cashoutMultiplier: 2.5, payout: 250 }),
    });
    render(PlayerList);
    const row = document.querySelector('li.crossed');
    expect(row).toBeNull();
  });

  it('renders OPERATORS section label', () => {
    render(PlayerList);
    expect(screen.getByText(/OPERATORS/)).toBeTruthy();
  });
});
