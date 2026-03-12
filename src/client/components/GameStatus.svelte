<script lang="ts">
import { countdown, phase, players } from '../lib/stores';

$: countdownSec = Math.ceil($countdown / 1000);
$: playerCount = Object.keys($players).length;
</script>

<div class="game-status" role="status" aria-live="assertive">
  {#if $phase === 'WAITING'}
    <div class="status waiting">
      <span class="label">Next round in</span>
      <span class="value">{countdownSec}s</span>
    </div>
  {:else if $phase === 'STARTING'}
    <div class="status starting">Round starting...</div>
  {:else if $phase === 'RUNNING'}
    <div class="status live">
      <span class="live-dot"></span>
      LIVE
    </div>
  {:else if $phase === 'CRASHED'}
    <div class="status crashed">
      {#if playerCount === 0}
        <span>No players this round</span>
      {:else}
        <span>CRASHED!</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .game-status {
    padding: 0.5rem 1rem;
    font-size: 1rem;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .waiting .value {
    font-weight: bold;
    font-variant-numeric: tabular-nums;
  }

  .live {
    color: #00c853;
    font-weight: bold;
  }

  .live-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #00c853;
    animation: blink 1s ease-in-out infinite;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  .crashed {
    color: #d32f2f;
    font-weight: bold;
    font-size: 1.1rem;
  }

  .starting {
    color: #ffa000;
  }
</style>
