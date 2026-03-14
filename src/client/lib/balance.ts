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
import type { RoundResult } from '../../types';

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
  const existing = localStorage.getItem(PLAYER_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(PLAYER_ID_KEY, id);
  return id;
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
 * Deducts `wager` from the stored balance. Called in `messageHandler.ts`
 * on `playerJoined` (server confirmation), NOT optimistically on bet submit.
 *
 * @see docs/game-state-machine.md §3.8
 */
export function applyBet(wager: number): number {
  const current = getBalance();
  const next = Math.round((current - wager) * 100) / 100;
  localStorage.setItem(BALANCE_KEY, String(next));
  return next;
}

/**
 * Credits `payout` to the stored balance. Called from `App.svelte` when
 * `lastCrashResult` or `lastPendingPayout` stores are updated. Guarded externally by
 * `hasPendingResult()` to prevent double-application.
 *
 * @see docs/game-state-machine.md §3.8
 */
export function applyCashout(payout: number): number {
  const current = getBalance();
  const next = Math.round((current + payout) * 100) / 100;
  localStorage.setItem(BALANCE_KEY, String(next));
  return next;
}

export function addHistoryEntry(entry: RoundResult): void {
  const history = getHistory();
  history.unshift(entry);
  const trimmed = history.slice(0, CLIENT_HISTORY_LIMIT);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
}

export function getHistory(): RoundResult[] {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    // Validate the parsed value is an array before trusting it — guards against
    // schema drift between app versions that could otherwise silently corrupt accounting.
    if (!Array.isArray(parsed)) return [];
    return parsed as RoundResult[];
  } catch {
    return [];
  }
}

export function hasPendingResult(roundId: number): boolean {
  return getHistory().some((r) => r.roundId === roundId);
}
