<script lang="ts">
import { onMount } from 'svelte';

let {
  crashPoint,
  isSpectator = false,
}: {
  crashPoint: number;
  isSpectator?: boolean;
} = $props();

type AgencyEntry = {
  name: string;
  subtitle: string;
  caseRef: string;
};

function randomDigits(n: number): string {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');
}

function randomAlpha(n: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const RIVAL_HANDLES = ['gr00t', 'xX_ph4ntom_Xx', 'null_ptr', 'SYSTEM', 'l33tH4x0r'];

function pickAgency(): AgencyEntry {
  const agencies: AgencyEntry[] = [
    {
      name: 'FBI CYBER DIVISION',
      subtitle: 'OPERATOR COMPROMISED — ALL SESSIONS TERMINATED',
      caseRef: `CASE #2026-CF-${randomDigits(5)}`,
    },
    {
      name: 'NSA TAILORED ACCESS OPS',
      subtitle: 'SIGNAL INTERCEPTED — OPERATOR LOCATED',
      caseRef: `SIGINT REF: SIGMA-${randomAlpha(4)}`,
    },
    {
      name: 'INTERPOL CYBER CRIME',
      subtitle: 'OPERATOR COMPROMISED — ALL SESSIONS TERMINATED',
      caseRef: `WARRANT: IC-2026-EU-${randomDigits(4)}`,
    },
    {
      name: 'CORPORATE SECURITY',
      subtitle: 'UNAUTHORIZED ACCESS DETECTED — SOURCE IDENTIFIED',
      caseRef: `INCIDENT: CS-${randomDigits(6)}`,
    },
    {
      name: `PWNED BY: ${RIVAL_HANDLES[Math.floor(Math.random() * RIVAL_HANDLES.length)]}`,
      subtitle: 'YOUR BACKDOOR HAD A BACKDOOR',
      caseRef: '',
    },
  ];
  return agencies[Math.floor(Math.random() * agencies.length)]!;
}

let agency = $state<AgencyEntry>({ name: '', subtitle: '', caseRef: '' });

onMount(() => {
  agency = pickAgency();
});
</script>

<div class="crash-screen">
  <div class="vhs-band"></div>

  <div class="main-panel">
    <div class="hazard-stripe top"></div>
    <div class="main-content">
      <div class="jp-accent">警告 — 追跡完了</div>
      <div class="traced">TRACED</div>
      <div class="subtitle">{agency.subtitle}</div>
      <div class="crash-multiplier">{crashPoint.toFixed(2)}x</div>
    </div>
    <div class="hazard-stripe bottom"></div>
  </div>

  <div class="side-panel">
    <div class="side-jp">状態報告</div>
    <div class="side-title">STATUS READOUT</div>
    <div class="readout-row"><span class="rk">PROXIES</span><span class="rv critical">0 / 6</span></div>
    <div class="readout-row"><span class="rk">COVER</span><span class="rv critical">BLOWN</span></div>
    <div class="readout-row"><span class="rk">IDS</span><span class="rv critical">ACTIVE HUNT</span></div>
    <div class="agency-block">
      <div class="divider">─────────────────</div>
      <div class="agency-name">{agency.name}</div>
      {#if agency.caseRef}
        <div class="case-ref">{agency.caseRef}</div>
      {/if}
      <div class="divider">─────────────────</div>
      {#if !isSpectator}
        <div class="funds-seized">ALL FUNDS SEIZED</div>
      {/if}
    </div>
  </div>
</div>

<style>
  .crash-screen {
    position: relative;
    display: flex;
    background: #0a0000;
    min-height: 400px;
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

  /* Main panel */
  .main-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
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

  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    gap: 0.5rem;
  }

  .jp-accent {
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

  /* Side panel */
  .side-panel {
    width: 220px;
    border-left: 2px solid #cc0000;
    padding: 1rem 0.75rem;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.25rem;
  }

  .side-jp {
    font-family: inherit;
    font-size: 0.9rem;
    color: #cc0000;
    margin-bottom: 0.1rem;
  }

  .side-title {
    font-family: 'Space Mono', monospace;
    font-size: 9px;
    color: #cc0000;
    letter-spacing: 0.1em;
    margin-bottom: 0.5rem;
  }

  .readout-row {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    margin-bottom: 0.15rem;
  }

  .rk {
    color: #ff6a00;
  }

  .rv.critical {
    color: #ff0000;
    font-weight: 700;
  }

  .agency-block {
    margin-top: 0.5rem;
    font-size: 10px;
  }

  .divider {
    color: #400000;
    margin: 0.3rem 0;
    font-size: 9px;
    overflow: hidden;
  }

  .agency-name {
    color: #ff6a00;
    font-weight: 700;
    margin-bottom: 0.15rem;
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
  }
</style>
