/**
 * Multiplier curve math for the RUNNING phase.
 *
 * Owns `multiplierAtTime` and `computeCrashTimeMs`. Crash-point derivation
 * lives in `provably-fair.ts`; import from there directly.
 *
 * @see docs/provably-fair.md §2.6
 * @see docs/game-state-machine.md §3.6
 */
import { GROWTH_RATE } from '../config';

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
export function computeCrashTimeMs(crashPoint: number): number {
  return Math.log(crashPoint) / GROWTH_RATE;
}
