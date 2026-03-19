/**
 * Multiplier curve math for the RUNNING phase.
 *
 * Owns `multiplierAtTime` and `computeCrashTimeMs`. Crash-point derivation
 * lives in `provably-fair.ts`; import from there directly.
 *
 * @see docs/provably-fair.md §1.6
 * @see docs/game-state-machine.md §3.6
 */
import { GROWTH_RATE } from '../config';

/** Current multiplier at `elapsedMs` since round start. @see docs/game-state-machine.md §3.6 */
export function multiplierAtTime(elapsedMs: number): number {
  return Math.E ** (GROWTH_RATE * elapsedMs);
}

/** Inverse of `multiplierAtTime` — ms when multiplier reaches `crashPoint`. @see docs/game-state-machine.md §3.6 */
export function computeCrashTimeMs(crashPoint: number): number {
  return Math.log(crashPoint) / GROWTH_RATE;
}
