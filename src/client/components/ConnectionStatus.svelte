<script lang="ts">
import { connectionStatus } from '../lib/stores';

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
</script>

<div class="connection-status">
  <span class="dot" style="background-color: {config.color};"></span>
  <span class="label">{config.label}</span>
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
</style>
