<script lang="ts">
import { connectionStatus, latency } from '../lib/stores';

const isConnected = $derived($connectionStatus === 'connected');
const isReconnecting = $derived(
  $connectionStatus === 'reconnecting' || $connectionStatus === 'connecting',
);
</script>

<div class="connection-status">
  {#if isConnected}
    <span class="dot connected">●</span>
    <span class="latency">{$latency !== null ? `${$latency}ms` : '—'}</span>
  {:else if isReconnecting}
    <span class="dot reconnecting">○</span>
    <span class="label reconnecting">RECONNECTING</span>
  {:else}
    <span class="dot offline">●</span>
    <span class="label offline">OFFLINE</span>
  {/if}
</div>

<style>
  .connection-status {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    font-family: 'Fira Code', monospace;
  }

  .dot {
    font-size: 0.6rem;
    line-height: 1;
  }

  .dot.connected {
    color: var(--color-success);
  }

  .dot.reconnecting {
    color: var(--color-primary-dim);
  }

  .dot.offline {
    color: var(--color-critical-dim);
  }

  .latency {
    color: var(--color-success);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .label.reconnecting {
    color: var(--color-primary-dim);
    white-space: nowrap;
  }

  .label.offline {
    color: var(--color-critical-dim);
    white-space: nowrap;
  }
</style>
