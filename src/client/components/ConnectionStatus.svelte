<script lang="ts">
import { connectionStatus, latency } from '../lib/stores';

type StatusConfig = {
  label: string;
  color: string;
};

const STATUS_CONFIG: Record<string, StatusConfig> = {
  connected: { label: 'Connected', color: '#00c853' },
  reconnecting: { label: 'Reconnecting', color: 'gold' },
  disconnected: { label: 'Disconnected', color: 'crimson' },
  connecting: { label: 'Connecting', color: 'gold' },
};

const config = $derived(STATUS_CONFIG[$connectionStatus] ?? STATUS_CONFIG.disconnected);

function latencyColor(ms: number): string {
  if (ms < 100) return '#00c853';
  if (ms < 250) return 'gold';
  return 'crimson';
}
</script>

<div class="connection-status">
  <span class="dot" style="background-color: {config.color};"></span>
  <span class="label">{config.label}</span>
  {#if $connectionStatus === 'connected' && $latency !== null}
    <span class="separator">·</span>
    <span class="latency" style="color: {latencyColor($latency)};">{$latency}ms</span>
  {/if}
</div>

<style>
  .connection-status {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.75rem;
    color: #aaa;
  }

  .dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .label {
    white-space: nowrap;
  }

  .separator {
    color: #666;
  }

  .latency {
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
</style>
