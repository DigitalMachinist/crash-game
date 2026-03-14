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
import { isInRound, phase } from '../lib/stores';

let isLoading = $state(false);
let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

function handleCashout() {
  if (isLoading) return;
  isLoading = true;
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
      class="cashout-btn"
      onclick={handleCashout}
      disabled={isLoading}
    >
      {#if isLoading}
        Cashing out...
      {:else}
        CASH OUT
      {/if}
    </button>
  </div>
{/if}

<style>
  .cashout-container {
    padding: 1rem;
    display: flex;
    justify-content: center;
  }

  .cashout-btn {
    padding: 1rem 3rem;
    background: #d32f2f;
    border: none;
    border-radius: 8px;
    color: #fff;
    font-size: 1.5rem;
    font-weight: bold;
    cursor: pointer;
    transition: transform 0.1s, background 0.1s;
    min-width: 200px;
  }

  .cashout-btn:hover:not(:disabled) {
    background: #e53935;
    transform: scale(1.02);
  }

  .cashout-btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  .cashout-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
</style>
