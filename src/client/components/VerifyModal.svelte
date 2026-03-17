<script lang="ts">
/**
 * Modal dialog for client-side provably fair verification of a completed round.
 * Calls `verifyRound()` on mount and displays the chain link validity and
 * computed crash point alongside the round's public ingredients.
 *
 * Uses the native <dialog> element for built-in focus trap, Escape key handling,
 * and proper ARIA semantics via showModal()/close().
 *
 * @see docs/provably-fair.md §1.7
 */
import { onMount } from 'svelte';
import type { HistoryEntry, VerificationResult } from '../../../types';
import { verifyRound } from '../lib/verify';

let { entry, onClose }: { entry: HistoryEntry; onClose: () => void } = $props();

let result: VerificationResult | null = $state(null);
let loading = $state(true);
let dialogEl: HTMLDialogElement;

onMount(async () => {
  dialogEl.showModal();
  try {
    result = await verifyRound({
      roundSeed: entry.roundSeed,
      chainCommitment: entry.chainCommitment,
      drandRound: entry.drandRound,
      drandRandomness: entry.drandRandomness,
      displayedCrashPoint: entry.crashPoint,
    });
  } catch (err) {
    console.warn('[VerifyModal] verifyRound failed:', err);
    result = { valid: false, reason: 'Verification error (WebCrypto unavailable)' };
  }
  loading = false;
});

function handleDialogClick(e: MouseEvent) {
  // Backdrop click: the target is the <dialog> element itself (not its content)
  if (e.target === dialogEl) {
    onClose();
  }
}

function handleCancel(e: Event) {
  // Native cancel event fires when Escape is pressed; prevent default close and delegate to onClose
  e.preventDefault();
  onClose();
}
</script>

<dialog
  bind:this={dialogEl}
  class="modal"
  onclick={handleDialogClick}
  oncancel={handleCancel}
>
  <div class="modal-jp">ラウンド検証</div>
  <h3>Verify Round #{entry.roundId}</h3>
  <p><strong>Crash Point:</strong> {entry.crashPoint.toFixed(2)}x</p>
  <p><strong>Round Seed:</strong> <code>{entry.roundSeed.slice(0, 16)}...</code></p>
  <p><strong>drand Round:</strong> {entry.drandRound}</p>
  <p><strong>Chain Commitment:</strong> <code>{entry.chainCommitment.slice(0, 16)}...</code></p>

  <div class="verification-status">
    {#if loading}
      <p class="status-loading">Verifying...</p>
    {:else if result !== null}
      {#if result.valid}
        <p class="status-valid">✓ Verified</p>
        {#if result.computedCrashPoint !== undefined}
          <p class="computed">Computed crash point: {result.computedCrashPoint.toFixed(2)}x</p>
        {/if}
      {:else if result.reason === 'chain link invalid'}
        <p class="status-invalid">✗ Chain link invalid</p>
      {:else if result.reason === 'crash point mismatch'}
        <p class="status-invalid">✗ Crash point mismatch</p>
        {#if result.computedCrashPoint !== undefined}
          <p class="mismatch-detail">
            Computed: {result.computedCrashPoint.toFixed(2)}x vs Displayed: {entry.crashPoint.toFixed(2)}x
          </p>
        {/if}
      {:else}
        <p class="status-invalid">✗ {result.reason ?? 'Verification failed'}</p>
      {/if}
    {/if}
  </div>

  <button onclick={onClose}>[ CLOSE ]</button>
</dialog>

<style>
  .modal {
    background: #0a0800;
    border: 1px solid var(--color-border, #332800);
    border-radius: 0;
    padding: 1.5rem;
    max-width: 500px;
    width: 90%;
    cursor: default;
    font-family: 'Fira Code', monospace;
    color: var(--color-primary, #ffb000);
  }

  .modal::backdrop {
    background: rgba(0, 0, 0, 0.85);
    cursor: pointer;
  }

  .modal-jp {
    font-size: 0.65rem;
    color: var(--color-primary-dim, #805800);
    letter-spacing: 0.2em;
    margin-bottom: 0.25rem;
  }

  .modal h3 {
    color: var(--color-primary, #ffb000);
    margin-top: 0;
    margin-bottom: 1rem;
    font-size: 0.95rem;
    letter-spacing: 0.1em;
  }

  p {
    color: var(--color-primary-dim, #805800);
    font-size: 0.85rem;
    margin: 0.35rem 0;
  }

  p strong {
    color: var(--color-primary-mid, #cc8800);
  }

  code {
    font-family: 'Fira Code', monospace;
    background: #080600;
    border: 1px solid var(--color-border, #332800);
    padding: 0.1rem 0.3rem;
    font-size: 0.8rem;
    color: var(--color-primary, #ffb000);
  }

  .verification-status {
    margin: 1rem 0;
    padding: 0.75rem;
    border: 1px solid var(--color-border, #332800);
    background: #080600;
  }

  .status-loading {
    color: var(--color-primary-dim, #805800);
    font-style: italic;
    font-size: 0.85rem;
  }

  .status-valid {
    color: var(--color-success, #00cc66);
    font-weight: bold;
    font-size: 0.9rem;
  }

  .status-invalid {
    color: var(--color-critical, #ff0040);
    font-weight: bold;
    font-size: 0.9rem;
  }

  .computed,
  .mismatch-detail {
    color: var(--color-primary-dim, #805800);
    font-size: 0.8rem;
    margin-top: 0.25rem;
  }

  button {
    background: transparent;
    border: 1px solid var(--color-border, #332800);
    color: var(--color-primary-dim, #805800);
    padding: 0.5rem 1rem;
    font-family: 'Fira Code', monospace;
    font-size: 0.85rem;
    cursor: pointer;
    margin-top: 0.5rem;
    letter-spacing: 0.05em;
  }

  button:hover {
    border-color: var(--color-primary-dim, #805800);
    color: var(--color-primary-mid, #cc8800);
  }
</style>
