import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeGameState } from '../../__tests__/factories';
import {
  dangerColors,
  displayMultiplier,
  gameState,
  multiplierAnimating,
  threatLevel,
} from '../../lib/stores';
import Multiplier from '../Multiplier.svelte';

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

  it('renders BREACHING... text when phase is STARTING', () => {
    gameState.set(makeGameState({ phase: 'STARTING' }));
    render(Multiplier);
    expect(screen.getByText('BREACHING...')).toBeTruthy();
  });

  it('does NOT render multiplier value when phase is STARTING', () => {
    gameState.set(makeGameState({ phase: 'STARTING' }));
    render(Multiplier);
    expect(screen.queryByText('1.00x')).toBeNull();
  });

  it('has class live when phase is RUNNING', () => {
    gameState.set(makeGameState({ phase: 'RUNNING' }));
    render(Multiplier);
    const el = screen.getByText('1.00x');
    expect(el.classList.contains('live')).toBe(true);
  });

  it('has class crashed when phase is CRASHED', () => {
    gameState.set(makeGameState({ phase: 'CRASHED' }));
    render(Multiplier);
    const el = screen.getByText('1.00x');
    expect(el.classList.contains('crashed')).toBe(true);
  });

  it('does NOT render CRASHED! label (CrashScreen handles crash display)', () => {
    gameState.set(makeGameState({ phase: 'CRASHED' }));
    render(Multiplier);
    expect(screen.queryByText('CRASHED!')).toBeNull();
  });

  it('does NOT have class live or crashed when phase is WAITING', () => {
    gameState.set(makeGameState({ phase: 'WAITING' }));
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

  it('shows 侵入中 LIVE HACK label when phase is RUNNING', () => {
    gameState.set(makeGameState({ phase: 'RUNNING' }));
    render(Multiplier);
    expect(screen.getByText(/LIVE HACK/)).toBeTruthy();
  });

  it('does NOT show LIVE HACK label when phase is WAITING', () => {
    gameState.set(makeGameState({ phase: 'WAITING' }));
    render(Multiplier);
    expect(screen.queryByText(/LIVE HACK/)).toBeNull();
  });

  it('applies glitch class at CRITICAL threat level during RUNNING', async () => {
    gameState.set(makeGameState({ phase: 'RUNNING' }));
    displayMultiplier.set(30.0); // CRITICAL
    render(Multiplier);
    await tick();
    const el = screen.getByText('30.00x');
    expect(el.classList.contains('glitch')).toBe(true);
  });

  it('does NOT apply glitch class below CRITICAL during RUNNING', () => {
    gameState.set(makeGameState({ phase: 'RUNNING' }));
    displayMultiplier.set(5.0); // HIGH, not CRITICAL
    render(Multiplier);
    const el = screen.getByText('5.00x');
    expect(el.classList.contains('glitch')).toBe(false);
  });

  it('multiplier element has data-text attribute matching displayed value', () => {
    render(Multiplier);
    const el = screen.getByText('1.00x');
    expect(el.getAttribute('data-text')).toBe('1.00x');
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
