<script lang="ts">
import { displayMultiplier, multiplierAnimating, phase } from '../lib/stores';
</script>

<div class="multiplier-container" class:crashed-container={$phase === 'CRASHED'}>
  {#if $phase === 'STARTING'}
    <div class="multiplier starting">STARTING...</div>
  {:else}
    {#if $phase === 'CRASHED'}
      <div class="crashed-label">CRASHED!</div>
    {/if}
    <div
      class="multiplier"
      class:animating={$multiplierAnimating}
      class:live={$phase === 'RUNNING'}
      class:crashed={$phase === 'CRASHED'}
    >
      {$displayMultiplier.toFixed(2)}x
    </div>
  {/if}
</div>

<style>
  .multiplier-container {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .multiplier {
    font-size: 4rem;
    font-weight: bold;
    font-variant-numeric: tabular-nums;
    color: #888;
  }

  .multiplier.animating {
    transition: all 100ms linear;
  }

  .multiplier.live {
    color: #00c853;
  }

  .crashed-container {
    animation: crash-bg-flash 0.8s ease-out forwards;
  }

  .crashed-label {
    font-size: 1.5rem;
    font-weight: bold;
    color: #d32f2f;
    letter-spacing: 0.15em;
    animation: crash-label-appear 0.35s ease-out forwards;
  }

  .multiplier.crashed {
    color: #d32f2f;
    animation: crash-shake 0.5s ease-out forwards;
  }

  .starting {
    font-size: 2rem;
    color: #ffa000;
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  @keyframes crash-bg-flash {
    0%   { background: transparent; }
    15%  { background: rgba(211, 47, 47, 0.2); }
    100% { background: transparent; }
  }

  @keyframes crash-label-appear {
    0%   { opacity: 0; transform: scale(0.7) translateY(-8px); }
    60%  { transform: scale(1.08) translateY(2px); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
  }

  @keyframes crash-shake {
    0%   { transform: scale(1); }
    15%  { transform: scale(1.2) rotate(-3deg); }
    30%  { transform: scale(1.15) rotate(3deg); }
    45%  { transform: scale(1.1) rotate(-1.5deg); }
    60%  { transform: scale(1.05) rotate(1deg); }
    100% { transform: scale(1) rotate(0); }
  }
</style>
