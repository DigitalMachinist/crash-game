import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameStateSnapshot } from '../../../types';
import { balance, gameState, lastError } from '../../lib/stores';
import BetForm from '../BetForm.svelte';

vi.mock('../../lib/commands', () => ({
  sendJoin: vi.fn(),
  sendCashout: vi.fn(),
}));

import { sendJoin } from '../../lib/commands';

function makeGameState(phase: GameStateSnapshot['phase']): GameStateSnapshot {
  return {
    phase,
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
  };
}

beforeEach(() => {
  gameState.set(null);
  balance.set(0);
  lastError.set(null);
  vi.clearAllMocks();
});

describe('BetForm component', () => {
  describe('visibility based on phase', () => {
    it('is visible when phase is WAITING (gameState null defaults to WAITING)', () => {
      render(BetForm);
      expect(screen.getByText('Place Your Bet')).toBeTruthy();
    });

    it('is visible when gameState phase is explicitly WAITING', () => {
      gameState.set(makeGameState('WAITING'));
      render(BetForm);
      expect(screen.getByText('Place Your Bet')).toBeTruthy();
    });

    it('is NOT visible when phase is RUNNING', () => {
      gameState.set(makeGameState('RUNNING'));
      render(BetForm);
      expect(screen.queryByText('Place Your Bet')).toBeNull();
    });

    it('is NOT visible when phase is STARTING', () => {
      gameState.set(makeGameState('STARTING'));
      render(BetForm);
      expect(screen.queryByText('Place Your Bet')).toBeNull();
    });

    it('is NOT visible when phase is CRASHED', () => {
      gameState.set(makeGameState('CRASHED'));
      render(BetForm);
      expect(screen.queryByText('Place Your Bet')).toBeNull();
    });
  });

  describe('Join Round button disabled state', () => {
    it('button is disabled when wager field is empty', () => {
      render(BetForm);
      const button = screen.getByRole('button', { name: 'Join Round' });
      expect(button).toBeDisabled();
    });

    it('button is disabled when wager is 0', async () => {
      render(BetForm);
      const wagerInput = screen.getByLabelText('Wager');
      await fireEvent.input(wagerInput, { target: { value: '0' } });
      await tick();
      const button = screen.getByRole('button', { name: 'Join Round' });
      expect(button).toBeDisabled();
    });

    it('button is disabled when wager is negative', async () => {
      render(BetForm);
      const wagerInput = screen.getByLabelText('Wager');
      await fireEvent.input(wagerInput, { target: { value: '-10' } });
      await tick();
      const button = screen.getByRole('button', { name: 'Join Round' });
      expect(button).toBeDisabled();
    });

    it('button is enabled when a valid positive wager is entered', async () => {
      render(BetForm);
      const wagerInput = screen.getByLabelText('Wager');
      await fireEvent.input(wagerInput, { target: { value: '100' } });
      await tick();
      const button = screen.getByRole('button', { name: 'Join Round' });
      expect(button).not.toBeDisabled();
    });

    it('button is disabled when wager is below minimum (0.05)', async () => {
      render(BetForm);
      const wagerInput = screen.getByLabelText('Wager');
      await fireEvent.input(wagerInput, { target: { value: '0.05' } });
      await tick();
      expect(screen.getByRole('button', { name: 'Join Round' })).toBeDisabled();
    });

    it('button is enabled when wager equals minimum (0.10)', async () => {
      render(BetForm);
      const wagerInput = screen.getByLabelText('Wager');
      await fireEvent.input(wagerInput, { target: { value: '0.10' } });
      await tick();
      expect(screen.getByRole('button', { name: 'Join Round' })).not.toBeDisabled();
    });

    it('button is enabled when wager equals maximum (1000.00)', async () => {
      render(BetForm);
      const wagerInput = screen.getByLabelText('Wager');
      await fireEvent.input(wagerInput, { target: { value: '1000' } });
      await tick();
      expect(screen.getByRole('button', { name: 'Join Round' })).not.toBeDisabled();
    });

    it('button is disabled when wager exceeds maximum (1000.01)', async () => {
      render(BetForm);
      const wagerInput = screen.getByLabelText('Wager');
      await fireEvent.input(wagerInput, { target: { value: '1000.01' } });
      await tick();
      expect(screen.getByRole('button', { name: 'Join Round' })).toBeDisabled();
    });

    it('wager input has min="0.10" attribute', () => {
      render(BetForm);
      const wagerInput = screen.getByLabelText('Wager') as HTMLInputElement;
      expect(wagerInput.getAttribute('min')).toBe('0.10');
    });

    it('wager input has max="1000" attribute', () => {
      render(BetForm);
      const wagerInput = screen.getByLabelText('Wager') as HTMLInputElement;
      expect(wagerInput.getAttribute('max')).toBe('1000.00');
    });
  });

  describe('sendJoin calls', () => {
    it('calls sendJoin when Join Round is clicked with a valid wager', async () => {
      render(BetForm);
      const wagerInput = screen.getByLabelText('Wager');
      await fireEvent.input(wagerInput, { target: { value: '50' } });
      await tick();
      await fireEvent.click(screen.getByRole('button', { name: 'Join Round' }));
      await tick();
      expect(sendJoin).toHaveBeenCalledTimes(1);
    });

    it('calls sendJoin with correct wager, empty playerName, and null autoCashout', async () => {
      render(BetForm);
      const wagerInput = screen.getByLabelText('Wager');
      await fireEvent.input(wagerInput, { target: { value: '50' } });
      await tick();
      await fireEvent.click(screen.getByRole('button', { name: 'Join Round' }));
      await tick();
      expect(sendJoin).toHaveBeenCalledWith(50, '', null);
    });

    it('calls sendJoin with correct playerName when provided', async () => {
      render(BetForm);
      await fireEvent.input(screen.getByLabelText('Wager'), { target: { value: '25' } });
      await fireEvent.input(screen.getByLabelText('Name (optional)'), {
        target: { value: 'Alice' },
      });
      await tick();
      await fireEvent.click(screen.getByRole('button', { name: 'Join Round' }));
      await tick();
      expect(sendJoin).toHaveBeenCalledWith(25, 'Alice', null);
    });

    it('calls sendJoin with autoCashout number when auto-cashout is provided', async () => {
      render(BetForm);
      await fireEvent.input(screen.getByLabelText('Wager'), { target: { value: '100' } });
      await fireEvent.input(screen.getByLabelText('Auto-cashout at (optional)'), {
        target: { value: '2.5' },
      });
      await tick();
      await fireEvent.click(screen.getByRole('button', { name: 'Join Round' }));
      await tick();
      expect(sendJoin).toHaveBeenCalledWith(100, '', 2.5);
    });

    it('calls sendJoin with null autoCashout when auto-cashout field is empty', async () => {
      render(BetForm);
      await fireEvent.input(screen.getByLabelText('Wager'), { target: { value: '75' } });
      await tick();
      await fireEvent.click(screen.getByRole('button', { name: 'Join Round' }));
      await tick();
      const [, , autoCashoutArg] = (sendJoin as ReturnType<typeof vi.fn>).mock.calls[0]!;
      expect(autoCashoutArg).toBeNull();
    });

    it('does NOT call sendJoin when button is disabled (invalid wager)', async () => {
      render(BetForm);
      await fireEvent.click(screen.getByRole('button', { name: 'Join Round' }));
      await tick();
      expect(sendJoin).not.toHaveBeenCalled();
    });
  });

  describe('wager field cleared after join', () => {
    it('clears the wager input after a successful join', async () => {
      render(BetForm);
      const wagerInput = screen.getByLabelText('Wager') as HTMLInputElement;
      await fireEvent.input(wagerInput, { target: { value: '100' } });
      await tick();
      await fireEvent.click(screen.getByRole('button', { name: 'Join Round' }));
      await tick();
      expect(wagerInput.value).toBe('');
    });
  });

  describe('error message handling', () => {
    it('shows error message when lastError store is set', async () => {
      render(BetForm);
      lastError.set('Test error');
      await tick();
      expect(screen.getByText('Test error')).toBeTruthy();
    });

    it('wager input gets aria-describedby="wager-error" when error is present', async () => {
      render(BetForm);
      lastError.set('Bad wager');
      await tick();
      const wagerInput = screen.getByLabelText('Wager');
      expect(wagerInput.getAttribute('aria-describedby')).toBe('wager-error');
    });

    it('wager input gets aria-invalid="true" when error is present', async () => {
      render(BetForm);
      lastError.set('Bad wager');
      await tick();
      const wagerInput = screen.getByLabelText('Wager');
      expect(wagerInput.getAttribute('aria-invalid')).toBe('true');
    });

    it('wager input has no aria-describedby when there is no error', () => {
      render(BetForm);
      const wagerInput = screen.getByLabelText('Wager');
      expect(wagerInput.getAttribute('aria-describedby')).toBeNull();
    });

    it('wager input has no aria-invalid when there is no error', () => {
      render(BetForm);
      const wagerInput = screen.getByLabelText('Wager');
      expect(wagerInput.getAttribute('aria-invalid')).toBeNull();
    });

    it('error message div has id="wager-error" when error is shown', async () => {
      render(BetForm);
      lastError.set('Some error');
      await tick();
      const errorDiv = screen.getByText('Some error');
      expect(errorDiv.getAttribute('id')).toBe('wager-error');
    });

    it('error message is cleared on next join attempt', async () => {
      render(BetForm);

      // Trigger an error via store
      lastError.set('Previous error');
      await tick();
      expect(screen.getByText('Previous error')).toBeTruthy();

      // Enter a valid wager and join
      const wagerInput = screen.getByLabelText('Wager');
      await fireEvent.input(wagerInput, { target: { value: '100' } });
      await tick();
      await fireEvent.click(screen.getByRole('button', { name: 'Join Round' }));
      await tick();

      expect(screen.queryByText('Previous error')).toBeNull();
    });
  });

  describe('RTP notice', () => {
    it('shows house edge and RTP text when WAITING', () => {
      render(BetForm);
      expect(screen.getByText(/House edge:/)).toBeTruthy();
      expect(screen.getByText(/RTP:/)).toBeTruthy();
    });

    it('shows "House edge: 1%" when HOUSE_EDGE is 0.01', () => {
      render(BetForm);
      expect(screen.getByText(/House edge: 1%/)).toBeTruthy();
    });

    it('shows "RTP: 99%" when HOUSE_EDGE is 0.01', () => {
      render(BetForm);
      expect(screen.getByText(/RTP: 99%/)).toBeTruthy();
    });
  });
});
