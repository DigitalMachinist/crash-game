import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it } from 'vitest';
import type { HistoryEntry } from '../../../types';
import { history } from '../../lib/stores';
import History from '../History.svelte';

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    roundId: 42,
    crashPoint: 3.5,
    roundSeed: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    drandRound: 100,
    drandRandomness: 'deadbeefdeadbeef',
    chainCommitment: 'feedfacefeedfacefeedfacefeedface',
    ...overrides,
  };
}

beforeEach(() => {
  history.set([]);
});

describe('History component', () => {
  describe('empty state', () => {
    it('shows "No rounds yet" when history is empty', () => {
      render(History);
      expect(screen.getByText('No rounds yet')).toBeTruthy();
    });

    it('does NOT show "No rounds yet" when history has entries', () => {
      history.set([makeEntry()]);
      render(History);
      expect(screen.queryByText('No rounds yet')).toBeNull();
    });
  });

  describe('round list rendering', () => {
    it('shows round ID as "#42" for a round with roundId=42', () => {
      history.set([makeEntry({ roundId: 42 })]);
      render(History);
      expect(screen.getByText('#42')).toBeTruthy();
    });

    it('shows crashPoint formatted as "3.50x"', () => {
      history.set([makeEntry({ crashPoint: 3.5 })]);
      render(History);
      expect(screen.getByText('3.50x')).toBeTruthy();
    });

    it('adds class "low" to crash-point span when crashPoint < 2', () => {
      history.set([makeEntry({ crashPoint: 1.23 })]);
      render(History);
      const span = screen.getByText('1.23x');
      expect(span.classList.contains('low')).toBe(true);
    });

    it('does NOT add class "low" to crash-point span when crashPoint >= 2', () => {
      history.set([makeEntry({ crashPoint: 2.5 })]);
      render(History);
      const span = screen.getByText('2.50x');
      expect(span.classList.contains('low')).toBe(false);
    });

    it('renders a "Verify" button for each round', () => {
      history.set([makeEntry()]);
      render(History);
      expect(screen.getByText('Verify')).toBeTruthy();
    });

    it('renders all entries when multiple history entries are present', () => {
      history.set([
        makeEntry({ roundId: 1, crashPoint: 1.5 }),
        makeEntry({ roundId: 2, crashPoint: 3.0 }),
        makeEntry({ roundId: 3, crashPoint: 5.75 }),
      ]);
      render(History);
      expect(screen.getByText('#1')).toBeTruthy();
      expect(screen.getByText('#2')).toBeTruthy();
      expect(screen.getByText('#3')).toBeTruthy();
      const verifyButtons = screen.getAllByText('Verify');
      expect(verifyButtons).toHaveLength(3);
    });
  });

  describe('verify modal', () => {
    it('opens the modal when "Verify" is clicked', () => {
      history.set([makeEntry()]);
      render(History);
      fireEvent.click(screen.getByText('Verify'));
      expect(screen.getByRole('dialog')).toBeTruthy();
    });

    it('modal shows correct roundId in heading: "Verify Round #42"', () => {
      history.set([makeEntry({ roundId: 42 })]);
      render(History);
      fireEvent.click(screen.getByText('Verify'));
      expect(screen.getByText('Verify Round #42')).toBeTruthy();
    });

    it('modal shows crash point formatted as "3.50x"', () => {
      history.set([makeEntry({ crashPoint: 3.5 })]);
      render(History);
      fireEvent.click(screen.getByText('Verify'));
      // The modal renders crash point in a <p> tag; getByRole('dialog') scopes the search
      const dialog = screen.getByRole('dialog');
      expect(dialog.textContent).toContain('3.50x');
    });

    it('modal shows truncated round seed (first 16 chars + "...")', () => {
      const roundSeed = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      history.set([makeEntry({ roundSeed })]);
      render(History);
      fireEvent.click(screen.getByText('Verify'));
      expect(screen.getByText('abcdef1234567890...')).toBeTruthy();
    });

    it('modal shows drand round number', () => {
      history.set([makeEntry({ drandRound: 100 })]);
      render(History);
      fireEvent.click(screen.getByText('Verify'));
      const dialog = screen.getByRole('dialog');
      expect(dialog.textContent).toContain('100');
    });

    it('dismisses the modal when "Close" button is clicked', () => {
      history.set([makeEntry()]);
      render(History);
      fireEvent.click(screen.getByText('Verify'));
      expect(screen.getByRole('dialog')).toBeTruthy();
      fireEvent.click(screen.getByText('Close'));
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('dismisses the modal when the backdrop is clicked', () => {
      history.set([makeEntry()]);
      render(History);
      fireEvent.click(screen.getByText('Verify'));
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeTruthy();
      // Native <dialog> backdrop click: clicking the dialog element itself (not its content)
      fireEvent.click(dialog);
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('dismisses the modal when Escape key is pressed on the backdrop', () => {
      history.set([makeEntry()]);
      render(History);
      fireEvent.click(screen.getByText('Verify'));
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeTruthy();
      // Native <dialog> fires a 'cancel' event on Escape; simulate it
      fireEvent(dialog, new Event('cancel'));
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('opens modal for the second entry when its Verify button is clicked', () => {
      history.set([
        makeEntry({ roundId: 1, crashPoint: 1.5 }),
        makeEntry({ roundId: 2, crashPoint: 4.0 }),
      ]);
      render(History);
      const verifyButtons = screen.getAllByText('Verify');
      fireEvent.click(verifyButtons[1]!);
      expect(screen.getByText('Verify Round #2')).toBeTruthy();
      expect(screen.queryByText('Verify Round #1')).toBeNull();
    });
  });
});
