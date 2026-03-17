<script lang="ts">
/**
 * Root application component and round-result accounting orchestrator.
 *
 * Responsibilities beyond layout:
 * - Initializes `myPlayerId` and `balance` from localStorage on mount.
 * - Watches `lastCrashResult` store (set by `message-handler.ts`) and applies
 *   cashout or records loss via `applyCashout` / `addHistoryEntry`, guarded
 *   by `isRoundRecorded()` to prevent double-application.
 * - Watches `lastPendingPayout` store and credits disconnected auto-cashout
 *   payouts, also guarded by `isRoundRecorded()`.
 * - Displays a toast notification for pending payout delivery.
 *
 * @see docs/game-state-machine.md §3.8
 */
import { onDestroy, onMount } from 'svelte';
import { get } from 'svelte/store';
import BetForm from './components/BetForm.svelte';
import CashoutButton from './components/CashoutButton.svelte';
import CashoutScreen from './components/CashoutScreen.svelte';
import ConnectionStatus from './components/ConnectionStatus.svelte';
import CrashScreen from './components/CrashScreen.svelte';
import FairnessModal from './components/FairnessModal.svelte';
import History from './components/History.svelte';
import Multiplier from './components/Multiplier.svelte';
import NameModal from './components/NameModal.svelte';
import ObserverBanner from './components/ObserverBanner.svelte';
import PlayerList from './components/PlayerList.svelte';
import TargetInfo from './components/TargetInfo.svelte';
import TerminalDisplay from './components/TerminalDisplay.svelte';
import ThreatMeter from './components/ThreatMeter.svelte';
import ThreatPanel from './components/ThreatPanel.svelte';
import {
  applyPendingPayout,
  applyRoundResult,
  getBalance,
  getOrCreatePlayerId,
  getPlayerName,
  setPlayerName as persistPlayerName,
} from './lib/balance';
import { sendSetName } from './lib/commands';
import { getPrepLines } from './lib/prep-terminal';
import { connect, disconnect } from './lib/socket';
import {
  balance,
  cashoutThreatLevel,
  connectionStatus,
  countdown,
  displayMultiplier,
  gameState,
  isInRound,
  lastCrashResult,
  lastPendingPayout,
  myPlayerId,
  myPlayerName,
  phase,
  players,
  roundTarget,
  terminalLines,
  threatLevel,
} from './lib/stores';
import type { TerminalSession } from './lib/terminal-content';
import { startTerminalSession } from './lib/terminal-content';

let pendingPayoutToast: string | null = $state(null);
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let fairnessModalOpen = $state(false);
let nameModalOpen = $state(false);
let terminalSession: TerminalSession | null = null;
let hasCashedOutThisRound = $state(false);
let lastCashoutPayout = $state(0);
let lastCashoutMultiplier = $state(1.0);
let wasInRound = $state(false);

// Derived: show cashout screen only for successful cashouts, not after crash
const showCashoutScreen = $derived(
  hasCashedOutThisRound && ($phase === 'RUNNING' || $phase === 'CRASHED'),
);

function showToast(msg: string) {
  pendingPayoutToast = msg;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    pendingPayoutToast = null;
  }, 4000);
}

$effect(() => {
  const result = $lastCrashResult;
  if (result) {
    applyRoundResult(result, get(myPlayerId));
    balance.set(getBalance());
    lastCrashResult.set(null);
  }
});

$effect(() => {
  const payout = $lastPendingPayout;
  if (payout) {
    const result = applyPendingPayout(payout);
    if (result) {
      balance.set(getBalance());
      showToast(
        `Auto-cashout: +${result.payout.toFixed(2)} (${result.cashoutMultiplier.toFixed(2)}x)`,
      );
    }
    lastPendingPayout.set(null);
  }
});

// Re-send stored name to server on every (re)connect so the DO's in-memory
// playerNames map is always populated, even after DO eviction.
$effect(() => {
  if ($connectionStatus === 'connected' && $myPlayerName) {
    sendSetName($myPlayerName);
  }
});

