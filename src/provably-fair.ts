/**
 * Shared provably-fair math used by both the server (`crash-game.ts`)
 * and the client verifier (`verify.ts`). Pure functions with no I/O (except
 * `computeEffectiveSeed` which performs a WebCrypto HMAC call).
 *
 * Extracting these here ensures a formula or algorithm change propagates to
 * both execution paths automatically.
 *
 * @see docs/provably-fair.md §2.5
 * @see docs/provably-fair.md §2.6
 */
import { HOUSE_EDGE } from './config';
import { hmacSha256Hex } from './crypto-hex';

/**
 * Converts the first 13 hex characters of a hash to a float in [0, 1).
 * 13 hex chars = 52 bits, matching the JS float64 mantissa precision.
 *
 * @see docs/provably-fair.md §2.6
 */
export function hashToFloat(hex: string): number {
  return parseInt(hex.slice(0, 13), 16) / 2 ** 52;
}

/** Numerator for crash point formula: `(1 - HOUSE_EDGE) * 100`. */
const CRASH_NUMERATOR = Math.round((1 - HOUSE_EDGE) * 100);

/**
 * Derives the crash point from the effective seed using the house-edge formula.
 * Formula: `max(1.00, floor((1 − HOUSE_EDGE) × 100 / (1 − h)) / 100)`
 * where `h = hashToFloat(effectiveSeed)`.
 *
 * @see docs/provably-fair.md §2.6
 */
export function deriveCrashPoint(effectiveSeed: string): number {
  const h = hashToFloat(effectiveSeed);
  return Math.max(1.0, Math.floor(CRASH_NUMERATOR / (1 - h)) / 100);
}

/**
 * Computes the effective seed by mixing the chain seed with drand randomness.
 * Formula: `HMAC-SHA256(key = drandRandomness, data = chainSeed)`
 *
 * SECURITY: drand randomness MUST be the HMAC key (not data). This prevents
 * a malicious server from choosing chain seeds to exploit predictable drand
 * values. See §2.5 for the full explanation.
 *
 * @see docs/provably-fair.md §2.5
 */
export function computeEffectiveSeed(chainSeed: string, drandRandomness: string): Promise<string> {
  return hmacSha256Hex(drandRandomness, chainSeed);
}
