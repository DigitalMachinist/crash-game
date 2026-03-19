<script lang="ts">
import type { ThreatLevel } from '../../../types';
import { getSubIndicators } from '../lib/threat';

let {
  threatLevel,
  multiplier,
  disconnected = false,
  traced = false,
}: {
  threatLevel: ThreatLevel;
  multiplier: number;
  disconnected?: boolean;
  traced?: boolean;
} = $props();

const isCritical = $derived(!disconnected && !traced && threatLevel === 'CRITICAL');
const isSevere = $derived(!disconnected && !traced && threatLevel === 'SEVERE');
const subIndicators = $derived(
  disconnected
    ? { proxies: 'scrubbed', ids: 'dark', cover: 'restored' }
    : traced
      ? { proxies: '0/6 EXPOSED', ids: 'ACTIVE HUNT', cover: 'BLOWN' }
      : getSubIndicators(threatLevel),
);
const displayStatus = $derived(disconnected ? 'OFFLINE' : traced ? 'TRACED' : threatLevel);
</script>

<div class="threat-panel" class:severe={isSevere} class:critical={isCritical} class:disconnected={disconnected} class:traced={traced}>
  <div class="panel-label">脅威評価 THREAT ASSESSMENT</div>
  <div class="divider">─────────────────────</div>
  <div class="row">
    <span class="key">STATUS</span>
    <span class="val" class:pulse-status={isCritical}>{displayStatus}</span>
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
    font-family: 'Space Mono', system-ui, monospace;
    font-size: 8px;
    color: var(--threat-dim-text, var(--color-primary-dim-text));
    letter-spacing: 0.1em;
    margin-bottom: 0.25rem;
  }

  .divider {
    color: var(--threat-dim-text, var(--color-primary-dim-text));
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
    color: var(--threat-dim-text, var(--color-primary-dim-text));
  }

  .val {
    color: var(--threat-color, var(--color-primary));
    font-weight: 700;
    text-align: right;
  }

  .pulse-status {
    animation: pulse 0.8s infinite;
  }

  .threat-panel.disconnected {
    border-color: var(--color-success-dim);
  }

  .threat-panel.disconnected .val {
    color: var(--color-success);
    font-weight: 700;
  }

  .threat-panel.traced {
    border-color: #cc0000;
  }

  .threat-panel.traced .val {
    color: #ff0040;
    font-weight: 700;
  }
</style>
