/**
 * Runtime type guards for validating incoming messages and external data.
 *
 * TypeScript's `as` casts provide zero runtime safety. These guards ensure
 * malformed messages are caught at the boundary before reaching game logic.
 *
 * @see [High-1] [High-4] [High-2]
 */
import type { ClientMessage, DrandBeacon } from '../types';

// ─── Client message validation ──────────────────────────────────────────────

function isObject(data: unknown): data is Record<string, unknown> {
  return typeof data === 'object' && data !== null;
}

function isValidJoinFields(obj: Record<string, unknown>): boolean {
  if (typeof obj.playerId !== 'string') return false;
  if (typeof obj.wager !== 'number') return false;
  if (obj.name !== undefined && typeof obj.name !== 'string') return false;
  if (
    obj.autoCashout !== undefined &&
    obj.autoCashout !== null &&
    typeof obj.autoCashout !== 'number'
  )
    return false;
  return true;
}

/**
 * Validates that `data` conforms to the `ClientMessage` union at runtime.
 * Returns false for unknown `type` values, missing required fields, or wrong field types.
 */
export function isValidClientMessage(data: unknown): data is ClientMessage {
  if (!isObject(data)) return false;
  if (typeof data.type !== 'string') return false;

  switch (data.type) {
    case 'join':
      return isValidJoinFields(data);
    case 'cashout':
      return true;
    default:
      return false;
  }
}

// ─── Drand beacon validation ────────────────────────────────────────────────

const HEX_PATTERN = /^[0-9a-f]+$/i;

/**
 * Validates that `data` conforms to the `DrandBeacon` shape at runtime.
 * Checks field presence, types, and that hex strings are well-formed.
 */
export function isValidDrandBeacon(data: unknown): data is DrandBeacon {
  if (!isObject(data)) return false;
  if (typeof data.round !== 'number' || !Number.isFinite(data.round)) return false;
  if (typeof data.randomness !== 'string' || !HEX_PATTERN.test(data.randomness)) return false;
  if (typeof data.signature !== 'string') return false;
  return true;
}

// ─── Storage validation ─────────────────────────────────────────────────────

interface StoredGameData {
  rootSeed: string;
  gameNumber: number;
  chainCommitment: string;
  history: Array<{
    roundId: number;
    crashPoint: number;
    roundSeed: string;
    drandRound: number;
    drandRandomness: string;
    chainCommitment: string;
  }>;
  pendingPayouts: Array<
    [
      string,
      {
        roundId: number;
        wager: number;
        payout: number;
        cashoutMultiplier: number;
        crashPoint: number;
      },
    ]
  >;
}

/**
 * Validates stored game data loaded from Durable Object storage.
 * Returns false if any required field is missing, wrong type, or corrupt.
 */
export function isValidStoredGameData(data: unknown): data is StoredGameData {
  if (!isObject(data)) return false;

  // rootSeed: 64-char hex string
  if (typeof data.rootSeed !== 'string' || data.rootSeed.length !== 64) return false;
  if (!HEX_PATTERN.test(data.rootSeed)) return false;

  // gameNumber: positive integer
  if (
    typeof data.gameNumber !== 'number' ||
    !Number.isInteger(data.gameNumber) ||
    data.gameNumber < 0
  )
    return false;

  // chainCommitment: 64-char hex string
  if (typeof data.chainCommitment !== 'string' || data.chainCommitment.length !== 64) return false;
  if (!HEX_PATTERN.test(data.chainCommitment)) return false;

  // history: array of HistoryEntry objects
  if (!Array.isArray(data.history)) return false;
  for (const entry of data.history) {
    if (!isObject(entry)) return false;
    if (typeof entry.roundId !== 'number') return false;
    if (typeof entry.crashPoint !== 'number') return false;
    if (typeof entry.roundSeed !== 'string') return false;
    if (typeof entry.drandRound !== 'number') return false;
    if (typeof entry.drandRandomness !== 'string') return false;
    if (typeof entry.chainCommitment !== 'string') return false;
  }

  // pendingPayouts: array of [playerId, payout] tuples (or absent)
  if (data.pendingPayouts !== undefined) {
    if (!Array.isArray(data.pendingPayouts)) return false;
    for (const entry of data.pendingPayouts) {
      if (!Array.isArray(entry) || entry.length !== 2) return false;
      if (typeof entry[0] !== 'string') return false;
      const p = entry[1];
      if (!isObject(p)) return false;
      if (typeof p.roundId !== 'number') return false;
      if (typeof p.wager !== 'number') return false;
      if (typeof p.payout !== 'number') return false;
      if (typeof p.cashoutMultiplier !== 'number') return false;
      if (typeof p.crashPoint !== 'number') return false;
    }
  }

  return true;
}
