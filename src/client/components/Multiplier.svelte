<script lang="ts">
import {
  dangerColors,
  displayMultiplier,
  multiplierAnimating,
  phase,
  threatLevel,
} from '../lib/stores';

// Throttled accessible label: only announce at 0.5x thresholds to avoid
// overwhelming screen readers with rapid 100ms updates during play.
const accessibleMultiplier = $derived(Math.floor($displayMultiplier * 2) / 2);
const value = $derived($displayMultiplier.toFixed(2) + 'x');

const accessibleLabel = $derived(
  $phase === 'STARTING'
    ? 'Round starting'
    : $phase === 'CRASHED'
      ? `Crashed at ${$displayMultiplier.toFixed(2)}x`
      : `${accessibleMultiplier.toFixed(1)}x`,
);

// Per-level text-shadow values (spec §9.2 — hardcoded, not derived from glowAlpha)
function getTextShadow(level: typeof $threatLevel): string {
  switch (level) {
    case 'GHOST':
    case 'LOW':
      return '0 0 8px rgba(255, 176, 0, 0.3)';
    case 'ELEVATED':
      return '0 0 10px rgba(255, 140, 0, 0.4)';
    case 'HIGH':
      return '0 0 10px rgba(255, 102, 0, 0.4)';
    case 'SEVERE':
      return '0 0 12px rgba(255, 68, 0, 0.5)';
    case 'CRITICAL':
      return '0 0 15px rgba(255, 0, 64, 0.6)';
  }
}

const isCritical = $derived($threatLevel === 'CRITICAL');
const isRunning = $derived($phase === 'RUNNING');
</script>

<div class="multiplier-container" aria-live="off">
  {#if $phase === 'STARTING'}
    <div class="multiplier starting">BREACHING...</div>
  {:else}
    {#if isRunning}
      <div class="live-label">侵入中 LIVE HACK</div>
    {/if}
    <div
      class="multiplier"
      class:animating={$multiplierAnimating}
      class:live={isRunning}
      class:crashed={$phase === 'CRASHED'}
      class:glitch={isCritical && isRunning}
      data-text={value}
      style:color={isRunning || $phase === 'CRASHED' ? $dangerColors.color : undefined}
      style:text-shadow={isRunning ? getTextShadow($threatLevel) : undefined}
    >
      {value}
    </div>
  {/if}
  <span class="sr-only" aria-live="polite" aria-atomic="true">{accessibleLabel}</span>
</div>

<style>
  /* Visually hidden but available to screen readers */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .multiplier-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .live-label {
    font-family: 'Space Mono', system-ui, monospace;
    font-size: 9px;
    color: var(--color-primary-dim-text);
    letter-spacing: 0.15em;
    margin-bottom: 0.25rem;
  }

  .multiplier {
    font-family: 'Fira Code', monospace;
    font-size: 3.5rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: #888;
    transition: color 1s, text-shadow 1s;
  }

  .multiplier.animating {
    transition: color 1s, text-shadow 1s, all 100ms linear;
  }

  .multiplier.live {
    /* color and text-shadow set via inline style */
  }

  .multiplier.crashed {
    /* color set via inline style */
  }

  .starting {
    font-size: 2rem;
    color: var(--color-primary-dim-text);
    animation: pulse 1s ease-in-out infinite;
  }

  /* .glitch references global keyframes gjit, g1, g2 defined in App.svelte */
  .glitch {
    position: relative;
    animation: gjit 0.15s infinite;
  }

  .glitch::before,
  .glitch::after {
    content: attr(data-text);
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background: var(--threat-bg, var(--color-bg));
  }

  .glitch::before {
    color: #ff0040;
    animation: g1 0.8s infinite;
    text-shadow: -2px 0 #ff0040;
  }

  .glitch::after {
    color: #ff6600;
    animation: g2 0.65s infinite;
    text-shadow: 2px 0 #ff6600;
  }
</style>
