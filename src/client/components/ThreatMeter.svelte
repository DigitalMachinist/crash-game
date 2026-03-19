<script lang="ts">
import type { ThreatLevel } from '../../../types';
import { getSubIndicators, getThreatFillCount } from '../lib/threat';

let {
  multiplier,
  threatLevel,
}: {
  multiplier: number;
  threatLevel: ThreatLevel;
} = $props();

const isCritical = $derived(threatLevel === 'CRITICAL');
const fillCount = $derived(getThreatFillCount(multiplier));
const bar = $derived('▓'.repeat(fillCount) + '░'.repeat(20 - fillCount));
const subIndicators = $derived(getSubIndicators(threatLevel));
const levelLabel = $derived(isCritical ? '!! CRITICAL' : threatLevel);
</script>

<div class="threat-meter">
  <div class="bar-row">
    <span class="label">THREAT:</span>
    <span class="bar" class:critical={isCritical}>{bar}</span>
    <span class="level" class:critical={isCritical}>{levelLabel}</span>
  </div>
  <div class="sub-row">
    <span class="sub">PROXIES: {subIndicators.proxies}</span>
    <span class="sub">IDS: {subIndicators.ids}</span>
    <span class="sub">COVER: {subIndicators.cover}</span>
  </div>
</div>

<style>
  .threat-meter {
    font-family: 'Fira Code', monospace;
    padding: 0.25rem 0;
  }

  .bar-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 11px;
  }

  .label {
    color: var(--threat-dim-text, var(--color-primary-dim-text));
    white-space: nowrap;
  }

  .bar {
    color: var(--threat-color, var(--color-primary));
    letter-spacing: 0.05em;
  }

  .bar.critical {
    animation: pulse-fast 0.4s infinite;
  }

  .level {
    color: var(--threat-color, var(--color-primary));
    font-weight: 700;
    white-space: nowrap;
  }

  .level.critical {
    animation: pulse 0.8s infinite;
  }

  .sub-row {
    display: flex;
    gap: 1rem;
    margin-top: 0.15rem;
    flex-wrap: wrap;
  }

  .sub {
    font-size: 10px;
    color: var(--threat-dim-text, var(--color-primary-dim-text));
  }
</style>
