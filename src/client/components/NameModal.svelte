<script lang="ts">
/**
 * Modal dialog for setting or changing the player's display name.
 * Shown on first visit (no stored name) and re-openable via the header.
 *
 * Uses the native <dialog> element for built-in focus trap, Escape key handling,
 * and proper ARIA semantics via showModal()/close().
 */
import { onMount } from 'svelte';
import { MAX_PLAYER_NAME_LENGTH } from '../../config';

let {
  onClose,
  initialName = '',
}: { onClose: (name: string | null) => void; initialName?: string } = $props();

let dialogEl: HTMLDialogElement;
// Intentionally capture initial value — we don't want the input to reactively
// update if the prop changes while the modal is open.
// svelte-ignore state_referenced_locally
let nameInput = $state(initialName);

onMount(() => {
  dialogEl.showModal();
});

function handleConfirm() {
  const trimmed = nameInput.trim();
  onClose(trimmed || null);
}

function handleSkip() {
  onClose(null);
}

function handleDialogClick(e: MouseEvent) {
  if (e.target === dialogEl) {
    onClose(null);
  }
}

function handleCancel(e: Event) {
  e.preventDefault();
  onClose(null);
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleConfirm();
  }
}
</script>

<dialog
  bind:this={dialogEl}
  class="modal"
  aria-labelledby="name-title"
  onclick={handleDialogClick}
  oncancel={handleCancel}
>
  <div class="modal-jp">識別子設定</div>
  <h3 id="name-title">CHOOSE YOUR HANDLE</h3>
  <p class="hint">// alias visible to all operators in this session</p>

  <input
    type="text"
    bind:value={nameInput}
    placeholder="anonymous"
    maxlength={MAX_PLAYER_NAME_LENGTH}
    onkeydown={handleKeydown}
  />

  <div class="actions">
    <button class="confirm-btn" onclick={handleConfirm}>[ CONFIRM ]</button>
    <button class="skip-btn" onclick={handleSkip}>[ SKIP ]</button>
  </div>
</dialog>

<style>
  .modal {
    background: #0a0800;
    border: 1px solid var(--color-border, #332800);
    border-radius: 0;
    padding: 1.5rem;
    max-width: 380px;
    width: 90%;
    font-family: 'Fira Code', monospace;
    color: var(--color-primary, #ffb000);
  }

  .modal::backdrop {
    background: rgba(0, 0, 0, 0.85);
  }

  .modal-jp {
    font-size: 0.65rem;
    color: var(--color-primary-dim, #805800);
    letter-spacing: 0.2em;
    margin-bottom: 0.25rem;
  }

  h3 {
    color: var(--color-primary, #ffb000);
    margin: 0 0 0.5rem;
    font-size: 1rem;
    letter-spacing: 0.15em;
    font-weight: 700;
  }

  .hint {
    color: var(--color-primary-dim, #805800);
    font-size: 0.75rem;
    margin: 0 0 1rem;
  }

  input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: #080600;
    border: 1px solid var(--color-border, #332800);
    border-radius: 0;
    color: var(--color-primary, #ffb000);
    font-size: 0.9rem;
    font-family: 'Fira Code', monospace;
    box-sizing: border-box;
  }

  input::placeholder {
    color: var(--color-primary-dim, #805800);
    opacity: 0.6;
  }

  input:focus {
    outline: none;
    border-color: var(--color-primary-mid, #cc8800);
  }

  input:focus-visible {
    outline: 1px solid var(--color-primary, #ffb000);
    outline-offset: 2px;
  }

  .actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .confirm-btn {
    flex: 1;
    padding: 0.5rem 1rem;
    background: transparent;
    border: 1px solid var(--color-primary, #ffb000);
    color: var(--color-primary, #ffb000);
    font-size: 0.85rem;
    font-family: 'Fira Code', monospace;
    cursor: pointer;
    letter-spacing: 0.05em;
  }

  .confirm-btn:hover {
    background: rgba(255, 176, 0, 0.1);
  }

  .skip-btn {
    padding: 0.5rem 1rem;
    background: transparent;
    border: 1px solid var(--color-border, #332800);
    color: var(--color-primary-dim, #805800);
    font-size: 0.85rem;
    font-family: 'Fira Code', monospace;
    cursor: pointer;
    letter-spacing: 0.05em;
  }

  .skip-btn:hover {
    border-color: var(--color-primary-dim, #805800);
    color: var(--color-primary-mid, #cc8800);
  }
</style>
