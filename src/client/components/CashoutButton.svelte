<script lang="ts">
/**
 * Cashout button. Rendered only when `$phase === 'RUNNING'` and `$isInRound`
 * is true (the local player is active and has not yet cashed out).
 * Uses the `isInRound` derived store from `stores.ts`.
 *
 * Loading state resets reactively when `$isInRound` transitions to false
 * (server confirmed cashout or round ended). A 5-second fallback timeout
 * handles the edge case where the server never responds (e.g. socket drop).
 */

import { sendCashout } from '../lib/commands';
import {
  cashoutThreatLevel,
  displayMultiplier,
  isInRound,
  myPlayerId,
  phase,
  players,
  threatLevel,
} from '../lib/stores';

let isLoading = $state(false);
let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

const isCritical = $derived($threatLevel === 'CRITICAL');
const isMid = $derived($threatLevel === 'HIGH' || $threatLevel === 'SEVERE');
const btnClass = $derived(isCritical ? 'btn-crit' : isMid ? 'btn-mid' : 'btn-low');
const btnText = $derived(isCritical ? '!! BAIL OUT !!' : '[ DISCONNECT ]');

const myWager = $derived($players[$myPlayerId]?.wager ?? 0);
const estimatedPayout = $derived((myWager * $displayMultiplier).toFixed(2));
const payoutColor = $derived(
  isCritical
    ? 'var(--color-critical-dim)'
    : isMid
      ? 'var(--color-elevated-dim)'
      : 'var(--color-success-dim)',
);

function handleCashout() {
  if (isLoading) return;
  isLoading = true;
  cashoutThreatLevel.set($threatLevel);
  sendCashout();
  fallbackTimer = setTimeout(() => {
    isLoading = false;
  }, 5000);
}

$effect(() => {
  if (!$isInRound && isLoading) {
    clearTimeout(fallbackTimer);
    isLoading = false;
  }
});
</script>

{#if $phase === 'RUNNING' && $isInRound}
  <div class="cashout-container">
    <button
      class="cashout-btn {btnClass}"
      onclick={handleCashout}
      disabled={isLoading}
    >
      {#if isLoading}
        [ ... ]
      {:else}
        {btnText}
      {/if}
    </button>
    {#if !isLoading && myWager > 0}
      <div class="payout-line" style:color={payoutColor}>
        Cash out: {$displayMultiplier.toFixed(2)}x → {estimatedPayout} CR
      </div>
    {/if}
  </div>
{/if}

<style>
  .cashout-container {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
  }

  .cashout-btn {
    padding: 0.75rem 2.5rem;
    background: transparent;
    border: 2px solid;
    color: inherit;
    font-family: 'Fira Code', monospace;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    letter-spacing: 0.1em;
    transition: opacity 0.1s;
    min-width: 200px;
  }

  .cashout-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-low {
    color: #00cc66;
    border-color: #00cc66;
  }

  .btn-mid {
    color: #ff6600;
    border-color: #ff6600;
  }

  .btn-crit {
    color: #ff0040;
    border-color: #ff0040;
    background: rgba(255, 0, 64, 0.08);
    animation: pulse 0.8s infinite;
  }

  .payout-line {
    font-family: 'Fira Code', monospace;
    font-size: 10px;
  }
</style>
