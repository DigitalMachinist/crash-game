<script lang="ts">
/**
 * Root application component and round-result accounting orchestrator.
 *
 * Responsibilities beyond layout:
 * - Initializes `myPlayerId` and `balance` from localStorage on mount.
 * - Watches `lastCrashResult` store (set by `message-handler.ts`) and applies
 *   cashout or records loss via `applyCashout` / `addHistoryEntry`, guarded
 *   by `hasPendingResult()` to prevent double-application.
 * - Watches `lastPendingPayout` store and credits disconnected auto-cashout
 *   payouts, also guarded by `hasPendingResult()`.
 * - Displays a toast notification for pending payout delivery.
 *
 * @see docs/game-state-machine.md §3.8
 */
import { onDestroy, onMount } from 'svelte';
import { get } from 'svelte/store';
import type { GameStateSnapshot, ServerMessage } from '../types';
import BetForm from './components/BetForm.svelte';
import CashoutButton from './components/CashoutButton.svelte';
import ConnectionStatus from './components/ConnectionStatus.svelte';
import FairnessModal from './components/FairnessModal.svelte';
import GameStatus from './components/GameStatus.svelte';
import History from './components/History.svelte';
import Multiplier from './components/Multiplier.svelte';
import PlayerList from './components/PlayerList.svelte';
import {
  addHistoryEntry,
  applyCashout,
  getBalance,
  getOrCreatePlayerId,
  hasPendingResult,
} from './lib/balance';
import { connect, disconnect } from './lib/socket';
import { balance, lastCrashResult, lastPendingPayout, myPlayerId } from './lib/stores';

let pendingPayoutToast: string | null = $state(null);
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let fairnessModalOpen = $state(false);

function showToast(msg: string) {
  pendingPayoutToast = msg;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    pendingPayoutToast = null;
  }, 4000);
}

function applyPendingPayout(detail: Extract<ServerMessage, { type: 'pendingPayout' }>) {
  // Guard against double-applying
  if (hasPendingResult(detail.roundId)) return;
  applyCashout(detail.payout);
  addHistoryEntry({
    roundId: detail.roundId,
    wager: detail.wager,
    payout: detail.payout,
    cashoutMultiplier: detail.cashoutMultiplier,
    crashPoint: detail.crashPoint,
    timestamp: Date.now(),
  });
  balance.set(getBalance());
  showToast(`Auto-cashout: +${detail.payout.toFixed(2)} (${detail.cashoutMultiplier.toFixed(2)}x)`);
}

function applyRoundResult(snapshot: GameStateSnapshot) {
  if (snapshot.crashPoint === null) return;
  const id = get(myPlayerId);
  if (!id) return;
  const myPlayer = snapshot.players.find((p) => p.playerId === id);
  if (!myPlayer) return;
  if (hasPendingResult(snapshot.roundId)) return;
  if (myPlayer.cashedOut && myPlayer.payout !== null) {
    applyCashout(myPlayer.payout);
    addHistoryEntry({
      roundId: snapshot.roundId,
      wager: myPlayer.wager,
      payout: myPlayer.payout,
      cashoutMultiplier: myPlayer.cashoutMultiplier,
      crashPoint: snapshot.crashPoint,
      timestamp: Date.now(),
    });
    balance.set(getBalance());
  } else {
    // cashedOut=false: wager already deducted at join — just record the loss
    addHistoryEntry({
      roundId: snapshot.roundId,
      wager: myPlayer.wager,
      payout: 0,
      cashoutMultiplier: null,
      crashPoint: snapshot.crashPoint,
      timestamp: Date.now(),
    });
  }
}

$effect(() => {
  const result = $lastCrashResult;
  if (result) {
    applyRoundResult(result);
    lastCrashResult.set(null);
  }
});

$effect(() => {
  const payout = $lastPendingPayout;
  if (payout) {
    applyPendingPayout(payout);
    lastPendingPayout.set(null);
  }
});

onMount(() => {
  const id = getOrCreatePlayerId();
  myPlayerId.set(id);
  balance.set(getBalance());
  connect(id);
});

onDestroy(() => {
  disconnect();
  if (toastTimer) clearTimeout(toastTimer);
});
</script>

<div class="app">
  <header>
    <h1>Crash</h1>
    <div class="header-right">
      <button class="fairness-btn" onclick={() => (fairnessModalOpen = true)}>Fairness</button>
      <ConnectionStatus />
      <div
        class="balance-display"
        aria-label="Balance: {$balance >= 0 ? '+' : ''}{$balance.toFixed(2)}"
      >
        Balance: <span class:positive={$balance >= 0} class:negative={$balance < 0}>
          {$balance >= 0 ? '+' : ''}{$balance.toFixed(2)}
        </span>
      </div>
    </div>
  </header>

  {#if fairnessModalOpen}
    <FairnessModal onClose={() => (fairnessModalOpen = false)} />
  {/if}

  {#if pendingPayoutToast}
    <div class="toast" role="status" aria-live="polite" aria-atomic="true">{pendingPayoutToast}</div>
  {/if}

  <main>
    <section class="game-section">
      <GameStatus />
      <Multiplier />
      <BetForm />
      <CashoutButton />
    </section>

    <aside class="sidebar">
      <PlayerList />
      <History />
    </aside>
  </main>
</div>

<style>
  :global(*, *::before, *::after) {
    box-sizing: border-box;
  }

  :global(body) {
    margin: 0;
    background: #0d0d1a;
    color: #e0e0e0;
    font-family: system-ui, -apple-system, sans-serif;
    min-height: 100vh;
  }

  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 1rem;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 0;
    border-bottom: 1px solid #222;
  }

  h1 {
    margin: 0;
    font-size: 1.5rem;
    color: #fff;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .balance-display {
    font-size: 1rem;
    color: #888;
  }

  .fairness-btn {
    background: transparent;
    border: 1px solid #444;
    color: #aaa;
    padding: 0.3rem 0.75rem;
    border-radius: 4px;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .fairness-btn:hover {
    background: #1a1a2e;
    color: #e0e0e0;
    border-color: #666;
  }

  .positive { color: #00c853; }
  .negative { color: #d32f2f; }

  .toast {
    position: fixed;
    top: 1rem;
    right: 1rem;
    background: #1565c0;
    color: #fff;
    padding: 0.75rem 1.25rem;
    border-radius: 6px;
    font-size: 0.95rem;
    z-index: 200;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
  }

  main {
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: 1.5rem;
    padding: 1.5rem 0;
    flex: 1;
  }

  .game-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .sidebar {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    border-left: 1px solid #222;
    padding-left: 1.5rem;
  }

  @media (max-width: 700px) {
    main {
      grid-template-columns: 1fr;
    }
    .sidebar {
      border-left: none;
      padding-left: 0;
      border-top: 1px solid #222;
      padding-top: 1rem;
    }
  }
</style>
