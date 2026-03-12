import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HistoryEntry, VerificationResult } from '../../../types';
import VerifyModal from '../VerifyModal.svelte';

vi.mock('../../lib/verify', () => ({
  verifyRound: vi.fn(),
}));

import { verifyRound } from '../../lib/verify';

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
  vi.clearAllMocks();
});

describe('VerifyModal component', () => {
  describe('loading state', () => {
    it('shows "Verifying..." immediately while the async call is pending', () => {
      vi.mocked(verifyRound).mockReturnValue(new Promise(() => {}));
      const entry = makeEntry();
      render(VerifyModal, { props: { entry, onClose: vi.fn() } });
      expect(screen.getByText('Verifying...')).toBeInTheDocument();
    });
  });

  describe('success state', () => {
    it('shows "✓ Verified" and computed crash point on success', async () => {
      let resolve: (v: VerificationResult) => void;
      vi.mocked(verifyRound).mockReturnValue(
        new Promise((r) => {
          resolve = r;
        }),
      );
      const entry = makeEntry();
      render(VerifyModal, { props: { entry, onClose: vi.fn() } });
      expect(screen.getByText('Verifying...')).toBeInTheDocument();
      resolve!({
        valid: true,
        computedCrashPoint: 2.37,
        chainValid: true,
        drandRound: 100,
        drandRandomness: 'abc',
      });
      await Promise.resolve();
      await tick();
      expect(screen.getByText(/✓ Verified/)).toBeInTheDocument();
      expect(screen.getByText(/2\.37x/)).toBeInTheDocument();
    });
  });

  describe('failure states', () => {
    it('shows "✗ Chain link invalid" when reason is "chain link invalid"', async () => {
      let resolve: (v: VerificationResult) => void;
      vi.mocked(verifyRound).mockReturnValue(
        new Promise((r) => {
          resolve = r;
        }),
      );
      const entry = makeEntry();
      render(VerifyModal, { props: { entry, onClose: vi.fn() } });
      resolve!({
        valid: false,
        reason: 'chain link invalid',
        computedCrashPoint: 2.37,
        chainValid: false,
        drandRound: 100,
        drandRandomness: 'abc',
      });
      await Promise.resolve();
      await tick();
      expect(screen.getByText(/✗ Chain link invalid/)).toBeInTheDocument();
    });

    it('shows "✗ Crash point mismatch" with computed vs displayed when reason is "crash point mismatch"', async () => {
      let resolve: (v: VerificationResult) => void;
      vi.mocked(verifyRound).mockReturnValue(
        new Promise((r) => {
          resolve = r;
        }),
      );
      const entry = makeEntry({ crashPoint: 3.5 });
      render(VerifyModal, { props: { entry, onClose: vi.fn() } });
      resolve!({
        valid: false,
        reason: 'crash point mismatch',
        computedCrashPoint: 2.1,
        chainValid: true,
        drandRound: 100,
        drandRandomness: 'abc',
      });
      await Promise.resolve();
      await tick();
      expect(screen.getByText(/✗ Crash point mismatch/)).toBeInTheDocument();
      const mismatchEl = screen.getByText(/Computed:.*vs Displayed:/);
      expect(mismatchEl.textContent).toContain('2.10x');
      expect(mismatchEl.textContent).toContain('3.50x');
    });
  });

  describe('static info display', () => {
    it('always shows the round seed truncated to first 16 chars + "..."', () => {
      vi.mocked(verifyRound).mockReturnValue(new Promise(() => {}));
      const roundSeed = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      const entry = makeEntry({ roundSeed });
      render(VerifyModal, { props: { entry, onClose: vi.fn() } });
      expect(screen.getByText('abcdef1234567890...')).toBeInTheDocument();
    });

    it('always shows the drand round number', () => {
      vi.mocked(verifyRound).mockReturnValue(new Promise(() => {}));
      const entry = makeEntry({ drandRound: 100 });
      render(VerifyModal, { props: { entry, onClose: vi.fn() } });
      const dialog = screen.getByRole('dialog');
      expect(dialog.textContent).toContain('100');
    });
  });

  describe('interactions', () => {
    it('clicking "Close" button calls onClose', () => {
      vi.mocked(verifyRound).mockReturnValue(new Promise(() => {}));
      const onClose = vi.fn();
      const entry = makeEntry();
      render(VerifyModal, { props: { entry, onClose } });
      fireEvent.click(screen.getByText('Close'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('clicking the backdrop calls onClose', () => {
      vi.mocked(verifyRound).mockReturnValue(new Promise(() => {}));
      const onClose = vi.fn();
      const entry = makeEntry();
      render(VerifyModal, { props: { entry, onClose } });
      fireEvent.click(document.querySelector('.modal-backdrop')!);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('pressing Escape on the backdrop calls onClose', () => {
      vi.mocked(verifyRound).mockReturnValue(new Promise(() => {}));
      const onClose = vi.fn();
      const entry = makeEntry();
      render(VerifyModal, { props: { entry, onClose } });
      fireEvent.keyDown(document.querySelector('.modal-backdrop')!, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('verifyRound call', () => {
    it('calls verifyRound with the correct params from the entry prop', () => {
      vi.mocked(verifyRound).mockReturnValue(new Promise(() => {}));
      const entry = makeEntry();
      render(VerifyModal, { props: { entry, onClose: vi.fn() } });
      expect(verifyRound).toHaveBeenCalledWith({
        roundSeed: entry.roundSeed,
        chainCommitment: entry.chainCommitment,
        drandRound: entry.drandRound,
        drandRandomness: entry.drandRandomness,
        displayedCrashPoint: entry.crashPoint,
      });
    });
  });
});
