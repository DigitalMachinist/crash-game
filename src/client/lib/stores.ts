/**
 * Svelte stores for reactive game state.
 *
 * Writable stores are updated by `message-handler.ts`. Derived stores:
 * - `phase`       — current `Phase` derived from `gameState`
 * - `countdown`   — ms remaining in WAITING
 * - `playersList` — memoized `Object.values($players)` array; only produces a
 *                   new array reference when player keys or value references
 *                   actually change, avoiding unnecessary re-renders
 * - `isInRound`   — true when phase is RUNNING or STARTING AND the local
 *                   player is active (in `$players` and not cashed out)
 *
 * @see docs/project-architecture.md §1.3
 */
import { derived, writable } from 'svelte/store';
import type {
  GameStateSnapshot,
  HistoryEntry,
  Phase,
  PlayerSnapshot,
  ServerMessage,
} from '../../types';

export const gameState = writable<GameStateSnapshot | null>(null);
export const players = writable<Record<string, PlayerSnapshot>>({});
export const history = writable<HistoryEntry[]>([]);
export const phase = derived(gameState, ($s) => $s?.phase ?? 'WAITING');
export const countdown = derived(gameState, ($s) => $s?.countdown ?? 10000);
export const displayMultiplier = writable(1.0);
export const multiplierAnimating = writable(false);
export const myPlayerId = writable<string>('');
export const balance = writable<number>(0);
export const connectionStatus = writable<
  'connecting' | 'connected' | 'reconnecting' | 'disconnected'
>('connecting');

/**
 * Set by message-handler when a state{phase:'CRASHED'} message arrives.
 * App.svelte watches this store and applies round-result accounting.
 * Reset to null after consumption to avoid re-triggering the effect.
 */
export const lastCrashResult = writable<GameStateSnapshot | null>(null);

/**
 * Set by message-handler when a pendingPayout message arrives.
 * App.svelte watches this store and credits disconnected auto-cashout payouts.
 * Reset to null after consumption to avoid re-triggering the effect.
 */
export const lastPendingPayout = writable<Extract<ServerMessage, { type: 'pendingPayout' }> | null>(
  null,
);

/**
 * Set by message-handler when an error message arrives from the server.
 * BetForm.svelte watches this store to surface server-side validation errors.
 * Reset to null after consumption.
 */
export const lastError = writable<string | null>(null);

/**
 * Shallow-equality check for two players Records.
 *
 * Returns true when both objects have identical keys and each corresponding
 * value is the same reference (===). Used by the memoized `playersList`
 * derived store to skip array recreation when nothing has actually changed.
 */
function playersEqual(
  a: Record<string, PlayerSnapshot>,
  b: Record<string, PlayerSnapshot>,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

/**
 * Memoized derived store: produces a new array only when the players Record
 * has different keys or any player value reference has changed. Svelte's
 * built-in `safe_not_equal` always treats objects as changed (even same
 * reference), so we build the store with a writable + subscribe approach to
 * keep memoization state in a persistent closure.
 */
function createMemoizedPlayersList() {
  let prevPlayers: Record<string, PlayerSnapshot> = {};
  let prevList: PlayerSnapshot[] = [];

  return derived<typeof players, PlayerSnapshot[]>(
    players,
    ($p, set) => {
      if (!playersEqual(prevPlayers, $p)) {
        prevPlayers = $p;
        prevList = Object.values($p);
        set(prevList);
      }
    },
    [],
  );
}

export const playersList = createMemoizedPlayersList();

export const isInRound = derived(
  [phase, players, myPlayerId],
  ([$phase, $players, $id]) =>
    ($phase === 'RUNNING' || $phase === 'STARTING') && $id in $players && !$players[$id]?.cashedOut,
);
