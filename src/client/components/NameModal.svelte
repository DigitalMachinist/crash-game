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
  <h3 id="name-title">Set Your Name</h3>
  <p class="hint">Choose a display name for other players to see.</p>

  <input
    type="text"
    bind:value={nameInput}
    placeholder="Anonymous"
    maxlength={MAX_PLAYER_NAME_LENGTH}
    onkeydown={handleKeydown}
  />

  <div class="actions">
    <button class="confirm-btn" onclick={handleConfirm}>Confirm</button>
    <button class="skip-btn" onclick={handleSkip}>Skip</button>
  </div>
</dialog>

<style>
  .modal {
    background: #1a1a2e;
    border: 1px solid #333;
    border-radius: 8px;
    padding: 1.5rem;
    max-width: 380px;
    width: 90%;
  }

  .modal::backdrop {
    background: rgba(0, 0, 0, 0.7);
  }

  h3 {
    color: #fff;
    margin: 0 0 0.5rem;
    font-size: 1.25rem;
  }

  .hint {
    color: #888;
    font-size: 0.9rem;
    margin: 0 0 1rem;
  }

  input {
    width: 100%;
    padding: 0.6rem;
    background: #0d0d1a;
    border: 1px solid #333;
    border-radius: 4px;
    color: #fff;
    font-size: 1rem;
    box-sizing: border-box;
  }

  input:focus {
    border-color: #666;
  }

  input:focus-visible {
    outline: 2px solid #42a5f5;
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
    background: #1565c0;
    border: none;
    border-radius: 4px;
    color: #fff;
    font-size: 0.95rem;
    cursor: pointer;
  }

  .confirm-btn:hover {
    background: #1976d2;
  }

  .skip-btn {
    padding: 0.5rem 1rem;
    background: #333;
    border: none;
    border-radius: 4px;
    color: #aaa;
    font-size: 0.95rem;
    cursor: pointer;
  }

  .skip-btn:hover {
    background: #444;
    color: #e0e0e0;
  }
</style>
