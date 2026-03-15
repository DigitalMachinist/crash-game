/**
 * Hash chain utilities for the provably fair seed sequence.
 *
 * The chain is built forward: `rootSeed → sha256 → seed[1] → … → seed[CHAIN_LENGTH] = terminalHash`.
 * Games consume the chain in reverse: game k uses `seed[CHAIN_LENGTH − k]`.
 *
 * Two numbering systems:
 * - **Chain index** (0 = rootSeed, CHAIN_LENGTH = terminalHash) — used in `computeSeedAtIndex`.
 * - **Game number** (1, 2, 3 …) — used in `computeChainSeedForGame`.
 *
 * @see docs/provably-fair.md §2.2
 */
import { CHAIN_LENGTH } from '../config';
import { bytesToHex, sha256Hex } from '../crypto-hex';

/**
 * Generates a cryptographically random 256-bit root seed (32 bytes as hex).
 * Called on first DO initialization and on chain rotation.
 *
 * @see docs/provably-fair.md §2.2
 */
export function generateRootSeed(): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
}

/**
 * Computes `SHA-256^index(rootSeed)` by applying SHA-256 `index` times forward.
 * Index 0 returns `rootSeed` unchanged; index `CHAIN_LENGTH` returns `terminalHash`.
 *
 * @see docs/provably-fair.md §2.2
 */
export async function computeSeedAtIndex(rootSeed: string, index: number): Promise<string> {
  let current = rootSeed;
  for (let i = 0; i < index; i++) {
    current = await sha256Hex(current);
  }
  return current;
}

/**
 * Computes the terminal hash (`SHA-256^CHAIN_LENGTH(rootSeed)`).
 * This is published as the initial `chainCommitment`, committing to all future
 * game seeds in the chain without revealing any of them.
 *
 * @see docs/provably-fair.md §2.2
 */
export async function computeTerminalHash(rootSeed: string): Promise<string> {
  return computeSeedAtIndex(rootSeed, CHAIN_LENGTH);
}

/**
 * Verifies that `SHA-256(seed) === expectedHash`.
 * Used to confirm a revealed seed was pre-committed by a published hash.
 *
 * @see docs/provably-fair.md §2.7
 */
export async function verifySeedAgainstHash(seed: string, expectedHash: string): Promise<boolean> {
  const computed = await sha256Hex(seed);
  return computed === expectedHash;
}

/**
 * Returns the chain seed for a given game number.
 * Mapping: game k → chain index `CHAIN_LENGTH − k`
 * (game 1 → index 9999, game 2 → index 9998, …)
 *
 * Games consume the chain in reverse so that the published `terminalHash`
 * commits to all future seeds without revealing them.
 *
 * @see docs/provably-fair.md §2.2 (two numbering systems)
 */
export async function computeChainSeedForGame(
  rootSeed: string,
  gameNumber: number,
): Promise<string> {
  if (gameNumber < 1 || gameNumber > CHAIN_LENGTH) {
    throw new Error(`gameNumber must be between 1 and ${CHAIN_LENGTH}, got ${gameNumber}`);
  }
  // Game 1 uses index CHAIN_LENGTH-1, game 2 uses CHAIN_LENGTH-2, etc.
  return computeSeedAtIndex(rootSeed, CHAIN_LENGTH - gameNumber);
}
