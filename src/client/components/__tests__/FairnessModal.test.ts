import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import FairnessModal from '../FairnessModal.svelte';

describe('FairnessModal component', () => {
  describe('rendering', () => {
    it('renders the modal with a heading about fairness', () => {
      render(FairnessModal, { props: { onClose: vi.fn() } });
      // Multiple headings may match /provably fair/i (e.g. h3 title + h4 section)
      expect(screen.getAllByRole('heading', { name: /provably fair/i }).length).toBeGreaterThan(0);
    });

    it('contains text about drand', () => {
      render(FairnessModal, { props: { onClose: vi.fn() } });
      // "drand" appears multiple times in the explanation — check at least one exists
      expect(screen.getAllByText(/drand/i).length).toBeGreaterThan(0);
    });

    it('contains text about hash chain', () => {
      render(FairnessModal, { props: { onClose: vi.fn() } });
      expect(screen.getAllByText(/hash chain/i).length).toBeGreaterThan(0);
    });

    it('contains text about verifying results', () => {
      render(FairnessModal, { props: { onClose: vi.fn() } });
      // "verify/verification" appears in multiple sections
      expect(screen.getAllByText(/verif/i).length).toBeGreaterThan(0);
    });

    it('contains text about pre-commitment', () => {
      render(FairnessModal, { props: { onClose: vi.fn() } });
      // "commit/committed/commitment" appears multiple times
      expect(screen.getAllByText(/pre-commit|before.*bet|commit/i).length).toBeGreaterThan(0);
    });
  });

  describe('interactions', () => {
    it('clicking "Close" button calls onClose', () => {
      const onClose = vi.fn();
      render(FairnessModal, { props: { onClose } });
      fireEvent.click(screen.getByRole('button', { name: /close/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('clicking the backdrop calls onClose', () => {
      const onClose = vi.fn();
      render(FairnessModal, { props: { onClose } });
      fireEvent.click(document.querySelector('.modal-backdrop')!);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('pressing Escape on the backdrop calls onClose', () => {
      const onClose = vi.fn();
      render(FairnessModal, { props: { onClose } });
      fireEvent.keyDown(document.querySelector('.modal-backdrop')!, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
