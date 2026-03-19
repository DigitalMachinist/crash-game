<script lang="ts">
/**
 * Displays the server-broadcast round history and orchestrates the
 * `VerifyModal` — opens it with the selected round's `HistoryEntry` data.
 */

import { history } from '../lib/stores';
import { getThreatColor } from '../lib/threat';
import VerifyModal from './VerifyModal.svelte';

let verifyEntry: (typeof $history)[number] | null = null;

function openVerify(entry: (typeof $history)[number]) {
  verifyEntry = entry;
}

function closeVerify() {
  verifyEntry = null;
}
</script>

<div class="history">
  <div class="panel-label">最近 RECENT OPS</div>
  {#if $history.length === 0}
    <p class="empty">No rounds yet</p>
  {:else}
    <ul>
      {#each $history as entry (entry.roundId)}
        <li>
          <span class="round-id">#{entry.roundId}</span>
          <span class="crash-point" style:color={getThreatColor(entry.crashPoint)}>
            {entry.crashPoint.toFixed(2)}x
          </span>
          <button class="verify-btn" onclick={() => openVerify(entry)}>[ verify ]</button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

{#if verifyEntry !== null}
  <VerifyModal entry={verifyEntry} onClose={closeVerify} />
{/if}

<style>
  .history {
    padding: 0.5rem;
  }

  .panel-label {
    font-family: 'Space Mono', system-ui, monospace;
    font-size: 9px;
    color: var(--color-primary-dim-text);
    letter-spacing: 0.1em;
    margin-bottom: 0.4rem;
  }

  .empty {
    font-family: 'Fira Code', monospace;
    font-size: 10px;
    color: var(--color-primary-dim-text);
    font-style: normal;
    margin: 0;
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  li {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.2rem 0;
    border-bottom: 1px solid rgba(51, 40, 0, 0.3);
    font-family: 'Fira Code', monospace;
    font-size: 10px;
  }

  .round-id {
    color: var(--color-primary-dim-text);
    min-width: 2.5rem;
  }

  .crash-point {
    flex: 1;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 4.5rem;
  }

  .verify-btn {
    background: none;
    border: 1px solid var(--color-primary-dim);
    color: var(--color-primary-dim-text);
    padding: 0.1rem 0.3rem;
    cursor: pointer;
    font-family: 'Fira Code', monospace;
    font-size: 9px;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }

  .verify-btn:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .verify-btn:focus-visible {
    outline: 1px solid var(--color-primary);
    outline-offset: 2px;
  }
</style>
