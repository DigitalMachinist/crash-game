/**
 * Crash point derivation and multiplier curve math.
 *
 * Implements the exponential multiplier curve `e^(GROWTH_RATE × t)` and the
 * house-edge-adjusted crash point formula derived from the effective seed.
 *
 * @see docs/provably-fair.md §2.6
 * @see docs/game-state-machine.md §3.6
 */
import { GROWTH_RATE, HOUSE_EDGE } from '../config';

/**
 * Converts the first 13 hex characters of a hash to a float in [0, 1).
 * 13 hex chars = 52 bits, matching the JS float64 mantissa precision.
 *
 * @see docs/provably-fair.md §2.6
 */
export function hashToFloat(hex: string): number {
  // Take first 13 hex chars (52 bits) — matches JS float64 precision
  return parseInt(hex.slice(0, 13), 16) / 2 ** 52;
}

/**
 * Derives the crash point from the effective seed using the house-edge formula.
 * Formula: `max(1.00, floor((1 − HOUSE_EDGE) × 100 / (1 − h)) / 100)`
 * where `h = hashToFloat(effectiveSeed)`.
 *
 * Parameterized via `HOUSE_EDGE` in `src/config.ts`.
 * Note: the client verification in `src/client/lib/verify.ts` hardcodes the
 * equivalent literal `99` and must be updated in sync if `HOUSE_EDGE` changes.
 *
 * @see docs/provably-fair.md §2.6
 * @see docs/project-architecture.md §1.5 (house-edge sync dependency)
 */
export function deriveCrashPoint(effectiveSeed: string): number {
  const h = hashToFloat(effectiveSeed);
  // 1% house edge: floor(99 / (1 - h)) / 100, minimum 1.00
  return Math.max(1.0, Math.floor(((1 - HOUSE_EDGE) * 100) / (1 - h)) / 100);
}

/**
 * Returns the current multiplier at `elapsedMs` milliseconds since round start.
 * Formula: `e^(GROWTH_RATE × elapsedMs)`
 *
 * @see docs/game-state-machine.md §3.6
 */
export function multiplierAtTime(elapsedMs: number): number {
  return Math.E ** (GROWTH_RATE * elapsedMs);
}

/**
 * Inverse of `multiplierAtTime`: returns the ms elapsed when the multiplier
 * reaches `crashPoint`. Used to precompute the crash time at round start.
 * Formula: `ln(crashPoint) / GROWTH_RATE`
 *
 * @see docs/game-state-machine.md §3.6
 */
export function crashTimeMs(crashPoint: number): number {
  return Math.log(crashPoint) / GROWTH_RATE;
}
