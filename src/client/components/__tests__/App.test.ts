import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameStateSnapshot } from '../../../types';
import App from '../../App.svelte';
import {
  balance,
  gameState,
  lastCrashResult,
  lastPendingPayout,
  myPlayerId,
} from '../../lib/stores';

vi.mock('../../lib/socket', () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock('../../lib/balance', () => ({
  getOrCreatePlayerId: vi.fn().mockReturnValue('test-player-id'),
  getBalance: vi.fn().mockReturnValue(100),
  applyCashout: vi.fn(),
  addHistoryEntry: vi.fn(),
  hasPendingResult: vi.fn().mockReturnValue(false),
}));

import {
  addHistoryEntry,
  applyCashout,
  getBalance,
  getOrCreatePlayerId,
  hasPendingResult,
} from '../../lib/balance';
import { connect, disconnect } from '../../lib/socket';

function makeGameState(
  phase: GameStateSnapshot['phase'],
  roundId = 1,
  overrides: Partial<GameStateSnapshot> = {},
): GameStateSnapshot {
  return {
    phase,
    roundId,
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

beforeEach(() => {
  vi.clearAllMocks();
  gameState.set(null);
  myPlayerId.set('');
  balance.set(0);
  lastCrashResult.set(null);
  lastPendingPayout.set(null);
  vi.mocked(getOrCreatePlayerId).mockReturnValue('test-player-id');
  vi.mocked(getBalance).mockReturnValue(100);
  vi.mocked(hasPendingResult).mockReturnValue(false);
});

describe('App component', () => {
  describe('lifecycle', () => {
    it('calls connect() on mount with the local playerId', () => {
      render(App);
      expect(connect).toHaveBeenCalledTimes(1);
      expect(connect).toHaveBeenCalledWith('test-player-id');
    });

    it('calls disconnect() on unmount', () => {
      const { unmount } = render(App);
      unmount();
      expect(disconnect).toHaveBeenCalledTimes(1);
    });

    it('calls getOrCreatePlayerId() on mount and sets myPlayerId store', () => {
      render(App);
      expect(getOrCreatePlayerId).toHaveBeenCalledTimes(1);
      expect(get(myPlayerId)).toBe('test-player-id');
    });

    it('calls getBalance() on mount and initializes balance display', () => {
      render(App);
      expect(getBalance).toHaveBeenCalledTimes(1);
      expect(screen.getByText('+100.00')).toBeTruthy();
    });
  });

  describe('balance display', () => {
    it('shows positive balance with + prefix', () => {
      render(App);
      // getBalance mock returns 100, balance store is set to 100 on mount
      expect(screen.getByText('+100.00')).toBeTruthy();
    });

    it('shows negative balance without + prefix', async () => {
      render(App);
      balance.set(-50);
      await tick();
      expect(screen.getByText('-50.00')).toBeTruthy();
    });

    it('shows zero balance with + prefix', async () => {
      vi.mocked(getBalance).mockReturnValue(0);
      render(App);
      await tick();
      expect(screen.getByText('+0.00')).toBeTruthy();
    });
  });

  describe('lastPendingPayout store', () => {
    it('shows toast with Auto-cashout message when lastPendingPayout store is set', async () => {
      render(App);
      lastPendingPayout.set({
        type: 'pendingPayout',
        roundId: 1,
        wager: 50,
        payout: 120,
        cashoutMultiplier: 2.4,
        crashPoint: 3.0,
      });
      await tick();
      expect(screen.getByText(/Auto-cashout:/)).toBeTruthy();
    });

    it('toast contains payout and multiplier values', async () => {
      render(App);
      lastPendingPayout.set({
        type: 'pendingPayout',
        roundId: 1,
        wager: 50,
        payout: 120,
        cashoutMultiplier: 2.4,
        crashPoint: 3.0,
      });
      await tick();
      expect(screen.getByText('Auto-cashout: +120.00 (2.40x)')).toBeTruthy();
    });

    it('calls applyCashout and addHistoryEntry when lastPendingPayout store is set', async () => {
      render(App);
      lastPendingPayout.set({
        type: 'pendingPayout',
        roundId: 1,
        wager: 50,
        payout: 120,
        cashoutMultiplier: 2.4,
        crashPoint: 3.0,
      });
      await tick();
      expect(applyCashout).toHaveBeenCalledWith(120);
      expect(addHistoryEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          roundId: 1,
          wager: 50,
          payout: 120,
          cashoutMultiplier: 2.4,
          crashPoint: 3.0,
        }),
      );
    });

    it('hasPendingResult guard prevents double-apply of pendingPayout', async () => {
      vi.mocked(hasPendingResult).mockReturnValue(true);
      render(App);
      lastPendingPayout.set({
        type: 'pendingPayout',
        roundId: 1,
        wager: 50,
        payout: 120,
        cashoutMultiplier: 2.4,
        crashPoint: 3.0,
      });
      await tick();
      expect(applyCashout).not.toHaveBeenCalled();
      expect(addHistoryEntry).not.toHaveBeenCalled();
    });
  });

  describe('lastCrashResult store', () => {
    // The lastCrashResult store value is a GameStateSnapshot (phase='CRASHED').
    // roundId and crashPoint come from the snapshot.
    function makeCrashedSnapshot(
      roundId: number,
      players: GameStateSnapshot['players'],
    ): GameStateSnapshot {
      return makeGameState('CRASHED', roundId, { crashPoint: 2.0, players });
    }

    it('calls applyCashout for player who cashed out', async () => {
      render(App);
      lastCrashResult.set(
        makeCrashedSnapshot(5, [
          {
            id: 'conn1',
            playerId: 'test-player-id',
            name: 'Player 1',
            wager: 100,
            cashedOut: true,
            cashoutMultiplier: 2.0,
            payout: 200,
            autoCashout: null,
          },
        ]),
      );
      await tick();
      expect(applyCashout).toHaveBeenCalledWith(200);
    });

    it('calls addHistoryEntry with payout:200 for player who cashed out', async () => {
      render(App);
      lastCrashResult.set(
        makeCrashedSnapshot(5, [
          {
            id: 'conn1',
            playerId: 'test-player-id',
            name: 'Player 1',
            wager: 100,
            cashedOut: true,
            cashoutMultiplier: 2.0,
            payout: 200,
            autoCashout: null,
          },
        ]),
      );
      await tick();
      expect(addHistoryEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          roundId: 5,
          wager: 100,
          payout: 200,
          cashoutMultiplier: 2.0,
          crashPoint: 2.0,
        }),
      );
    });

    it('does NOT call applyCashout for player who did not cash out', async () => {
      render(App);
      lastCrashResult.set(
        makeCrashedSnapshot(5, [
          {
            id: 'conn1',
            playerId: 'test-player-id',
            name: 'Player 1',
            wager: 100,
            cashedOut: false,
            cashoutMultiplier: null,
            payout: null,
            autoCashout: null,
          },
        ]),
      );
      await tick();
      expect(applyCashout).not.toHaveBeenCalled();
    });

    it('calls addHistoryEntry with payout:0 for player who did not cash out', async () => {
      render(App);
      lastCrashResult.set(
        makeCrashedSnapshot(5, [
          {
            id: 'conn1',
            playerId: 'test-player-id',
            name: 'Player 1',
            wager: 100,
            cashedOut: false,
            cashoutMultiplier: null,
            payout: null,
            autoCashout: null,
          },
        ]),
      );
      await tick();
      expect(addHistoryEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          roundId: 5,
          wager: 100,
          payout: 0,
          cashoutMultiplier: null,
          crashPoint: 2.0,
        }),
      );
    });

    it('does nothing when myPlayerId is not in crashed players list', async () => {
      render(App);
      lastCrashResult.set(
        makeCrashedSnapshot(5, [
          {
            id: 'conn2',
            playerId: 'other-player',
            name: 'Other',
            wager: 100,
            cashedOut: true,
            cashoutMultiplier: 2.0,
            payout: 200,
            autoCashout: null,
          },
        ]),
      );
      await tick();
      expect(applyCashout).not.toHaveBeenCalled();
      expect(addHistoryEntry).not.toHaveBeenCalled();
    });

    it('hasPendingResult guard prevents double-apply when lastCrashResult is set', async () => {
      vi.mocked(hasPendingResult).mockReturnValue(true);
      render(App);
      lastCrashResult.set(
        makeCrashedSnapshot(5, [
          {
            id: 'conn1',
            playerId: 'test-player-id',
            name: 'Player 1',
            wager: 100,
            cashedOut: true,
            cashoutMultiplier: 2.0,
            payout: 200,
            autoCashout: null,
          },
        ]),
      );
      await tick();
      expect(applyCashout).not.toHaveBeenCalled();
      expect(addHistoryEntry).not.toHaveBeenCalled();
    });
  });

  describe('DOM structure', () => {
    it('renders the app title', () => {
      render(App);
      expect(screen.getByRole('heading', { name: 'Crash' })).toBeTruthy();
    });

    it('renders balance label', () => {
      render(App);
      expect(screen.getAllByText(/Balance:/).length).toBeGreaterThanOrEqual(1);
    });

    it('does not show toast initially', () => {
      render(App);
      expect(screen.queryByText(/Auto-cashout:/)).toBeNull();
    });
  });

  describe('toast accessibility (Issue 8.2)', () => {
    it('toast container has role="status"', async () => {
      render(App);
      lastPendingPayout.set({
        type: 'pendingPayout',
        roundId: 1,
        wager: 50,
        payout: 120,
        cashoutMultiplier: 2.4,
        crashPoint: 3.0,
      });
      await tick();
      const toast = document.querySelector('.toast');
      expect(toast).toBeTruthy();
      expect(toast?.getAttribute('role')).toBe('status');
    });

    it('toast container has aria-live="polite"', async () => {
      render(App);
      lastPendingPayout.set({
        type: 'pendingPayout',
        roundId: 1,
        wager: 50,
        payout: 120,
        cashoutMultiplier: 2.4,
        crashPoint: 3.0,
      });
      await tick();
      const toast = document.querySelector('.toast');
      expect(toast).toBeTruthy();
      expect(toast?.getAttribute('aria-live')).toBe('polite');
    });
  });

  describe('balance display aria-label', () => {
    it('balance display has aria-label with positive balance', () => {
      render(App);
      const balanceEl = document.querySelector('[aria-label^="Balance:"]');
      expect(balanceEl).not.toBeNull();
      expect(balanceEl!.getAttribute('aria-label')).toBe('Balance: +100.00');
    });

    it('balance display aria-label updates when balance goes negative', async () => {
      render(App);
      balance.set(-50);
      await tick();
      const balanceEl = document.querySelector('[aria-label^="Balance:"]');
      expect(balanceEl!.getAttribute('aria-label')).toBe('Balance: -50.00');
    });
  });
});
