<script lang="ts">
import type { ThreatLevel } from '../../../types';
import { getSubIndicators } from '../lib/threat';

let {
  threatLevel,
  multiplier,
}: {
  threatLevel: ThreatLevel;
  multiplier: number;
} = $props();

const isCritical = $derived(threatLevel === 'CRITICAL');
const isSevere = $derived(threatLevel === 'SEVERE');
const subIndicators = $derived(getSubIndicators(threatLevel));
</script>

<div class="threat-panel" class:severe={isSevere} class:critical={isCritical}>
  <div class="panel-label">脅威評価 THREAT ASSESSMENT</div>
  <div class="divider">─────────────────────</div>
  <div class="row">
    <span class="key">STATUS</span>
    <span class="val" class:pulse-status={isCritical}>{threatLevel}</span>
  </div>
  <div class="row">
    <span class="key">PROXIES</span>
    <span class="val">{subIndicators.proxies}</span>
  </div>
  <div class="row">
    <span class="key">IDS</span>
    <span class="val">{subIndicators.ids}</span>
  </div>
  <div class="row">
    <span class="key">COVER</span>
    <span class="val">{subIndicators.cover}</span>
  </div>
</div>

<style>
  .threat-panel {
    font-family: 'Fira Code', monospace;
    font-size: 10px;
    padding: 0.5rem;
    border: 1px solid var(--color-border, #332800);
    margin-top: 0.5rem;
  }

  .threat-panel.severe {
    border-color: #cc0000;
  }

  .threat-panel.critical {
    border: 2px solid #ff0000;
    box-shadow: 0 0 12px rgba(255, 0, 0, 0.3);
  }

  .panel-label {
    font-family: 'Space Mono', monospace;
    font-size: 8px;
    color: var(--threat-dim, var(--color-primary-dim));
    letter-spacing: 0.1em;
    margin-bottom: 0.25rem;
  }

  .divider {
    color: var(--threat-dim, var(--color-primary-dim));
    margin-bottom: 0.35rem;
    font-size: 9px;
    overflow: hidden;
  }

  .row {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.2rem;
  }

  .key {
    color: var(--threat-dim, var(--color-primary-dim));
  }

  .val {
    color: var(--threat-color, var(--color-primary));
    font-weight: 700;
    text-align: right;
  }

  .pulse-status {
    animation: pulse 0.8s infinite;
  }
</style>
