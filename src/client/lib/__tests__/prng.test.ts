import { describe, expect, it } from 'vitest';
import { generateRoundTarget, HOSTNAMES, IP_PREFIXES, mulberry32, seededPick } from '../prng';

describe('mulberry32', () => {
  it('returns a function', () => {
    const rng = mulberry32(42);
    expect(typeof rng).toBe('function');
  });

  it('produces values in [0, 1)', () => {
    const rng = mulberry32(12345);
    for (let i = 0; i < 100; i++) {
      const val = rng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it('is deterministic — same seed produces same sequence', () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    for (let i = 0; i < 20; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it('different seeds produce different sequences', () => {
    const rng1 = mulberry32(1);
    const rng2 = mulberry32(2);
    const seq1 = Array.from({ length: 5 }, () => rng1());
    const seq2 = Array.from({ length: 5 }, () => rng2());
    expect(seq1).not.toEqual(seq2);
  });
});

describe('seededPick', () => {
  it('returns an element from the array', () => {
    const rng = mulberry32(42);
    const arr = ['a', 'b', 'c'] as const;
    const result = seededPick(arr, rng);
    expect(arr).toContain(result);
  });

  it('is deterministic with the same RNG state', () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    const arr = ['x', 'y', 'z'] as const;
    expect(seededPick(arr, rng1)).toBe(seededPick(arr, rng2));
  });

  it('throws when called with an empty array', () => {
    const rng = mulberry32(1);
    expect(() => seededPick([], rng)).toThrow('seededPick called with empty array');
  });

  it('returns the only element for single-element arrays', () => {
    const rng = mulberry32(1);
    expect(seededPick(['only'], rng)).toBe('only');
  });
});

describe('generateRoundTarget', () => {
  it('returns an object with org, hostname, ip, and roundId', () => {
    const rng = mulberry32(1);
    const target = generateRoundTarget(5, rng);
    expect(target).toHaveProperty('org');
    expect(target).toHaveProperty('hostname');
    expect(target).toHaveProperty('ip');
    expect(target.roundId).toBe(5);
  });

  it('produces an IP ending with .██', () => {
    const rng = mulberry32(42);
    const target = generateRoundTarget(1, rng);
    expect(target.ip).toMatch(/\.\u2588\u2588$/);
  });

  it('hostname comes from HOSTNAMES pool', () => {
    const rng = mulberry32(42);
    const target = generateRoundTarget(1, rng);
    expect(HOSTNAMES).toContain(target.hostname);
  });

  it('IP prefix comes from IP_PREFIXES pool', () => {
    const rng = mulberry32(42);
    const target = generateRoundTarget(1, rng);
    const prefix = target.ip.replace('.██', '');
    expect(IP_PREFIXES).toContain(prefix);
  });

  it('is deterministic for the same seed', () => {
    const t1 = generateRoundTarget(1, mulberry32(99));
    const t2 = generateRoundTarget(1, mulberry32(99));
    expect(t1).toEqual(t2);
  });
});
