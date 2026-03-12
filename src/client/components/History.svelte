<script lang="ts">
/**
 * Displays the server-broadcast round history and orchestrates the
 * `VerifyModal` — opens it with the selected round's `HistoryEntry` data.
 */
import { history } from '../lib/stores';
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
  <h3>Recent Rounds</h3>
  {#if $history.length === 0}
    <p class="empty">No rounds yet</p>
  {:else}
    <ul>
      {#each $history as entry (entry.roundId)}
        <li>
          <span class="round-id">#{entry.roundId}</span>
          <span class="crash-point" class:low={entry.crashPoint < 2}>
            {entry.crashPoint.toFixed(2)}x
          </span>
          <button class="verify-btn" on:click={() => openVerify(entry)}>Verify</button>
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
    padding: 1rem;
  }

  h3 {
    margin: 0 0 0.5rem;
    font-size: 1rem;
    color: #aaa;
  }

  .empty {
    color: #666;
    font-style: italic;
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0;
    border-bottom: 1px solid #222;
    font-size: 0.9rem;
  }

  .round-id {
    color: #666;
    min-width: 3rem;
  }

  .crash-point {
    flex: 1;
    font-weight: bold;
  }

  .crash-point.low {
    color: #d32f2f;
  }

  .verify-btn {
    background: none;
    border: 1px solid #444;
    color: #aaa;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    cursor: pointer;
    font-size: 0.8rem;
  }

  .verify-btn:hover {
    border-color: #888;
    color: #fff;
  }
</style>
