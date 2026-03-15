import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CHAIN_LENGTH } from '../../config';
import { sha256Hex } from '../../crypto-hex';
import {
  computeChainSeedForGame,
  computeSeedAtIndex,
  computeTerminalHash,
  generateRootSeed,
  verifySeedAgainstHash,
} from '../hash-chain';

describe('generateRootSeed', () => {
  it('returns a 64-character hex string', () => {
    const seed = generateRootSeed();
    expect(seed).toMatch(/^[0-9a-f]{64}$/);
    expect(seed).toHaveLength(64);
  });

  it('returns different values on successive calls', () => {
    const seed1 = generateRootSeed();
    const seed2 = generateRootSeed();
    expect(seed1).not.toBe(seed2);
  });
});

describe('sha256Hex', () => {
  it('returns a 64-character hex string', async () => {
    const h = await sha256Hex('abc');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toHaveLength(64);
  });

  it('is deterministic for the same input', async () => {
    const h1 = await sha256Hex('abc');
    const h2 = await sha256Hex('abc');
    expect(h1).toBe(h2);
  });

  it('returns different hashes for different inputs', async () => {
    const h1 = await sha256Hex('abc');
    const h2 = await sha256Hex('def');
    expect(h1).not.toBe(h2);
    expect(h1).toHaveLength(64);
    expect(h2).toHaveLength(64);
  });
});

describe('computeSeedAtIndex', () => {
  it('returns the root seed unchanged at index 0', async () => {
    const root = await generateRootSeed();
    const result = await computeSeedAtIndex(root, 0);
    expect(result).toBe(root);
    expect(result).toHaveLength(64);
  });

  it('returns sha256Hex(root) at index 1', async () => {
    const root = await generateRootSeed();
    const result = await computeSeedAtIndex(root, 1);
    expect(result).toBe(await sha256Hex(root));
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns sha256Hex(sha256Hex(root)) at index 2', async () => {
    const root = await generateRootSeed();
    const result = await computeSeedAtIndex(root, 2);
    expect(result).toBe(await sha256Hex(await sha256Hex(root)));
    expect(result).toHaveLength(64);
  });

  it('is deterministic for the same root and index', async () => {
    const root = generateRootSeed();
    const r1 = await computeSeedAtIndex(root, 5);
    const r2 = await computeSeedAtIndex(root, 5);
    expect(r1).toBe(r2);
  });

  it('produces different values for different indices', async () => {
    const root = generateRootSeed();
    const r1 = await computeSeedAtIndex(root, 3);
    const r2 = await computeSeedAtIndex(root, 4);
    expect(r1).not.toBe(r2);
  });
});

describe('computeTerminalHash', () => {
  it('returns a 64-character hex string', async () => {
    const root = generateRootSeed();
    const hash = await computeTerminalHash(root);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toHaveLength(64);
  });

  it('equals computeSeedAtIndex(root, CHAIN_LENGTH)', async () => {
    const root = generateRootSeed();
    const terminal = await computeTerminalHash(root);
    const expected = await computeSeedAtIndex(root, CHAIN_LENGTH);
    expect(terminal).toBe(expected);
  });

  it('is deterministic', async () => {
    const root = generateRootSeed();
    const h1 = await computeTerminalHash(root);
    const h2 = await computeTerminalHash(root);
    expect(h1).toBe(h2);
  });
});

describe('verifySeedAgainstHash', () => {
  it('returns true when SHA256(seed) matches expectedHash', async () => {
    const seed = 'deadbeef';
    const hash = await sha256Hex(seed);
    expect(await verifySeedAgainstHash(seed, hash)).toBe(true);
  });

  it('returns false when seed is tampered', async () => {
    const seed = 'deadbeef';
    const hash = await sha256Hex(seed);
    const tamperedSeed = seed.slice(0, -1) + (seed.endsWith('f') ? 'e' : 'f');
    expect(await verifySeedAgainstHash(tamperedSeed, hash)).toBe(false);
  });

  it('returns false when hash is tampered', async () => {
    const seed = 'deadbeef';
    const hash = await sha256Hex(seed);
    const tamperedHash = hash.slice(0, -1) + (hash.endsWith('f') ? 'e' : 'f');
    expect(await verifySeedAgainstHash(seed, tamperedHash)).toBe(false);
  });

  it('property: verifySeedAgainstHash(seed, sha256Hex(seed)) is always true', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), async (seed) => {
        const hash = await sha256Hex(seed);
        return verifySeedAgainstHash(seed, hash);
      }),
      { numRuns: 100 },
    );
  });

  it('property: flipping one char of the hash causes verification to fail', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), async (seed) => {
        const hash = await sha256Hex(seed);
        // Flip the last character of the hash to create a tampered version
        const lastChar = hash[hash.length - 1];
        const flipped = lastChar === 'f' ? 'e' : 'f';
        const tamperedHash = hash.slice(0, -1) + flipped;
        const result = await verifySeedAgainstHash(seed, tamperedHash);
        return result === false;
      }),
      { numRuns: 100 },
    );
  });
});

