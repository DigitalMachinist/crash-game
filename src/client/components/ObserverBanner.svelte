<script lang="ts">
import type { ThreatLevel } from '../../../types';

let {
  threatLevel,
  expanded = false,
}: {
  threatLevel: ThreatLevel;
  expanded?: boolean;
} = $props();
</script>

<div class="observer-banner" class:expanded>
  <div class="primary-text">監視中&nbsp;&nbsp;OBSERVING — NOT IN THIS OP</div>
  {#if expanded}
    <div class="secondary-text">You did not join this operation</div>
  {/if}
</div>

<style>
  .observer-banner {
    font-family: 'Fira Code', monospace;
    font-size: 11px;
    color: var(--threat-dim-text, var(--color-primary-dim-text));
    text-align: center;
  }

  .observer-banner.expanded {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 2rem;
  }

  .secondary-text {
    font-size: 10px;
    opacity: 0.7;
  }
</style>
