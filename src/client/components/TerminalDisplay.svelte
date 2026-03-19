<script lang="ts">
import type { TerminalLine, ThreatLevel } from '../../../types';
import CRTOverlay from './CRTOverlay.svelte';

let {
  lines = [],
  dim = false,
  maxHeight = '300px',
  threatLevel = 'GHOST',
}: {
  lines?: TerminalLine[];
  dim?: boolean;
  maxHeight?: string;
  threatLevel?: ThreatLevel;
} = $props();

let container: HTMLDivElement | undefined = $state();

$effect(() => {
  // Scroll to bottom whenever lines change — deferred to avoid forced reflow
  lines;
  if (container) {
    const el = container;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }
});
</script>

<CRTOverlay {threatLevel}>
  <div
    class="terminal"
    class:dim
    style:max-height={maxHeight}
    bind:this={container}
  >
    {#each lines as line (line.id)}
      <div class="line {line.type}" style:color={line.color}>
        {line.text}
      </div>
    {/each}
  </div>
</CRTOverlay>

<style>
  .terminal {
    overflow-y: auto;
    font-family: 'Fira Code', monospace;
    font-size: 12px;
    line-height: 1.5;
    padding: 0.5rem;
    background: var(--color-bg);
    scrollbar-width: none;
  }

  .terminal::-webkit-scrollbar {
    display: none;
  }

  .terminal.dim {
    filter: brightness(0.6);
  }

  .line {
    white-space: pre-wrap;
    word-break: break-all;
  }

  .line.danger {
    font-weight: 700;
  }

  .line.command {
    opacity: 0.9;
  }

  .line.progress {
    font-weight: 700;
  }
</style>
