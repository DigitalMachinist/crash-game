/**
 * Client-side balance and history management using localStorage.
 *
 * Balance is localStorage-only — there is no server-side balance authority.
 * The three localStorage keys are: `crashBalance`, `crashHistory`, `crashPlayerId`.
 *
 * Note: `RoundResult` (stored here) is distinct from the server-broadcast
 * `HistoryEntry` type — see `src/types.ts`. `RoundResult` includes per-player
 * data (wager, cashoutMultiplier, timestamp); `HistoryEntry` is public round data.
 *
 * @see docs/game-state-machine.md §3.8
 */

import { CLIENT_HISTORY_LIMIT } from '../../config';
import type { GameStateSnapshot, RoundResult, ServerMessage } from '../../types';

const BALANCE_KEY = 'crashBalance';
const HISTORY_KEY = 'crashHistory';
const PLAYER_ID_KEY = 'crashPlayerId';

/**
 * Returns the stable player UUID from localStorage, creating one via
 * `crypto.randomUUID()` on first call. Persisted under `crashPlayerId`.
 *
 * @see docs/game-state-machine.md §3.8
 */
export function getOrCreatePlayerId(): string {
  try {
    const existing = localStorage.getItem(PLAYER_ID_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(PLAYER_ID_KEY, id);
    return id;
  } catch {
    // localStorage unavailable (private browsing, quota exceeded) — use a session-only ID
    return crypto.randomUUID();
  }
}

export function getBalance(): number {
  try {
    const stored = localStorage.getItem(BALANCE_KEY);
    if (stored === null) return 0;
    const parsed = parseFloat(stored);
    return isNaN(parsed) ? 0 : parsed;
  } catch {
    return 0;
  }
}

/**
 * Deducts `wager` from the stored balance. Called in `message-handler.ts`
 * on `playerJoined` (server confirmation), NOT optimistically on bet submit.
 *
 * @see docs/game-state-machine.md §3.8
 */
export function applyBet(wager: number): number {
  const current = getBalance();
  const next = Math.round((current - wager) * 100) / 100;
  try {
    localStorage.setItem(BALANCE_KEY, String(next));
  } catch {
    // localStorage unavailable — balance update is session-only
  }
  return next;
}

/**
 * Credits `payout` to the stored balance. Called from `App.svelte` when
 * `lastCrashResult` or `lastPendingPayout` stores are updated. Guarded externally by
 * `isRoundRecorded()` to prevent double-application.
 *
 * @see docs/game-state-machine.md §3.8
 */
export function applyCashout(payout: number): number {
  const current = getBalance();
  const next = Math.round((current + payout) * 100) / 100;
  try {
    localStorage.setItem(BALANCE_KEY, String(next));
  } catch {
    // localStorage unavailable — balance update is session-only
  }
  return next;
}

export function addHistoryEntry(entry: RoundResult): void {
  const history = getHistory();
  history.unshift(entry);
  const trimmed = history.slice(0, CLIENT_HISTORY_LIMIT);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage unavailable — history entry is session-only
  }
}

export function getHistory(): RoundResult[] {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    // Validate the parsed value is an array of objects with required RoundResult fields.
    // Guards against schema drift between app versions that could silently corrupt accounting.
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is RoundResult => {
      if (typeof item !== 'object' || item === null) return false;
      const r = item as Record<string, unknown>;
      return (
        typeof r.roundId === 'number' &&
        typeof r.wager === 'number' &&
        typeof r.payout === 'number' &&
        typeof r.crashPoint === 'number' &&
        typeof r.timestamp === 'number' &&
        (typeof r.cashoutMultiplier === 'number' || r.cashoutMultiplier === null)
      );
    });
  } catch {
    return [];
  }
}

export function isRoundRecorded(roundId: number): boolean {
  return getHistory().some((r) => r.roundId === roundId);
}

/**
 * Applies accounting for a pending payout (auto-cashout delivered after reconnect).
 * Guards against double-application via `isRoundRecorded()`.
 *
 * Returns `{ payout, cashoutMultiplier }` when the payout was applied so the
 * caller (App.svelte) can display a toast notification, or `null` if the round
 * was already recorded and no action was taken.
 *
 * Does NOT update the Svelte `balance` store — the caller is responsible for
 * calling `balance.set(getBalance())` after this function returns a non-null result.
 *
 * @see docs/game-state-machine.md §3.8
 */
export function applyPendingPayout(
  detail: Extract<ServerMessage, { type: 'pendingPayout' }>,
): { payout: number; cashoutMultiplier: number } | null {
  if (isRoundRecorded(detail.roundId)) return null;
  applyCashout(detail.payout);
  addHistoryEntry({
    roundId: detail.roundId,
    wager: detail.wager,
    payout: detail.payout,
    cashoutMultiplier: detail.cashoutMultiplier,
    crashPoint: detail.crashPoint,
    timestamp: Date.now(),
  });
  return { payout: detail.payout, cashoutMultiplier: detail.cashoutMultiplier };
}

/**
 * Applies accounting for a completed round result for the identified player.
 * Guards against double-application via `isRoundRecorded()`.
 *
 * `playerId` is passed as a parameter so this function does not need to import
 * Svelte stores — the caller (App.svelte) reads `myPlayerId` from the store and
 * passes it here.
 *
 * Does NOT update the Svelte `balance` store — the caller is responsible for
 * calling `balance.set(getBalance())` after this function returns.
 *
 * @see docs/game-state-machine.md §3.8
 */
export function applyRoundResult(snapshot: GameStateSnapshot, playerId: string): void {
  if (snapshot.crashPoint === null) return;
  if (!playerId) return;
  const myPlayer = snapshot.players.find((p) => p.playerId === playerId);
  if (!myPlayer) return;
  if (isRoundRecorded(snapshot.roundId)) return;
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
