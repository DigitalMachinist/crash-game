/**
 * Shared TypeScript types used by both server and client.
 *
 * Key type relationships:
 * - `ServerMessage` — all server → client message variants (@see websocket-protocol.md §4.3)
 * - `ClientMessage` — all client → server message variants (@see websocket-protocol.md §4.2)
 * - `GameStateSnapshot` — full state sent on connect + phase transitions
 * - `HistoryEntry` — server-broadcast public round data (distinct from client `RoundResult`)
 * - `VerificationResult` — output of `verify.ts` client-side proof check
 */
// ─── Game phases ─────────────────────────────────────────────────────────────
export type Phase = 'WAITING' | 'STARTING' | 'RUNNING' | 'CRASHED';

// ─── Server-side player (full, internal to server) ───────────────────────────
export interface Player {
  id: string; // connection ID (changes on reconnect)
  playerId: string; // client UUID (stable across reconnects)
  name: string;
  wager: number;
  autoCashout: number | null;
  cashedOut: boolean;
  cashoutMultiplier: number | null;
  payout: number | null;
}

// ─── Client-visible player snapshot (broadcast to all clients) ───────────────
export interface PlayerSnapshot {
  id: string;
  playerId: string;
  name: string;
  wager: number;
  cashedOut: boolean;
  cashoutMultiplier: number | null;
  payout: number | null;
  autoCashout: number | null;
}

// ─── Full game state snapshot (sent on connect + every phase transition) ─────
/** Full game state sent on connect and every phase transition. @see docs/game-state-machine.md §3.1 */
export interface GameStateSnapshot {
  phase: Phase;
  roundId: number;
  countdown: number; // ms remaining (WAITING only)
  multiplier: number; // current multiplier (RUNNING only)
  elapsed: number; // ms since round start (RUNNING only)
  crashPoint: number | null; // null during WAITING/STARTING/RUNNING; revealed on CRASHED
  players: PlayerSnapshot[];
  chainCommitment: string;
  drandRound: number | null; // null except when phase === 'CRASHED'
  drandRandomness: string | null; // null except when phase === 'CRASHED'
  history: HistoryEntry[];
}

// ─── Round history entry ─────────────────────────────────────────────────────
/**
 * Server-broadcast public data for a completed round (last 20 kept).
 * Distinct from `RoundResult` (client localStorage) which stores per-player
 * data (wager, cashoutMultiplier, timestamp).
 */
export interface HistoryEntry {
  roundId: number;
  crashPoint: number;
  roundSeed: string;
  drandRound: number;
  drandRandomness: string;
  chainCommitment: string;
}

// ─── Client-side bet/round result (stored in localStorage) ───────────────────
export interface RoundResult {
  roundId: number;
  wager: number;
  payout: number; // 0 if crashed without cashout
  cashoutMultiplier: number | null;
  crashPoint: number;
  timestamp: number;
}

// ─── Provably fair verification result ───────────────────────────────────────
/** Result of `verifyRound()` in `src/client/lib/verify.ts`. @see docs/provably-fair.md §2.7 */
export interface VerificationResult {
  valid: boolean;
  reason?: string;
  computedCrashPoint?: number;
  chainValid?: boolean;
  drandRound?: number;
  drandRandomness?: string;
}

// ─── Server → Client message union ──────────────────────────────────────────
// CRITICAL SECURITY: crashPoint MUST remain null in 'state' messages during WAITING/STARTING/RUNNING.
// @see docs/websocket-protocol.md §4.3
// Revealing it before CRASHED allows compromised server state to inform player cashout decisions.
// See spec Section 3: Crash Point Isolation.
export type ServerMessage =
  | ({ type: 'state' } & GameStateSnapshot)
  | { type: 'tick'; multiplier: number; elapsed: number }
  | {
      type: 'playerJoined';
      id: string;
      playerId: string;
      name: string;
      wager: number;
      autoCashout: number | null;
    }
  | { type: 'playerCashedOut'; id: string; multiplier: number; payout: number }
  | {
      type: 'pendingPayout';
      roundId: number;
      wager: number;
      payout: number;
      cashoutMultiplier: number;
      crashPoint: number;
    }
  | { type: 'error'; message: string };

// ─── Client → Server message union ──────────────────────────────────────────
// @see docs/websocket-protocol.md §4.2
export type ClientMessage =
  | { type: 'join'; playerId: string; wager: number; name?: string; autoCashout?: number | null }
  | { type: 'cashout' };