describe('computeChainSeedForGame', () => {
  it('returns a 64-character hex string for game 1', async () => {
    const root = generateRootSeed();
    const seed = await computeChainSeedForGame(root, 1);
    expect(seed).toMatch(/^[0-9a-f]{64}$/);
    expect(seed).toHaveLength(64);
  });

  it('returns a 64-character hex string for game CHAIN_LENGTH', async () => {
    const root = generateRootSeed();
    const seed = await computeChainSeedForGame(root, CHAIN_LENGTH);
    expect(seed).toMatch(/^[0-9a-f]{64}$/);
    expect(seed).toHaveLength(64);
  });

  it('game 1 maps to index CHAIN_LENGTH-1', async () => {
    const root = generateRootSeed();
    const game1Seed = await computeChainSeedForGame(root, 1);
    const directSeed = await computeSeedAtIndex(root, CHAIN_LENGTH - 1);
    expect(game1Seed).toBe(directSeed);
  });

  it('game CHAIN_LENGTH maps to index 0 (the root seed)', async () => {
    const root = generateRootSeed();
    const lastGameSeed = await computeChainSeedForGame(root, CHAIN_LENGTH);
    expect(lastGameSeed).toBe(root);
  });

  it('is deterministic', async () => {
    const root = generateRootSeed();
    const s1 = await computeChainSeedForGame(root, 42);
    const s2 = await computeChainSeedForGame(root, 42);
    expect(s1).toBe(s2);
  });

  it('different game numbers produce different seeds', async () => {
    const root = generateRootSeed();
    const s1 = await computeChainSeedForGame(root, 1);
    const s2 = await computeChainSeedForGame(root, 2);
    expect(s1).not.toBe(s2);
  });

  it('chain integrity: SHA256(game N+1 seed) equals game N seed', async () => {
    const root = generateRootSeed();
    const game1Seed = await computeChainSeedForGame(root, 1);
    const game2Seed = await computeChainSeedForGame(root, 2);
    expect(await sha256Hex(game2Seed)).toBe(game1Seed);
  });

  it('chain integrity: seeds link correctly for a 5-game chain (via computeSeedAtIndex)', async () => {
    const root = await generateRootSeed();
    const chainLen = 5;

    // Game 1 seed is at index chainLen-1, game 2 at chainLen-2
    const game1Seed = await computeSeedAtIndex(root, chainLen - 1);
    const game2Seed = await computeSeedAtIndex(root, chainLen - 2);
    const terminalHash = await computeSeedAtIndex(root, chainLen);

    // SHA256(game1Seed) should equal terminalHash
    expect(await sha256Hex(game1Seed)).toBe(terminalHash);

    // SHA256(game2Seed) should equal game1Seed (chain links backward)
    expect(await sha256Hex(game2Seed)).toBe(game1Seed);
  });

  it('throws for gameNumber < 1', async () => {
    const root = await generateRootSeed();
    await expect(computeChainSeedForGame(root, 0)).rejects.toThrow(
      `gameNumber must be between 1 and ${CHAIN_LENGTH}, got 0`,
    );
  });

  it('throws for gameNumber > CHAIN_LENGTH', async () => {
    const root = await generateRootSeed();
    const over = CHAIN_LENGTH + 1;
    await expect(computeChainSeedForGame(root, over)).rejects.toThrow(
      `gameNumber must be between 1 and ${CHAIN_LENGTH}, got ${over}`,
    );
  });

  it('property: game numbers near CHAIN_LENGTH (low-index, fast) return 64-char hex', async () => {
    // Only test game numbers near CHAIN_LENGTH — those map to low chain indices (0-10 hash ops)
    // Testing near-1 game numbers would require ~10000 SHA-256 ops each and time out
    const root = generateRootSeed();
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: CHAIN_LENGTH - 10, max: CHAIN_LENGTH }),
        async (gameNumber) => {
          const seed = await computeChainSeedForGame(root, gameNumber);
          return seed.length === 64 && /^[0-9a-f]+$/.test(seed);
        },
      ),
      { numRuns: 10 },
    );
  });
});
