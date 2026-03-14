/**
 * Shared crash-point math used by both the server (crash-math.ts) and the
 * client verifier (verify.ts). Pure functions with no I/O.
 *
 * Extracting these here ensures a formula change in one place propagates to
 * both execution paths automatically.
 *
 * @see docs/provably-fair.md §2.6
 */
import { HOUSE_EDGE } from './config';

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