// Track whether the local player cashed out this round (for cashout screen routing).
// Reset on new round, set when server confirms cashedOut=true for the local player.
$effect(() => {
  if ($phase === 'WAITING') {
    hasCashedOutThisRound = false;
    wasInRound = false;
    lastCashoutPayout = 0;
    lastCashoutMultiplier = 1.0;
  }
});

$effect(() => {
  const pid = $myPlayerId;
  const playerData = $players[pid];
  if (pid && playerData) {
    wasInRound = true;
    if (playerData.cashedOut === true && playerData.cashoutMultiplier !== null) {
      hasCashedOutThisRound = true;
      lastCashoutPayout = playerData.payout ?? 0;
      lastCashoutMultiplier = playerData.cashoutMultiplier;
    }
  }
});

// Prep terminal: emit countdown-synced lines during WAITING phase.
$effect(() => {
  if ($phase === 'WAITING') {
    const sec = Math.ceil($countdown / 1000);
    terminalLines.set(getPrepLines(sec, $roundTarget));
  }
});

// Running terminal: start/stop session with phase changes.
$effect(() => {
  const currentPhase = $phase;
  const currentRoundId = $gameState?.roundId;
  if (currentPhase === 'RUNNING' && currentRoundId != null) {
    terminalSession?.stop();
    terminalSession = startTerminalSession(
      currentRoundId,
      () => get(displayMultiplier),
      (line) => {
        terminalLines.update((lines) => {
          const next = [...lines, line];
          return next.length > 200 ? next.slice(next.length - 200) : next;
        });
      },
      (id, newText) => {
        terminalLines.update((lines) =>
          lines.map((l) => (l.id === id ? { ...l, text: newText } : l)),
        );
      },
    );
    return () => {
      terminalSession?.stop();
      terminalSession = null;
    };
  } else if (currentPhase !== 'RUNNING') {
    terminalSession?.stop();
    terminalSession = null;
  }
});

onMount(() => {
  const id = getOrCreatePlayerId();
  myPlayerId.set(id);
  balance.set(getBalance());
  connect(id);

  const storedName = getPlayerName();
  if (storedName) {
    myPlayerName.set(storedName);
  } else {
    nameModalOpen = true;
  }
});

function handleNameSet(name: string | null) {
  nameModalOpen = false;
  if (name) {
    persistPlayerName(name);
    myPlayerName.set(name);
  }
}

onDestroy(() => {
  disconnect();
  if (toastTimer) clearTimeout(toastTimer);
});
</script>

