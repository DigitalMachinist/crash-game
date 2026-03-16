<script lang="ts">
import { getRarityColor } from '../lib/rarity';
import { myPlayerId, phase, playersList } from '../lib/stores';
</script>

<div class="player-list">
  <h3>Players</h3>
  {#if $playersList.length === 0}
    <p class="empty">No players yet</p>
  {:else}
    <table>
      <thead>
        <tr>
          <th scope="col">Player</th>
          <th scope="col">Wager</th>
          <th scope="col">Result</th>
        </tr>
      </thead>
      <tbody>
        {#each $playersList as player (player.playerId)}
          <tr class:me={player.playerId === $myPlayerId}>
            <td>
              {player.name}
              {#if player.autoCashout !== null}
                <span class="auto-badge">Auto: {player.autoCashout.toFixed(2)}x</span>
              {/if}
            </td>
            <td>${player.wager.toFixed(2)}</td>
            <td>
              {#if player.cashedOut && player.cashoutMultiplier !== null}
                <span class="cashed-out" style:color={getRarityColor(player.cashoutMultiplier)}>Won {player.cashoutMultiplier.toFixed(2)}x (+${(player.payout ?? 0).toFixed(2)})</span>
              {:else if $phase === 'CRASHED' && !player.cashedOut}
                <span class="lost">Lost</span>
              {:else}
                <span class="waiting-result">—</span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  .player-list {
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

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th, td {
    text-align: left;
    padding: 0.3rem 0.5rem;
    font-size: 0.9rem;
  }

  th {
    color: #888;
    font-weight: normal;
    border-bottom: 1px solid #333;
  }

  tr.me {
    background: rgba(255, 255, 255, 0.05);
  }

  .auto-badge {
    font-size: 0.75rem;
    color: #ffa000;
    margin-left: 0.5rem;
  }

  .cashed-out {
    /* color set via inline style:color (rarity tier) */
  }

  .lost {
    color: #d32f2f;
  }

  .waiting-result {
    color: #666;
  }
</style>
