<script lang="ts">
/**
 * Modal dialog for client-side provably fair verification of a completed round.
 * Calls `verifyRound()` on mount and displays the chain link validity and
 * computed crash point alongside the round's public ingredients.
 *
 * Uses the native <dialog> element for built-in focus trap, Escape key handling,
 * and proper ARIA semantics via showModal()/close().
 *
 * @see docs/provably-fair.md §2.7
 */
import { onMount } from 'svelte';
import type { HistoryEntry, VerificationResult } from '../../../types';
import { verifyRound } from '../lib/verify';

let { entry, onClose }: { entry: HistoryEntry; onClose: () => void } = $props();

let result: VerificationResult | null = null;
let loading = true;
let dialogEl: HTMLDialogElement;

onMount(async () => {
  dialogEl.showModal();
  result = await verifyRound({
    roundSeed: entry.roundSeed,
    chainCommitment: entry.chainCommitment,
    drandRound: entry.drandRound,
    drandRandomness: entry.drandRandomness,
    displayedCrashPoint: entry.crashPoint,
  });
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
  <h3>Verify Round #{entry.roundId}</h3>
  <p><strong>Crash Point:</strong> {entry.crashPoint.toFixed(2)}x</p>
  <p><strong>Round Seed:</strong> <code>{entry.roundSeed.slice(0, 16)}...</code></p>
  <p><strong>drand Round:</strong> {entry.drandRound}</p>
  <p><strong>Chain Commitment:</strong> <code>{entry.chainCommitment.slice(0, 16)}...</code></p>

  <div class="verification-status">
    {#if loading}
      <p class="status-loading">Verifying...</p>
    {:else if result !== null && result.valid}
      <p class="status-valid">✓ Verified</p>
      {#if result.computedCrashPoint !== undefined}
        <p class="computed">Computed crash point: {result.computedCrashPoint.toFixed(2)}x</p>
      {/if}
    {:else if result !== null && result.reason === 'chain link invalid'}
      <p class="status-invalid">✗ Chain link invalid</p>
    {:else if result !== null && result.reason === 'crash point mismatch'}
      <p class="status-invalid">✗ Crash point mismatch</p>
      {#if result.computedCrashPoint !== undefined}
        <p class="mismatch-detail">
          Computed: {result.computedCrashPoint.toFixed(2)}x vs Displayed: {entry.crashPoint.toFixed(2)}x
        </p>
      {/if}
    {/if}
  </div>

  <button onclick={onClose}>Close</button>
</dialog>

<style>
  .modal {
    background: #1a1a2e;
    border: 1px solid #333;
    border-radius: 8px;
    padding: 1.5rem;
    max-width: 500px;
    width: 90%;
    cursor: default;
    color: #fff;
  }

  .modal::backdrop {
    background: rgba(0, 0, 0, 0.7);
    cursor: pointer;
  }

  .modal h3 {
    color: #fff;
    margin-top: 0;
  }

  code {
    font-family: monospace;
    background: #0d0d1a;
    padding: 0.1rem 0.3rem;
    border-radius: 3px;
    font-size: 0.85rem;
  }

  .verification-status {
    margin: 1rem 0;
  }

  .status-loading {
    color: #aaa;
    font-style: italic;
  }

  .status-valid {
    color: #4caf50;
    font-weight: bold;
  }

  .status-invalid {
    color: #d32f2f;
    font-weight: bold;
  }

  .computed,
  .mismatch-detail {
    color: #aaa;
    font-size: 0.9rem;
  }

  button {
    background: #333;
    border: none;
    color: #fff;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
  }

  button:hover {
    background: #444;
  }
</style>
