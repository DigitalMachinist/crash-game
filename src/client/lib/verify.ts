/**
 * Client-side provably fair verification. No server dependency — all inputs
 * are public and available in the round history.
 *
 * @see docs/provably-fair.md §2.7
 */
import { hmacSha256Hex, sha256Hex } from '../../crypto-hex';
import { deriveCrashPoint } from '../../provably-fair';
import type { VerificationResult } from '../../types';

/**
 * Computes `HMAC-SHA256(key = drandRandomness, data = chainSeed)`.
 * SECURITY: drand randomness MUST be the key — see `docs/provably-fair.md §2.5`.
 *
 * @see docs/provably-fair.md §2.5
 */
export async function computeEffectiveSeedFromRandomness(
  chainSeed: string,
  drandRandomness: string,
): Promise<string> {
  // drandRandomness is the KEY, chainSeed is the DATA (critical security property)
  return hmacSha256Hex(drandRandomness, chainSeed);
}

/**
 * Verifies a completed round against its public provably-fair ingredients.
 *
 * Steps:
 * 1. Chain link: `SHA-256(roundSeed) === chainCommitment`
 * 2. Crash point: re-derive via `HMAC(key=drandRandomness, data=roundSeed)`
 *    → `deriveCrashPoint(effectiveSeed)`, compare with ±0.001 tolerance.
 *
 * @see docs/provably-fair.md §2.7
 */
export async function verifyRound(params: {
  roundSeed: string;
  chainCommitment: string;
  drandRound: number;
  drandRandomness: string;
  displayedCrashPoint: number;
}): Promise<VerificationResult> {
  const { roundSeed, chainCommitment, drandRound, drandRandomness, displayedCrashPoint } = params;

  // Step 1: verify chain link
  const computedHash = await sha256Hex(roundSeed);
  const chainValid = computedHash === chainCommitment;

  // Step 2: derive crash point
  const effectiveSeed = await computeEffectiveSeedFromRandomness(roundSeed, drandRandomness);
  const computedCrashPoint = deriveCrashPoint(effectiveSeed);

  if (!chainValid) {
    return {
      valid: false,
      reason: 'chain link invalid',
      computedCrashPoint,
      chainValid,
      drandRound,
      drandRandomness,
    };
  }

  if (Math.abs(computedCrashPoint - displayedCrashPoint) > 0.001) {
    return {
      valid: false,
      reason: 'crash point mismatch',
      computedCrashPoint,
      chainValid,
      drandRound,
      drandRandomness,
    };
  }

  return { valid: true, computedCrashPoint, chainValid, drandRound, drandRandomness };
}
