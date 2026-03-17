<script lang="ts">
import type { Snippet } from 'svelte';
import type { ThreatLevel } from '../../../types';

let { threatLevel = 'GHOST', children }: { threatLevel?: ThreatLevel; children?: Snippet } =
  $props();

const isLowFlicker = $derived(
  threatLevel === 'GHOST' ||
    threatLevel === 'LOW' ||
    threatLevel === 'ELEVATED' ||
    threatLevel === 'HIGH',
);
const isHighFlicker = $derived(threatLevel === 'SEVERE' || threatLevel === 'CRITICAL');
const showVhs2 = $derived(threatLevel === 'SEVERE' || threatLevel === 'CRITICAL');
</script>

<div class="crt" class:flk-lo={isLowFlicker} class:flk-hi={isHighFlicker}>
  {@render children?.()}
  <div class="vhs"></div>
  {#if showVhs2}<div class="vhs2"></div>{/if}
</div>

<style>
  .crt {
    position: relative;
    overflow: hidden;
  }

  .crt::after {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      0deg,
      rgba(0, 0, 0, 0.12),
      rgba(0, 0, 0, 0.12) 1px,
      transparent 1px,
      transparent 2px
    );
    pointer-events: none;
    z-index: 10;
  }

  /* flk-lo and flk-hi reference global keyframes defined in App.svelte */
  .flk-lo {
    animation: flk-lo 3s infinite;
  }

  .flk-hi {
    animation: flk-hi 1.5s infinite;
  }

  .vhs {
    position: absolute;
    left: 0;
    right: 0;
    height: 3px;
    background: rgba(255, 255, 255, 0.03);
    z-index: 15;
    animation: vhs 3s linear infinite;
    pointer-events: none;
  }

  .vhs2 {
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    background: rgba(255, 255, 255, 0.025);
    z-index: 15;
    animation: vhs 4.7s linear infinite;
    animation-delay: -1.3s;
    pointer-events: none;
  }
</style>
