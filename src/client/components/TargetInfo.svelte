<script lang="ts">
import type { RoundTarget } from '../../../types';

let { target }: { target: RoundTarget | null } = $props();
</script>

<div class="target-info">
  <div class="panel-label"><span class="jp">作戦概要</span> OPERATION BRIEF</div>
  <div class="grid">
    <span class="key">TARGET:</span>
    <span class="val bold">{target?.org ?? '———'}</span>
    <span class="key">ADDR:</span>
    <span class="val mid">{target?.ip ?? '———'}</span>
    <span class="key">HOST:</span>
    <span class="val mid">{target?.hostname ?? '———'}</span>
    <span class="key">ROUND:</span>
    <span class="val dim">#{target?.roundId ?? '—'}</span>
  </div>
</div>

<style>
  .target-info {
    position: relative;
    border: 1px solid var(--color-border);
    padding: 0.75rem;
    padding-top: 1rem;
    font-family: 'Fira Code', monospace;
    font-size: 12px;
    background: var(--color-bg-card);
    flex: 1;
  }

  .panel-label {
    position: absolute;
    top: -0.55em;
    left: 0.75rem;
    background: var(--color-bg-card);
    padding: 0 0.25rem;
    font-family: 'Space Mono', monospace;
    font-size: 9px;
    letter-spacing: 0.12em;
    color: var(--color-primary-dim-text);
    white-space: nowrap;
  }

  .jp {
    font-size: 0.65rem;
    letter-spacing: 0.2em;
    opacity: 0.5;
    color: var(--color-primary-dim-text);
  }

  .grid {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.25rem 0.5rem;
    align-items: baseline;
  }

  .key {
    color: var(--color-primary-dim-text);
    white-space: nowrap;
  }

  .val {
    color: var(--color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .val.bold {
    color: var(--color-primary);
    font-weight: 700;
  }

  .val.mid {
    color: var(--color-primary-mid);
  }

  .val.dim {
    color: var(--color-primary-dim-text);
  }
</style>
