import { describe, expect, it } from 'vitest';
import { computeEffectiveSeed, deriveCrashPoint, hashToFloat } from '../../provably-fair';

describe('hashToFloat', () => {
  it('returns 0 for an all-zero prefix', () => {
    expect(hashToFloat('0'.repeat(64))).toBe(0);
  });

  it('returns a value strictly less than 1 for an all-f prefix', () => {
    const result = hashToFloat('f'.repeat(64));
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });

  it('always returns a value in [0, 1)', () => {
    const vectors = [
      '0'.repeat(64),
      '1' + '0'.repeat(63),
      '8000000000000' + '0'.repeat(51),
      'f'.repeat(64),
      'deadbeefcafebabe' + '0'.repeat(48),
    ];
    for (const hex of vectors) {
      const result = hashToFloat(hex);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(1);
    }
  });

  it('returns 0.5 for a hash starting with 8000000000000', () => {
    // 0x8000000000000 = 2^51, and 2^51 / 2^52 = 0.5
    const result = hashToFloat('8000000000000' + '0'.repeat(51));
    expect(result).toBe(0.5);
  });

  it('only uses the first 13 hex characters', () => {
    const a = hashToFloat('abcde12345678' + '0'.repeat(51));
    const b = hashToFloat('abcde12345678' + 'f'.repeat(51));
    expect(a).toBe(b);
  });
});

describe('deriveCrashPoint', () => {
  it('returns 1.0 for a hash with float value 0 (immediate crash)', () => {
    // h = 0 → floor(99 / 1.0) / 100 = 0.99 → clamped to 1.0
    expect(deriveCrashPoint('0'.repeat(64))).toBe(1.0);
  });

  it('returns 1.0 for any hash below the house-edge threshold', () => {
    // Any h < 0.01 gives crash point < 1.0 before clamping
    // '0'.repeat(64) → h = 0.0, safely below threshold
    expect(deriveCrashPoint('0'.repeat(64))).toBe(1.0);
  });

  it('returns 1.98 for h = 0.5 (floor(99/0.5)/100)', () => {
    // 0x8000000000000 → h = 0.5 → floor(99/0.5)/100 = floor(198)/100 = 1.98
    expect(deriveCrashPoint('8000000000000' + '0'.repeat(51))).toBe(1.98);
  });

  it('minimum crash point is 1.0', () => {
    // Test several low hash values
    const lowHashes = ['0'.repeat(64), '0000100000000' + '0'.repeat(51)];
    for (const hex of lowHashes) {
      expect(deriveCrashPoint(hex)).toBeGreaterThanOrEqual(1.0);
    }
  });

  it('crash point increases as hash float value increases', () => {
    // Strictly increasing h → strictly increasing crash point (once above clamp threshold)
    const h25 = deriveCrashPoint('4000000000000' + '0'.repeat(51)); // h ≈ 0.25
    const h50 = deriveCrashPoint('8000000000000' + '0'.repeat(51)); // h = 0.5
    const h75 = deriveCrashPoint('c000000000000' + '0'.repeat(51)); // h ≈ 0.75
    expect(h25).toBeLessThan(h50);
    expect(h50).toBeLessThan(h75);
  });
});

describe('computeEffectiveSeed', () => {
  it('returns a 64-char lowercase hex string', async () => {
    const result = await computeEffectiveSeed('a'.repeat(64), 'b'.repeat(64));
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for the same inputs', async () => {
    const seed = 'c'.repeat(64);
    const randomness = 'd'.repeat(64);
    const r1 = await computeEffectiveSeed(seed, randomness);
    const r2 = await computeEffectiveSeed(seed, randomness);
    expect(r1).toBe(r2);
  });

  it('produces different results for different chainSeeds', async () => {
    const randomness = 'e'.repeat(64);
    const r1 = await computeEffectiveSeed('0'.repeat(64), randomness);
    const r2 = await computeEffectiveSeed('f'.repeat(64), randomness);
    expect(r1).not.toBe(r2);
  });

  it('produces different results for different drandRandomness values', async () => {
    const seed = '1'.repeat(64);
    const r1 = await computeEffectiveSeed(seed, '0'.repeat(64));
    const r2 = await computeEffectiveSeed(seed, 'f'.repeat(64));
    expect(r1).not.toBe(r2);
  });

  it('key ordering matters: HMAC(key=drand, data=seed) ≠ HMAC(key=seed, data=drand)', async () => {
    const a = '0'.repeat(64);
    const b = 'f'.repeat(64);
    const ab = await computeEffectiveSeed(a, b); // key=b, data=a
    const ba = await computeEffectiveSeed(b, a); // key=a, data=b
    expect(ab).not.toBe(ba);
  });
});
