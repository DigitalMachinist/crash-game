import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { beforeEach, describe, expect, it } from 'vitest';
import type { GameStateSnapshot, PlayerSnapshot } from '../../../types';
import { gameState, players } from '../../lib/stores';
import GameStatus from '../GameStatus.svelte';

function makeGameState(overrides: Partial<GameStateSnapshot> = {}): GameStateSnapshot {
  return {
    phase: 'WAITING',
    roundId: 1,
    countdown: 10000,
    multiplier: 1.0,
    elapsed: 0,
    crashPoint: null,
    players: [],
    chainCommitment: '',
    drandRound: null,
    drandRandomness: null,
    history: [],
    ...overrides,
  };
}

function makePlayer(id: string): PlayerSnapshot {
  return {
    id,
    playerId: id,
    name: `Player ${id}`,
    wager: 100,
    cashedOut: false,
    cashoutMultiplier: null,
    payout: null,
    autoCashout: null,
  };
}

beforeEach(() => {
  gameState.set(null);
  players.set({});
});

describe('GameStatus component', () => {
  describe('WAITING phase', () => {
    it('shows "Next round in" label', () => {
      gameState.set(makeGameState({ phase: 'WAITING', countdown: 5000 }));
      render(GameStatus);
      expect(screen.getByText('Next round in')).toBeTruthy();
    });

    it('shows countdown in whole seconds (5000ms → "5s")', () => {
      gameState.set(makeGameState({ phase: 'WAITING', countdown: 5000 }));
      render(GameStatus);
      expect(screen.getByText('5s')).toBeTruthy();
    });

    it('rounds countdown up via Math.ceil (9500ms → "10s")', () => {
      gameState.set(makeGameState({ phase: 'WAITING', countdown: 9500 }));
      render(GameStatus);
      expect(screen.getByText('10s')).toBeTruthy();
    });

    it('does NOT show "LIVE"', () => {
      gameState.set(makeGameState({ phase: 'WAITING', countdown: 5000 }));
      render(GameStatus);
      expect(screen.queryByText('LIVE')).toBeNull();
    });

    it('does NOT show "Round starting..."', () => {
      gameState.set(makeGameState({ phase: 'WAITING', countdown: 5000 }));
      render(GameStatus);
      expect(screen.queryByText('Round starting...')).toBeNull();
    });

    it('does NOT show "CRASHED!"', () => {
      gameState.set(makeGameState({ phase: 'WAITING', countdown: 5000 }));
      render(GameStatus);
      expect(screen.queryByText('CRASHED!')).toBeNull();
    });
  });

  describe('STARTING phase', () => {
    it('shows "Round starting..."', () => {
      gameState.set(makeGameState({ phase: 'STARTING' }));
      render(GameStatus);
      expect(screen.getByText('Round starting...')).toBeTruthy();
    });
  });

  describe('RUNNING phase', () => {
    it('shows "LIVE"', () => {
      gameState.set(makeGameState({ phase: 'RUNNING' }));
      render(GameStatus);
      // LIVE is rendered as a text node inside the .live div alongside a span
      expect(screen.getByText(/LIVE/)).toBeTruthy();
    });
  });

  describe('CRASHED phase', () => {
    it('shows "No players this round" when there are 0 players', () => {
      gameState.set(makeGameState({ phase: 'CRASHED' }));
      players.set({});
      render(GameStatus);
      expect(screen.getByText('No players this round')).toBeTruthy();
    });

    it('shows "CRASHED!" when there are players', () => {
      gameState.set(makeGameState({ phase: 'CRASHED' }));
      players.set({ p1: makePlayer('p1') });
      render(GameStatus);
      expect(screen.getByText('CRASHED!')).toBeTruthy();
    });
  });

  describe('reactive countdown updates', () => {
    it('updates displayed seconds when gameState countdown changes', async () => {
      gameState.set(makeGameState({ phase: 'WAITING', countdown: 5000 }));
      render(GameStatus);
      expect(screen.getByText('5s')).toBeTruthy();

      gameState.set(makeGameState({ phase: 'WAITING', countdown: 3000 }));
      await tick();

      expect(screen.queryByText('5s')).toBeNull();
      expect(screen.getByText('3s')).toBeTruthy();
    });
  });

  describe('accessibility (Issue 8.4)', () => {
    it('game status container has role="status"', () => {
      render(GameStatus);
      const container = document.querySelector('.game-status');
      expect(container).toBeTruthy();
      expect(container?.getAttribute('role')).toBe('status');
    });

    it('game status container has aria-live="assertive"', () => {
      render(GameStatus);
      const container = document.querySelector('.game-status');
      expect(container).toBeTruthy();
      expect(container?.getAttribute('aria-live')).toBe('assertive');
    });
  });
});
