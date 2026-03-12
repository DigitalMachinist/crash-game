/**
 * Svelte stores for reactive game state.
 *
 * Writable stores are updated by `messageHandler.ts`. Derived stores:
 * - `phase`       — current `Phase` derived from `gameState`
 * - `countdown`   — ms remaining in WAITING
 * - `playersList` — `Object.values($players)` array
 * - `isInRound`   — true when phase is RUNNING or STARTING AND the local
 *                   player is active (in `$players` and not cashed out)
 *
 * @see docs/project-architecture.md §1.3
 */
import { derived, get, writable } from 'svelte/store';
import type { GameStateSnapshot, HistoryEntry, Phase, PlayerSnapshot } from '../../types';

export const gameState = writable<GameStateSnapshot | null>(null);
export const players = writable<Record<string, PlayerSnapshot>>({});
export const history = writable<HistoryEntry[]>([]);
export const phase = derived(gameState, ($s) => ($s?.phase ?? 'WAITING') as Phase);
export const countdown = derived(gameState, ($s) => $s?.countdown ?? 10000);
export const displayMultiplier = writable(1.0);
export const multiplierAnimating = writable(false);
export const myPlayerId = writable<string>('');
export const balance = writable<number>(0);
export const connectionStatus = writable<
  'connecting' | 'connected' | 'reconnecting' | 'disconnected'
>('connecting');
export const playersList = derived(players, ($p) => Object.values($p));
export const isInRound = derived(
  [phase, players, myPlayerId],
  ([$phase, $players, $id]) =>
    ($phase === 'RUNNING' || $phase === 'STARTING') && $id in $players && !$players[$id]?.cashedOut,
);

export { get };
