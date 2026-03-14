import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameStateSnapshot, PlayerSnapshot } from '../../../types';
import { gameState, myPlayerId, players } from '../../lib/stores';
import CashoutButton from '../CashoutButton.svelte';

vi.mock('../../lib/commands', () => ({
  sendJoin: vi.fn(),
  sendCashout: vi.fn(),
}));

import { sendCashout } from '../../lib/commands';

function makeGameState(phase: GameStateSnapshot['phase']): GameStateSnapshot {
  return {
    phase,
    roundId: 1,
    countdown: 0,
    multiplier: 2.0,
    elapsed: 5000,
    crashPoint: null,
    players: [],
    chainCommitment: '',
    drandRound: null,
    drandRandomness: null,
    history: [],
  };
}

const activePlayer: PlayerSnapshot = {
  id: 'conn-1',
  playerId: 'player-1',
  name: 'Alice',
  wager: 100,
  cashedOut: false,
  cashoutMultiplier: null,
  payout: null,
  autoCashout: null,
};

const cashedOutPlayer: PlayerSnapshot = {
  ...activePlayer,
  cashedOut: true,
  cashoutMultiplier: 2.0,
  payout: 200,
};

function setupInRound() {
  myPlayerId.set('player-1');
  players.set({ 'player-1': activePlayer });
  gameState.set(makeGameState('RUNNING'));
}

beforeEach(() => {
  gameState.set(null);
  players.set({});
  myPlayerId.set('');
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CashoutButton component', () => {
  it('does NOT render when phase is WAITING', () => {
    gameState.set(makeGameState('WAITING'));
    render(CashoutButton);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('does NOT render when phase is RUNNING but player is not in round', () => {
    // RUNNING phase but stores are empty — isInRound is false
    gameState.set(makeGameState('RUNNING'));
    render(CashoutButton);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders when phase is RUNNING and player is in round', () => {
    setupInRound();
    render(CashoutButton);
    expect(screen.getByRole('button')).toBeTruthy();
    expect(screen.getByText('CASH OUT')).toBeTruthy();
  });

  it('calls sendCashout when the button is clicked', async () => {
    setupInRound();
    render(CashoutButton);
    await fireEvent.click(screen.getByRole('button'));
    expect(sendCashout).toHaveBeenCalledTimes(1);
  });

  it('shows "Cashing out..." and is disabled after clicking', async () => {
    setupInRound();
    render(CashoutButton);
    const button = screen.getByRole('button');
    await fireEvent.click(button);
    await tick();
    expect(screen.getByText('Cashing out...')).toBeTruthy();
    expect(button).toBeDisabled();
  });

  it('only calls sendCashout once when clicked twice rapidly (isLoading guard)', async () => {
    setupInRound();
    render(CashoutButton);
    const button = screen.getByRole('button');
    await fireEvent.click(button);
    await fireEvent.click(button);
    expect(sendCashout).toHaveBeenCalledTimes(1);
  });

  it('does NOT render when phase is CRASHED', () => {
    // Set up player data so isInRound would otherwise be true, but phase is CRASHED
    myPlayerId.set('player-1');
    players.set({ 'player-1': activePlayer });
    gameState.set(makeGameState('CRASHED'));
    render(CashoutButton);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('resets loading state reactively when isInRound goes false (player cashedOut)', async () => {
    setupInRound();
    render(CashoutButton);
    const button = screen.getByRole('button');
    await fireEvent.click(button);
    await tick();
    expect(button).toBeDisabled();

    // Simulate server ACK: mark player as cashed out → isInRound becomes false
    players.set({ 'player-1': cashedOutPlayer });
    await tick();
    await Promise.resolve();
    await tick();

    // Loading should be reset reactively; button would be hidden since isInRound is
    // false, but verify the button is no longer rendered (component unmounts when
    // isInRound is false and phase is still RUNNING)
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('resets loading state reactively when isInRound goes false (phase changes to CRASHED)', async () => {
    setupInRound();
    render(CashoutButton);
    const button = screen.getByRole('button');
    await fireEvent.click(button);
    await tick();
    expect(button).toBeDisabled();

    // Simulate server ACK: phase goes to CRASHED → isInRound becomes false
    gameState.set(makeGameState('CRASHED'));
    await tick();
    await Promise.resolve();
    await tick();

    // Component hides when isInRound is false
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('resets loading state after 5000ms fallback timeout when isInRound never changes', async () => {
    setupInRound();
    render(CashoutButton);
    const button = screen.getByRole('button');
    await fireEvent.click(button);
    await tick();
    expect(button).toBeDisabled();

    // Advance time to just before the 5s fallback — still loading
    vi.advanceTimersByTime(4999);
    await tick();
    expect(button).toBeDisabled();

    // Advance past the 5s fallback — should reset
    vi.advanceTimersByTime(1);
    await tick();

    expect(button).not.toBeDisabled();
    expect(screen.getByText('CASH OUT')).toBeTruthy();
  });

  it('does NOT fire the 5s fallback when isInRound reactive reset fires first', async () => {
    setupInRound();
    render(CashoutButton);
    const button = screen.getByRole('button');
    await fireEvent.click(button);
    await tick();
    expect(button).toBeDisabled();

    // Reactive reset fires at t=0 (phase changes)
    gameState.set(makeGameState('CRASHED'));
    await tick();
    await Promise.resolve();
    await tick();

    // Button should be hidden now (isInRound is false)
    expect(screen.queryByRole('button')).toBeNull();

    // Advance past 5s — no errors should occur (fallback was cleared)
    vi.advanceTimersByTime(5001);
    await tick();
    // Still hidden, no errors thrown
    expect(screen.queryByRole('button')).toBeNull();
  });
});
