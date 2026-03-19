<script lang="ts">
/**
 * Bet placement form. Visible only during WAITING phase.
 * Watches the `lastError` store (set by `message-handler.ts`) to surface
 * server-side validation errors (e.g., invalid wager, already joined).
 */

import { MAX_WAGER, MIN_WAGER, WAGER_PRESETS } from '../../config';
import { sendJoin } from '../lib/commands';
import { balance, countdown, lastError, myPlayerId, phase, players } from '../lib/stores';

let wager = $state('');
let autoCashoutStr = $state('');
let errorMessage = $state('');

$effect(() => {
  if ($lastError) {
    errorMessage = $lastError;
    lastError.set(null);
  }
});

const wagerNum = $derived(parseFloat(wager));
const autoCashoutNum = $derived(autoCashoutStr ? parseFloat(autoCashoutStr) : null);
const isValid = $derived(!isNaN(wagerNum) && wagerNum >= MIN_WAGER && wagerNum <= MAX_WAGER);
const countdownSec = $derived(Math.ceil($countdown / 1000));
const hasJoined = $derived($players[$myPlayerId] !== undefined);

function setWager(amount: number) {
  wager = amount.toFixed(2);
}

function handleJoin() {
  if (!isValid) return;
  errorMessage = '';
  sendJoin(wagerNum, autoCashoutNum);
}
</script>

{#if $phase === 'WAITING'}
  <div class="bet-form">
    <div class="panel-label"><span class="jp">資源配分</span> RESOURCES</div>

    {#if errorMessage}
      <div id="wager-error" class="error">{errorMessage}</div>
    {/if}

    <div class="field">
      <label for="wager">ALLOCATE CREDITS:</label>
      <input
        id="wager"
        type="number"
        bind:value={wager}
        placeholder="0.00"
        min={MIN_WAGER.toFixed(2)}
        max={MAX_WAGER.toFixed(2)}
        step="0.01"
        aria-label="Wager"
        aria-describedby={errorMessage ? 'wager-error' : undefined}
        aria-invalid={errorMessage ? 'true' : undefined}
      />
      <div class="presets" role="group" aria-label="Wager presets">
        {#each WAGER_PRESETS as amount}
          <button
            type="button"
            class:active={wagerNum === amount}
            onclick={() => setWager(amount)}
          >[ {amount} ]</button>
        {/each}
      </div>
    </div>

    <div class="field field-secondary">
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
      onclick={handleJoin}
      disabled={!isValid || hasJoined}
    >{hasJoined ? '[ BREACH INITIATED ]' : '[ INITIATE BREACH ]'}</button>

    {#if hasJoined}
      <div class="join-status">AWAITING ROUND START</div>
    {/if}

    <div class="window-countdown">WINDOW: {countdownSec}s</div>

    <div class="balance-row">
      BALANCE: <span class="balance-val">{$balance.toFixed(2)} CR</span>
    </div>
  </div>
{/if}

<style>
  .bet-form {
    position: relative;
    border: 1px solid var(--color-primary-mid);
    padding: 0.75rem;
    padding-top: 1rem;
    font-family: 'Fira Code', monospace;
    font-size: 12px;
    background: var(--color-bg-card);
    flex: 1;
  }

  .panel-label {
    position: absolute;
    top: -0.55em;
    left: 0.75rem;
    background: var(--color-bg-card);
    padding: 0 0.25rem;
    font-family: 'Space Mono', monospace;
    font-size: 9px;
    letter-spacing: 0.12em;
    color: var(--color-primary-mid);
    white-space: nowrap;
  }

  .jp {
    font-family: system-ui, sans-serif;
    font-size: 0.65rem;
    letter-spacing: 0.2em;
    opacity: 0.5;
    color: var(--color-primary-mid);
  }

  .error {
    color: var(--color-severe);
    font-size: 11px;
    margin-bottom: 0.5rem;
    padding: 0.4rem 0.5rem;
    background: rgba(255, 68, 0, 0.08);
    border: 1px solid var(--color-severe);
  }

  .field {
    margin-bottom: 0.6rem;
  }

  label {
    display: block;
    font-size: 10px;
    color: var(--color-primary-dim-text);
    margin-bottom: 0.25rem;
    letter-spacing: 0.08em;
  }

  input {
    width: 100%;
    padding: 0.4rem 0.5rem;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    color: var(--color-primary);
    font-size: 13px;
    font-family: 'Fira Code', monospace;
    box-sizing: border-box;
    caret-color: var(--color-primary);
  }

  input:focus {
    border-color: var(--color-primary-mid);
    outline: none;
  }

  input:focus-visible {
    outline: 1px solid var(--color-primary-mid);
    outline-offset: 1px;
  }

  input::placeholder {
    color: var(--color-primary-dim-text);
    opacity: 0.5;
  }

  .presets {
    display: flex;
    gap: 0.25rem;
    margin-top: 0.4rem;
  }

  .presets button {
    flex: 1;
    padding: 0.25rem 0;
    background: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-primary-dim-text);
    font-size: 10px;
    font-family: 'Fira Code', monospace;
    cursor: pointer;
    transition: all 0.1s;
  }

  .presets button:hover,
  .presets button.active {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .field-secondary label {
    font-size: 9px;
    color: var(--color-primary-dim-text);
    opacity: 0.7;
  }

  .field-secondary input {
    padding: 0.3rem 0.5rem;
    font-size: 12px;
    border-color: var(--color-border);
  }

  .join-btn {
    width: 100%;
    padding: 0.6rem;
    background: transparent;
    border: 1px solid var(--color-primary);
    color: var(--color-primary);
    font-size: 12px;
    font-family: 'Fira Code', monospace;
    font-weight: 700;
    letter-spacing: 0.08em;
    cursor: pointer;
    margin-top: 0.25rem;
    transition: all 0.1s;
  }

  .join-btn:hover:not(:disabled) {
    background: rgba(255, 176, 0, 0.08);
    border-color: var(--color-primary-mid);
  }

  .join-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    border-color: var(--color-border);
    color: var(--color-primary-dim-text);
  }

  .join-status {
    margin-top: 0.25rem;
    text-align: center;
    font-size: 10px;
    color: var(--color-primary-dim-text);
    letter-spacing: 0.08em;
  }

  .window-countdown {
    margin-top: 0.4rem;
    text-align: center;
    font-size: 10px;
    color: var(--color-primary-dim-text);
    letter-spacing: 0.08em;
  }

  .balance-row {
    margin-top: 0.4rem;
    font-size: 10px;
    color: var(--color-primary-dim-text);
    letter-spacing: 0.06em;
  }

  .balance-val {
    color: var(--color-success);
  }
</style>