<div class="app">
  <header class="header-bar">
    <div class="header-left">
      <span class="brand">[crashOS]</span>
      {#if $myPlayerName}
        <span class="sep">@</span>
        <button class="name-btn" onclick={() => (nameModalOpen = true)}>{$myPlayerName}</button>
      {:else}
        <button class="name-btn" onclick={() => (nameModalOpen = true)}>set handle</button>
      {/if}
      <span class="rnd">RND #{$gameState?.roundId ?? '—'}</span>
      {#if $roundTarget}
        <span class="tgt-label">TGT:</span>
        <span class="tgt-value">{$roundTarget.org}</span>
        <span class="tgt-label">HOST:</span>
        <span class="tgt-value">{$roundTarget.hostname}</span>
      {/if}
    </div>
    <div class="header-right">
      <button class="fairness-btn" onclick={() => (fairnessModalOpen = true)}>⊕ PROVABLY FAIR</button>
      <ConnectionStatus />
      <span class="wallet-label">WALLET:</span>
      <span class="wallet-value" aria-label="Balance: {$balance.toFixed(2)} credits">
        {$balance.toFixed(2)} CR
      </span>
    </div>
  </header>

  {#if nameModalOpen}
    <NameModal onClose={handleNameSet} initialName={$myPlayerName} />
  {/if}

  {#if fairnessModalOpen}
    <FairnessModal onClose={() => (fairnessModalOpen = false)} />
  {/if}

  {#if pendingPayoutToast}
    <div class="toast" role="status" aria-live="polite" aria-atomic="true">{pendingPayoutToast}</div>
  {/if}

  <main class="app-main" class:running={$phase === 'RUNNING' || $phase === 'CRASHED'}>
    {#if showCashoutScreen}
      <div class="full-span">
        <CashoutScreen
          payout={lastCashoutPayout}
          cashoutMultiplier={lastCashoutMultiplier}
          threatLevel={$cashoutThreatLevel ?? 'GHOST'}
        />
      </div>
    {:else if $phase === 'CRASHED'}
      <div class="full-span">
        <CrashScreen
          crashPoint={$gameState?.crashPoint ?? 0}
          isSpectator={!wasInRound}
        />
      </div>
    {:else if $phase === 'WAITING' || $phase === 'STARTING'}
      <div class="lobby-area">
        <div class="lobby-panels">
          <TargetInfo target={$roundTarget} />
          <BetForm />
        </div>
        <div class="prep-terminal">
          <TerminalDisplay lines={$terminalLines} dim={true} maxHeight="120px" threatLevel="GHOST" />
        </div>
      </div>
      <aside class="sidebar">
        <PlayerList />
        <History />
      </aside>
    {:else}
      <div class="game-area">
        <div class="multiplier-section">
          <Multiplier />
          <ThreatMeter multiplier={$displayMultiplier} threatLevel={$threatLevel} />
        </div>
        <TerminalDisplay
          lines={$terminalLines}
          maxHeight="280px"
          threatLevel={$threatLevel}
        />
        <div class="action-area">
          {#if $isInRound || hasCashedOutThisRound}
            <CashoutButton />
          {:else if $phase === 'RUNNING'}
            <ObserverBanner threatLevel={$threatLevel} />
          {/if}
        </div>
      </div>
      <aside class="sidebar">
        <PlayerList />
        <ThreatPanel threatLevel={$threatLevel} multiplier={$displayMultiplier} />
        <History />
      </aside>
    {/if}
  </main>
</div>

<style>
  /* ─── Global reset ─── */
  :global(*, *::before, *::after) {
    box-sizing: border-box;
  }

  /* ─── CSS custom properties (palette + dynamic threat vars) ─── */
  :global(:root) {
    /* Base palette (GHOST / LOW) */
    --color-primary: #ffb000;
    --color-primary-dim: #805800;
    --color-primary-mid: #cc8800;
    --color-bg: #0a0800;
    --color-bg-card: #080600;
    --color-border: #332800;
    --color-success: #00cc66;
    --color-success-dim: #006633;

    /* Threat level colors */
    --color-elevated: #ff8c00;
    --color-high: #ff6600;
    --color-severe: #ff4400;
    --color-critical: #ff0040;
    --color-critical-pure: #ff0000;
    --color-critical-dark: #cc0000;

    /* Dim variants per threat level */
    --color-elevated-dim: #803000;
    --color-severe-dim: #800020;
    --color-critical-dim: #400000;

    /* Dynamic threat-level properties — updated via JS */
    --threat-color: var(--color-primary);
    --threat-dim: var(--color-primary-dim);
    --threat-bg: var(--color-bg);
    --threat-border: var(--color-border);
    --threat-glow-alpha: 0.3;
  }

  /* ─── Global body ─── */
  :global(body) {
    margin: 0;
    background: #0a0800;
    color: #ffb000;
    font-family: 'Fira Code', monospace;
    min-height: 100vh;
  }

  /* ─── Shared keyframes (referenced by multiple components — must be :global) ─── */

  /* Flicker tier 1 — subtle (GHOST through HIGH) */
  @keyframes flk-lo {
    0%   { opacity: 1 }
    7%   { opacity: .97 }
    12%  { opacity: 1 }
    27%  { opacity: .98 }
    32%  { opacity: 1 }
    58%  { opacity: .96 }
    59%  { opacity: 1 }
    73%  { opacity: .97 }
    74%  { opacity: 1 }
    89%  { opacity: .95 }
    91%  { opacity: 1 }
  }

  /* Flicker tier 2 — erratic (SEVERE and CRITICAL) */
  @keyframes flk-hi {
    0%   { opacity: 1 }
    3%   { opacity: .94 }
    5%   { opacity: 1 }
    14%  { opacity: .96 }
    15%  { opacity: 1 }
    31%  { opacity: .93 }
    33%  { opacity: 1 }
    47%  { opacity: .95 }
    48%  { opacity: 1 }
    62%  { opacity: .91 }
    64%  { opacity: 1 }
    78%  { opacity: .94 }
    79%  { opacity: 1 }
    93%  { opacity: .92 }
    95%  { opacity: 1 }
  }

  /* VHS horizontal band sweep */
  @keyframes vhs {
    0%   { top: -5% }
    100% { top: 105% }
  }

  /* Glitch — main element jitter */
  @keyframes gjit {
    0%,100% { transform: translate(0) }
    10%     { transform: translate(-2px, 0) }
    20%     { transform: translate(1px, 0) }
    40%     { transform: translate(-1px, 0) }
    60%     { transform: translate(3px, 0) }
    80%     { transform: translate(-1px, 0) }
  }

  /* Glitch — layer 1 (::before) clip-path tearing */
  @keyframes g1 {
    0%   { clip-path: inset(0 0 95% 0); transform: translate(0) }
    5%   { clip-path: inset(15% 0 70% 0); transform: translate(-8px, 0) }
    7%   { clip-path: inset(0 0 95% 0); transform: translate(0) }
    15%  { clip-path: inset(60% 0 25% 0); transform: translate(12px, 0) }
    17%  { clip-path: inset(0 0 95% 0); transform: translate(0) }
    28%  { clip-path: inset(40% 0 45% 0); transform: translate(-15px, 0) }
    30%  { clip-path: inset(0 0 95% 0); transform: translate(0) }
    42%  { clip-path: inset(80% 0 8% 0); transform: translate(6px, 0) }
    43%  { clip-path: inset(0 0 95% 0); transform: translate(0) }
    55%  { clip-path: inset(5% 0 85% 0); transform: translate(-20px, 0) }
    56%  { clip-path: inset(0 0 95% 0); transform: translate(0) }
    68%  { clip-path: inset(50% 0 35% 0); transform: translate(10px, 0) }
    70%  { clip-path: inset(0 0 95% 0); transform: translate(0) }
    82%  { clip-path: inset(25% 0 60% 0); transform: translate(-7px, 0) }
    84%  { clip-path: inset(0 0 95% 0); transform: translate(0) }
    93%  { clip-path: inset(70% 0 15% 0); transform: translate(18px, 0) }
    95%  { clip-path: inset(0 0 95% 0); transform: translate(0) }
    100% { clip-path: inset(0 0 95% 0); transform: translate(0) }
  }

  /* Glitch — layer 2 (::after) clip-path tearing */
  @keyframes g2 {
    0%   { clip-path: inset(95% 0 0 0); transform: translate(0) }
    8%   { clip-path: inset(70% 0 15% 0); transform: translate(14px, 0) }
    10%  { clip-path: inset(95% 0 0 0); transform: translate(0) }
    22%  { clip-path: inset(10% 0 78% 0); transform: translate(-11px, 0) }
    24%  { clip-path: inset(95% 0 0 0); transform: translate(0) }
    35%  { clip-path: inset(45% 0 40% 0); transform: translate(22px, 0) }
    37%  { clip-path: inset(95% 0 0 0); transform: translate(0) }
    50%  { clip-path: inset(85% 0 3% 0); transform: translate(-9px, 0) }
    52%  { clip-path: inset(95% 0 0 0); transform: translate(0) }
    65%  { clip-path: inset(20% 0 65% 0); transform: translate(16px, 0) }
    67%  { clip-path: inset(95% 0 0 0); transform: translate(0) }
    78%  { clip-path: inset(55% 0 30% 0); transform: translate(-18px, 0) }
    80%  { clip-path: inset(95% 0 0 0); transform: translate(0) }
    90%  { clip-path: inset(35% 0 50% 0); transform: translate(8px, 0) }
    92%  { clip-path: inset(95% 0 0 0); transform: translate(0) }
    100% { clip-path: inset(95% 0 0 0); transform: translate(0) }
  }

  /* CRITICAL background pulse */
  @keyframes bg-crisis {
    0%,100% { background: #1a0000 }
    50%     { background: #250000 }
  }

  /* Button pulse — CRITICAL disconnect (0.8s) */
  @keyframes pulse {
    0%,100% { opacity: 1 }
    50%     { opacity: .5 }
  }

  /* Terminal danger line pulse — tier 6 (0.4s) */
  @keyframes pulse-fast {
    0%,100% { opacity: 1 }
    50%     { opacity: .4 }
  }

  /* ─── App layout ─── */
  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
  }

  /* ─── Header bar ─── */
  .header-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.4rem 0.75rem;
    border-bottom: 1px solid var(--threat-border, var(--color-border));
    font-family: 'Fira Code', monospace;
    font-size: 11px;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .brand {
    color: var(--threat-color, var(--color-primary));
    font-weight: 700;
  }

  .sep {
    color: var(--threat-dim, var(--color-primary-dim));
  }

  .rnd {
    color: var(--threat-dim, var(--color-primary-dim));
  }

  .tgt-label {
    color: var(--threat-dim, var(--color-primary-dim));
  }

  .tgt-value {
    color: var(--color-primary-mid);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .wallet-label {
    color: var(--color-success-dim);
  }

  .wallet-value {
    color: var(--color-success);
    font-weight: 700;
  }

  .name-btn {
    background: transparent;
    border: none;
    color: var(--threat-dim, var(--color-primary-dim));
    padding: 0;
    font-size: 11px;
    cursor: pointer;
    font-family: 'Fira Code', monospace;
  }

  .name-btn:hover {
    color: var(--threat-color, var(--color-primary));
  }

  .fairness-btn {
    background: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-primary-dim);
    padding: 0.2rem 0.5rem;
    font-size: 10px;
    cursor: pointer;
    font-family: 'Fira Code', monospace;
    letter-spacing: 0.05em;
  }

  .fairness-btn:hover {
    border-color: var(--color-primary-mid);
    color: var(--color-primary);
  }

  .toast {
    position: fixed;
    top: 1rem;
    right: 1rem;
    background: var(--color-bg-card);
    border: 1px solid var(--color-success-dim);
    color: var(--color-success);
    padding: 0.75rem 1.25rem;
    border-radius: 4px;
    font-size: 0.95rem;
    font-family: 'Fira Code', monospace;
    z-index: 200;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
  }

  /* ─── Main layout ─── */
  .app-main {
    display: grid;
    grid-template-columns: 1fr 180px;
    gap: 1.5rem;
    padding: 1.5rem 0;
    flex: 1;
  }

  .app-main.running {
    grid-template-columns: 1fr 200px;
  }

  /* ─── Lobby layout ─── */
  .lobby-area {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .lobby-panels {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    align-items: start;
  }

  /* ─── Prep terminal ─── */
  .prep-terminal {
    border: 1px solid var(--color-border);
    background: var(--color-bg-card);
  }

  /* ─── Game area ─── */
  .game-area {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* Phase screens span both grid columns */
  .full-span {
    grid-column: 1 / -1;
  }

  /* ─── Sidebar ─── */
  .sidebar {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border-left: 1px solid var(--threat-border, var(--color-border));
    padding-left: 0.75rem;
  }

  /* ─── Running phase sub-sections ─── */
  .multiplier-section {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .action-area {
    display: flex;
    justify-content: center;
  }

  @media (max-width: 700px) {
    .app-main {
      grid-template-columns: 1fr;
    }
    .sidebar {
      border-left: none;
      padding-left: 0;
      border-top: 1px solid var(--threat-border, var(--color-border));
      padding-top: 1rem;
    }
    .lobby-panels {
      grid-template-columns: 1fr;
    }
  }
</style>
