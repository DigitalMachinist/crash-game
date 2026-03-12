import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// jsdom has limited <dialog> support — mock showModal/close globally so any
// component test that renders a <dialog> (VerifyModal, etc.) works correctly.
// showModal sets the `open` attribute so the element is accessible to getByRole.
HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
  this.setAttribute('open', '');
});
HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
  this.removeAttribute('open');
});
