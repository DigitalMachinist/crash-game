import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CHAIN_LENGTH } from '../../config';
import {
  computeSeedAtIndex,
  generateRootSeed,
  getChainSeedForGame,
  sha256Hex,
  verifySeedAgainstHash,
} from '../hash-chain';

describe('generateRootSeed', () => {
  it('returns a 64-character hex string', async () => {
    const seed = await generateRootSeed();
    expect(seed).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns different values on successive calls', async () => {
    const seed1 = await generateRootSeed();
    const seed2 = await generateRootSeed();
    expect(seed1).not.toBe(seed2);
  });
});

describe('sha256Hex', () => {
  it('returns a 64-character hex string', async () => {
    const h = await sha256Hex('abc');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
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
  });
});

describe('computeSeedAtIndex', () => {
  it('returns the root seed unchanged at index 0', async () => {
    const root = await generateRootSeed();
    expect(await computeSeedAtIndex(root, 0)).toBe(root);
  });

  it('returns sha256Hex(root) at index 1', async () => {
    const root = await generateRootSeed();
    expect(await computeSeedAtIndex(root, 1)).toBe(await sha256Hex(root));
  });

  it('returns sha256Hex(sha256Hex(root)) at index 2', async () => {
    const root = await generateRootSeed();
    expect(await computeSeedAtIndex(root, 2)).toBe(await sha256Hex(await sha256Hex(root)));
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

describe('getChainSeedForGame', () => {
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
    await expect(getChainSeedForGame(root, 0)).rejects.toThrow(
      `gameNumber must be between 1 and ${CHAIN_LENGTH}, got 0`,
    );
  });

  it('throws for gameNumber > CHAIN_LENGTH', async () => {
    const root = await generateRootSeed();
    const over = CHAIN_LENGTH + 1;
    await expect(getChainSeedForGame(root, over)).rejects.toThrow(
      `gameNumber must be between 1 and ${CHAIN_LENGTH}, got ${over}`,
    );
  });
});
