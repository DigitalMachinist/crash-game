<script lang="ts">
import { onMount } from 'svelte';
import type { AgencyEntry } from '../lib/crash-agency';
import { pickAgency, pickLockoutSubtitle } from '../lib/crash-agency';

let {
  crashPoint,
  isSpectator = false,
  isEscaped = false,
}: {
  crashPoint: number;
  isSpectator?: boolean;
  isEscaped?: boolean;
} = $props();

let agency = $state<AgencyEntry>({ name: '', subtitle: '', caseRef: '' });
let lockoutSubtitle = $state('');

onMount(() => {
  agency = pickAgency();
  lockoutSubtitle = pickLockoutSubtitle();
});
</script>

<div class="crash-screen" class:escaped={isEscaped}>
  <div class="vhs-band"></div>
  <div class="hazard-stripe top"></div>
  <div class="main-content">
    <div class="jp-accent">
      {isEscaped ? '接続不能 — システム停止' : '警告 — 追跡完了'}
    </div>
    <div class="traced">
      {isEscaped ? 'SYSTEM LOCKOUT' : 'TRACED'}
    </div>
    <div class="subtitle">
      {isEscaped ? lockoutSubtitle : agency.subtitle}
    </div>
    <div class="crash-multiplier">{crashPoint.toFixed(2)}x</div>
    <div class="agency-divider"></div>
    <div class="agency-name">{agency.name}</div>
    {#if agency.caseRef}
      <div class="case-ref">{agency.caseRef}</div>
    {/if}
    {#if !isSpectator && !isEscaped}
      <div class="funds-seized">ALL FUNDS SEIZED</div>
    {/if}
  </div>
  <div class="hazard-stripe bottom"></div>
</div>

<style>
  .crash-screen {
    position: relative;
    display: flex;
    flex-direction: column;
    background: #0a0000;
    min-height: 400px;
    max-height: 500px;
    overflow: hidden;
    font-family: 'Fira Code', monospace;
  }

  /* VHS band sweep */
  .vhs-band {
    position: absolute;
    left: 0;
    right: 0;
    height: 3px;
    background: rgba(255, 255, 255, 0.04);
    z-index: 20;
    animation: vhs 3s linear infinite;
    pointer-events: none;
  }

  .hazard-stripe {
    height: 14px;
    background: repeating-linear-gradient(
      -45deg,
      #ffb000,
      #ffb000 8px,
      #000 8px,
      #000 16px
    );
    flex-shrink: 0;
  }

  @keyframes crash-pulse {
    0%, 100% { background: #0a0000 }
    50%      { background: #1e0000 }
  }

  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    gap: 0.5rem;
    animation: crash-pulse 1s ease-in-out infinite;
  }

  .crash-screen.escaped {
    min-height: 200px;
    max-height: 340px;
  }

  .crash-screen.escaped .traced {
    font-size: 2rem;
    letter-spacing: 0.2em;
  }

  .jp-accent {
    font-family: system-ui, sans-serif;
    font-size: 0.65rem;
    color: #cc0000;
    letter-spacing: 0.2em;
    opacity: 0.5;
  }

  .traced {
    font-size: 2.8rem;
    font-weight: 700;
    color: #cc0000;
    text-shadow: 0 0 25px rgba(204, 0, 0, 0.5);
    letter-spacing: 0.3em;
  }

  .subtitle {
    font-size: 0.8rem;
    color: #ff6a00;
    letter-spacing: 0.1em;
    text-align: center;
  }

  .crash-multiplier {
    font-size: 2rem;
    font-weight: 700;
    color: #ff0040;
    text-shadow: 0 0 10px rgba(255, 0, 64, 0.4);
    margin-top: 1.5rem;
  }

  .agency-divider {
    width: 60%;
    border-top: 1px solid #400000;
    margin: 0.5rem 0;
  }

  .agency-name {
    color: #ff6a00;
    font-weight: 700;
    font-size: 10px;
    letter-spacing: 0.08em;
  }

  .case-ref {
    color: #cc3300;
    font-size: 9px;
  }

  .funds-seized {
    color: #ff0040;
    font-weight: 700;
    margin-top: 0.3rem;
    letter-spacing: 0.05em;
    font-family: 'Space Mono', monospace;
    font-size: 11px;
  }
</style>
