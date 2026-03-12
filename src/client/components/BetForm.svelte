<script lang="ts">
/**
 * Bet placement form. Visible only during WAITING phase.
 * Listens for the `crash:error` DOM CustomEvent (dispatched by `messageHandler.ts`)
 * to surface server-side validation errors (e.g., invalid wager, already joined).
 */

import { HOUSE_EDGE, MAX_WAGER, MIN_WAGER } from '../../config';
import { sendJoin } from '../lib/commands';
import { balance, phase } from '../lib/stores';

const houseEdgePct = Math.round(HOUSE_EDGE * 100);
const rtpPct = 100 - houseEdgePct;

let wager = '';
let playerName = '';
let autoCashoutStr = '';
let errorMessage = '';

// Listen for server-side error events
function handleErrorEvent(e: Event) {
  errorMessage = (e as CustomEvent<{ message: string }>).detail.message;
}

import { onDestroy, onMount } from 'svelte';

onMount(() => {
  document.addEventListener('crash:error', handleErrorEvent);
});

onDestroy(() => {
  document.removeEventListener('crash:error', handleErrorEvent);
});

$: wagerNum = parseFloat(wager);
$: autoCashoutNum = autoCashoutStr ? parseFloat(autoCashoutStr) : null;
$: isValid = !isNaN(wagerNum) && wagerNum >= MIN_WAGER && wagerNum <= MAX_WAGER;

function handleJoin() {
  if (!isValid) return;
  errorMessage = '';
  sendJoin(wagerNum, playerName || '', autoCashoutNum);
  wager = '';
  autoCashoutStr = '';
}
</script>

{#if $phase === 'WAITING'}
  <div class="bet-form">
    <h3>Place Your Bet</h3>

    {#if errorMessage}
      <div class="error">{errorMessage}</div>
    {/if}

    <div class="field">
      <label for="wager">Wager</label>
      <input
        id="wager"
        type="number"
        bind:value={wager}
        placeholder="0"
        min={MIN_WAGER}
        max={MAX_WAGER}
        step="0.01"
      />
    </div>

    <div class="field">
      <label for="name">Name (optional)</label>
      <input
        id="name"
        type="text"
        bind:value={playerName}
        placeholder="Anonymous"
        maxlength="20"
      />
    </div>

    <div class="field">
      <label for="auto-cashout">Auto-cashout at (optional)</label>
      <input
        id="auto-cashout"
        type="number"
        bind:value={autoCashoutStr}
        placeholder="e.g. 2.00"
        min="1.01"
        step="0.01"
      />
    </div>

    <button
      class="join-btn"
      on:click={handleJoin}
      disabled={!isValid}
    >
      Join Round
    </button>

    <div class="balance">Balance: {$balance >= 0 ? '+' : ''}{$balance.toFixed(2)}</div>
    <p class="rtp-notice">Game of chance · House edge: {houseEdgePct}% · RTP: {rtpPct}%</p>
  </div>
{/if}

<style>
  .bet-form {
    padding: 1rem;
    border: 1px solid #333;
    border-radius: 8px;
  }

  h3 {
    margin: 0 0 1rem;
    color: #aaa;
    font-size: 1rem;
  }

  .error {
    color: #d32f2f;
    font-size: 0.9rem;
    margin-bottom: 0.75rem;
    padding: 0.5rem;
    background: rgba(211, 47, 47, 0.1);
    border-radius: 4px;
  }

  .field {
    margin-bottom: 0.75rem;
  }

  label {
    display: block;
    font-size: 0.85rem;
    color: #888;
    margin-bottom: 0.25rem;
  }

  input {
    width: 100%;
    padding: 0.5rem;
    background: #0d0d1a;
    border: 1px solid #333;
    border-radius: 4px;
    color: #fff;
    font-size: 1rem;
    box-sizing: border-box;
  }

  input:focus {
    outline: none;
    border-color: #666;
  }

  .join-btn {
    width: 100%;
    padding: 0.75rem;
    background: #1565c0;
    border: none;
    border-radius: 6px;
    color: #fff;
    font-size: 1rem;
    font-weight: bold;
    cursor: pointer;
    margin-top: 0.5rem;
  }

  .join-btn:hover:not(:disabled) {
    background: #1976d2;
  }

  .join-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .balance {
    margin-top: 0.75rem;
    text-align: center;
    font-size: 0.9rem;
    color: #888;
  }

  .rtp-notice {
    margin-top: 0.5rem;
    text-align: center;
    font-size: 0.75rem;
    color: #555;
  }
</style>
