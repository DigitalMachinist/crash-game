<script lang="ts">
import { myPlayerId, phase, playersList, threatLevel } from '../lib/stores';

const isHighThreat = $derived(
  $threatLevel === 'HIGH' || $threatLevel === 'SEVERE' || $threatLevel === 'CRITICAL',
);
</script>

<div class="operators-panel">
  <div class="panel-label">作戦員 OPERATORS</div>
  {#if $playersList.length === 0}
    <p class="empty">No operators</p>
  {:else}
    <ul class="operator-list">
      {#each $playersList as player (player.playerId)}
        <li
          class="operator-row"
          class:me={player.playerId === $myPlayerId}
          class:crossed={player.cashedOut && isHighThreat}
        >
          <span class="handle">
            {player.name}
          </span>
          <span class="wager">{player.wager} CR</span>
          <span class="status">
            {#if player.cashedOut && player.cashoutMultiplier !== null}
              <span class="dc">DC {player.cashoutMultiplier.toFixed(2)}x</span>
            {:else if $phase === 'WAITING' || $phase === 'STARTING'}
              <span class="rdy">RDY</span>
            {:else}
              <span class="dash">—</span>
            {/if}
          </span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .operators-panel {
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

  .operator-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .operator-row {
    display: flex;
    align-items: baseline;
    gap: 0.35rem;
    padding: 0.2rem 0;
    font-family: 'Fira Code', monospace;
    font-size: 10px;
    border-bottom: 1px solid rgba(51, 40, 0, 0.4);
  }

  .operator-row.me {
    background: rgba(255, 176, 0, 0.04);
  }

  .operator-row.crossed .handle {
    text-decoration: line-through;
    color: var(--color-primary-dim-text);
  }

  .handle {
    color: var(--threat-color, var(--color-primary));
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .wager {
    color: var(--color-primary-dim-text);
    white-space: nowrap;
  }

  .status {
    white-space: nowrap;
    min-width: 4rem;
    text-align: right;
  }

  .dc {
    color: var(--color-success);
  }

  .rdy {
    color: var(--color-success);
  }

  .dash {
    color: var(--color-primary-dim-text);
  }
</style>
