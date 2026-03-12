import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { beforeEach, describe, expect, it } from 'vitest';
import type { GameStateSnapshot } from '../../../types';
import { displayMultiplier, gameState, multiplierAnimating } from '../../lib/stores';
import Multiplier from '../Multiplier.svelte';

const makeGameState = (phase: GameStateSnapshot['phase']): GameStateSnapshot => ({
  phase,
  roundId: 1,
  countdown: 0,
  multiplier: 1.5,
  elapsed: 1000,
  crashPoint: null,
  players: [],
  chainCommitment: 'abc',
  drandRound: null,
  drandRandomness: null,
  history: [],
});

beforeEach(() => {
  gameState.set(null);
  displayMultiplier.set(1.0);
  multiplierAnimating.set(false);
});

describe('Multiplier component', () => {
  it('renders value with x suffix when phase is not STARTING', () => {
    render(Multiplier);
    expect(screen.getByText('1.00x')).toBeTruthy();
  });

  it('renders STARTING... text when phase is STARTING', () => {
    gameState.set(makeGameState('STARTING'));
    render(Multiplier);
    expect(screen.getByText('STARTING...')).toBeTruthy();
  });

  it('does NOT render multiplier value when phase is STARTING', () => {
    gameState.set(makeGameState('STARTING'));
    render(Multiplier);
    expect(screen.queryByText('1.00x')).toBeNull();
  });

  it('has class live when phase is RUNNING', () => {
    gameState.set(makeGameState('RUNNING'));
    render(Multiplier);
    const el = screen.getByText('1.00x');
    expect(el.classList.contains('live')).toBe(true);
  });

  it('has class crashed when phase is CRASHED', () => {
    gameState.set(makeGameState('CRASHED'));
    render(Multiplier);
    const el = screen.getByText('1.00x');
    expect(el.classList.contains('crashed')).toBe(true);
  });

  it('renders CRASHED! label when phase is CRASHED', () => {
    gameState.set(makeGameState('CRASHED'));
    render(Multiplier);
    expect(screen.getByText('CRASHED!')).toBeTruthy();
  });

  it('does NOT have class live or crashed when phase is WAITING', () => {
    gameState.set(makeGameState('WAITING'));
    render(Multiplier);
    const el = screen.getByText('1.00x');
    expect(el.classList.contains('live')).toBe(false);
    expect(el.classList.contains('crashed')).toBe(false);
  });

  it('has class animating when multiplierAnimating is true', () => {
    multiplierAnimating.set(true);
    render(Multiplier);
    const el = screen.getByText('1.00x');
    expect(el.classList.contains('animating')).toBe(true);
  });

  it('renders displayMultiplier value correctly (e.g. 3.5 shows 3.50x)', () => {
    displayMultiplier.set(3.5);
    render(Multiplier);
    expect(screen.getByText('3.50x')).toBeTruthy();
  });

  it('updates rendered value when displayMultiplier store changes', async () => {
    render(Multiplier);
    expect(screen.getByText('1.00x')).toBeTruthy();

    displayMultiplier.set(7.25);
    await tick();

    expect(screen.queryByText('1.00x')).toBeNull();
    expect(screen.getByText('7.25x')).toBeTruthy();
  });

  describe('accessibility (Issue 8.3)', () => {
    it('multiplier container has aria-live attribute', () => {
      render(Multiplier);
      const container = document.querySelector('.multiplier-container');
      expect(container).toBeTruthy();
      expect(container?.hasAttribute('aria-live')).toBe(true);
    });
  });
});
