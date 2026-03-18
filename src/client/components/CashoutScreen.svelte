<script lang="ts">
import { onMount } from 'svelte';
import type { ThreatLevel } from '../../../types';

let {
  payout,
  cashoutMultiplier,
  threatLevel,
}: {
  payout: number;
  cashoutMultiplier: number;
  threatLevel: ThreatLevel;
} = $props();

const LOW_SUBTITLES = [
  'TRACES CLEARED — YOU WERE NEVER HERE',
  'SESSION SCRUBBED — NO EVIDENCE REMAINS',
  'CLEAN EXIT — LIKE A GHOST',
  'LOGS PURGED — IDENTITY INTACT',
  'ALL TUNNELS CLOSED — PROXY CHAIN BURNED',
  'ZERO FOOTPRINT — TEXTBOOK EXTRACTION',
];

const SEVERE_SUBTITLES = [
  "TRACES BURNED — THEY'LL NEVER FIND YOU",
  'VANISHED — LIKE YOU WERE NEVER THERE',
  'SLIPPED THROUGH THEIR FINGERS',
  'EXTRACTED UNDER FIRE — CLEAN GETAWAY',
  'OUT THE BACK DOOR — CLOSE ONE',
  "GONE DARK — THEY'RE CHASING SHADOWS",
];

const CRITICAL_SUBTITLES = [
  'GHOST PROTOCOL — ALL TRACES DESTROYED',
  "IMPOSSIBLE EXTRACTION — THEY DIDN'T STAND A CHANCE",
  'ABSOLUTE LEGEND — WALKED THROUGH FIRE',
  'THEY SENT EVERYTHING — YOU SENT NOTHING BACK',
];

function getTier(level: ThreatLevel): 1 | 2 | 3 {
  if (level === 'CRITICAL') return 3;
  if (level === 'SEVERE') return 2;
  return 1;
}

function pickFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

const tier = $derived(getTier(threatLevel));

let subtitle = $state('');

onMount(() => {
  if (tier === 3) {
    subtitle = pickFrom(CRITICAL_SUBTITLES);
  } else if (tier === 2) {
    subtitle = pickFrom(SEVERE_SUBTITLES);
  } else {
    subtitle = pickFrom(LOW_SUBTITLES);
  }
});

const jpAccent = $derived(tier === 1 ? '切断完了' : tier === 2 ? '緊急切断' : '神業');
const heading = $derived(tier === 1 ? 'CONNECTION TERMINATED' : 'EMERGENCY DISCONNECT');
const footer = $derived(
  tier === 3
    ? `DISCONNECTED @ ${cashoutMultiplier.toFixed(2)}x — LEGENDARY`
    : tier === 2
      ? `DISCONNECTED @ ${cashoutMultiplier.toFixed(2)}x — CLOSE CALL`
      : `DISCONNECTED @ ${cashoutMultiplier.toFixed(2)}x`,
);
</script>

<div class="cashout-screen" class:tier2={tier === 2} class:tier3={tier === 3}>
  <div class="content">
    <div class="jp-accent">{jpAccent}</div>
    <div class="heading">{heading}</div>
    <div class="subtitle">{subtitle}</div>
    <div class="divider">──────────</div>
    <div class="payout" class:large={tier === 3}>
      +{payout.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CR
    </div>
    <div class="footer">{footer}</div>
  </div>
</div>

<style>
  .cashout-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 280px;
    background: #000a00;
    border: 1px solid #006633;
    font-family: 'Fira Code', monospace;
  }

  .cashout-screen.tier2 {
    border: 2px solid #00cc66;
  }

  .cashout-screen.tier3 {
    border: 2px solid #00cc66;
    box-shadow: 0 0 30px rgba(0, 204, 102, 0.25);
  }

  .content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    padding: 2rem;
    text-align: center;
  }

  .jp-accent {
    font-size: 0.65rem;
    color: #006633;
    letter-spacing: 0.2em;
    opacity: 0.8;
  }

  .heading {
    font-size: 1.6rem;
    font-weight: 700;
    color: #00cc66;
    letter-spacing: 0.15em;
    text-shadow: 0 0 15px rgba(0, 204, 102, 0.4);
  }

  .subtitle {
    font-size: 0.8rem;
    color: #006633;
    letter-spacing: 0.08em;
  }

  .divider {
    color: #003a1a;
    font-size: 1rem;
    margin: 0.4rem 0;
  }

  .payout {
    font-size: 2.2rem;
    font-weight: 700;
    color: #00cc66;
    text-shadow: 0 0 20px rgba(0, 204, 102, 0.5);
  }

  .payout.large {
    font-size: 3.5rem;
    text-shadow: 0 0 30px rgba(0, 204, 102, 0.7);
  }

  .footer {
    font-size: 0.75rem;
    color: #006633;
    letter-spacing: 0.08em;
    margin-top: 0.25rem;
  }
</style>
