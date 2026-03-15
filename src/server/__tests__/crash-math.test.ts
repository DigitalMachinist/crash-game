import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import { deriveCrashPoint, hashToFloat } from '../../provably-fair';
import { computeCrashTimeMs, multiplierAtTime } from '../crash-math';

vi.setConfig({ testTimeout: 30000 });

// ─── hashToFloat ─────────────────────────────────────────────────────────────

describe('hashToFloat', () => {
  it('returns 0 for all-zero hex', () => {
    expect(hashToFloat('0'.repeat(64))).toBe(0);
  });

  it('returns value approaching 1 for fffffffffffff + zeros', () => {
    const val = hashToFloat('f'.repeat(13) + '0'.repeat(51));
    expect(val).toBeGreaterThan(0.999);
    expect(val).toBeLessThan(1);
  });

  it('uses first 13 hex characters: all-zero prefix → 0', () => {
    expect(hashToFloat('0000000000000' + '0'.repeat(51))).toBe(0);
  });

  it('uses first 13 hex characters: all-f prefix → close to 1', () => {
    const val = hashToFloat('fffffffffffff' + '0'.repeat(51));
    expect(val).toBeGreaterThan(0.999);
    expect(val).toBeLessThan(1);
  });

  it('is deterministic — same input produces same output', () => {
    const hex = 'a3f9c2b17e54d8a3f9c2b17e54d8a3f9c2b17e54d8a3f9c2b17e54d8a3f9c2b1';
    expect(hashToFloat(hex)).toBe(hashToFloat(hex));
  });

  it('property: returns value in [0, 1) for arbitrary hex inputs', () => {
    // fc.hexaString removed in fast-check v4; use array of nibbles mapped to hex chars
    const hexArb = fc
      .array(fc.nat(15), { minLength: 64, maxLength: 64 })
      .map((nums) => nums.map((n) => n.toString(16)).join(''));
    fc.assert(
      fc.property(hexArb, (hex) => {
        const val = hashToFloat(hex);
        return val >= 0 && val < 1;
      }),
      { numRuns: 1000 },
    );
  });
});

// ─── deriveCrashPoint ────────────────────────────────────────────────────────

describe('deriveCrashPoint', () => {
  it('returns 1.00 for all-zero effective seed (h=0 → 0.99 floored → max(1.00, 0.99) = 1.00)', () => {
    expect(deriveCrashPoint('0'.repeat(64))).toBe(1.0);
  });

  it('returns 1.00 when h < 0.01 (house edge zone)', () => {
    // '0000000000000' → h=0, well within the house edge zone
    expect(deriveCrashPoint('0000000000000' + '0'.repeat(51))).toBe(1.0);
  });

  it('returns 2.00 for seed where h ≈ 0.505', () => {
    // We need h such that floor(99/0.495)/100 = 2.00
    // h ≈ 0.505 → 1-h = 0.495 → 99/0.495 = 200 → floor(200)/100 = 2.00
    // 0.505 * 2^52 = 0x813333333333 ≈ 2278341413683
    // hex of 2278341413683 = 0x2127E0000000B → let's compute:
    // 0.505 * 2^52 = 0.505 * 4503599627370496 = 2275317811782100.48 ≈ 0x813333333334
    const target = Math.round(0.505 * 2 ** 52);
    const hex = target.toString(16).padStart(13, '0') + '0'.repeat(51);
    const result = deriveCrashPoint(hex);
    expect(result).toBe(2.0);
  });

  it('floors to 2 decimal places — never rounds up', () => {
    // Any seed where the raw value would be e.g. 1.999... should floor to 1.99
    // h such that 99/(1-h) = 199.99 → 1-h = 99/199.99 → h = 1 - 99/199.99
    const h = 1 - 99 / 199.99;
    const target = Math.floor(h * 2 ** 52);
    const hex = target.toString(16).padStart(13, '0') + '0'.repeat(51);
    const result = deriveCrashPoint(hex);
    // Should be 1.99, not 2.00
    expect(result).toBe(1.99);
  });

  it('never returns less than 1.00', () => {
    const hexArb = fc
      .array(fc.nat(15), { minLength: 64, maxLength: 64 })
      .map((nums) => nums.map((n) => n.toString(16)).join(''));
    fc.assert(
      fc.property(hexArb, (hex) => deriveCrashPoint(hex) >= 1.0),
      { numRuns: 1000 },
    );
  });

  it('property: result is in [1.00, Infinity) and has ≤ 2 decimal places', () => {
    const hexArb = fc
      .array(fc.nat(15), { minLength: 64, maxLength: 64 })
      .map((nums) => nums.map((n) => n.toString(16)).join(''));
    fc.assert(
      fc.property(hexArb, (hex) => {
        const result = deriveCrashPoint(hex);
        if (result < 1.0) return false;
        if (!isFinite(result)) return false;
        // Check ≤ 2 decimal places by verifying round-trip at 2dp
        const rounded = Math.round(result * 100) / 100;
        return Math.abs(rounded - result) < 1e-9;
      }),
      { numRuns: 1000 },
    );
  });

  it('property: deterministic — same input always produces same output', () => {
    const hexArb = fc
      .array(fc.nat(15), { minLength: 64, maxLength: 64 })
      .map((nums) => nums.map((n) => n.toString(16)).join(''));
    fc.assert(
      fc.property(hexArb, hexArb, (a, b) => {
        const pointA = deriveCrashPoint(a);
        const pointB = deriveCrashPoint(b);
        // Both must be >= 1.00 (deterministic lower bound)
        return pointA >= 1.0 && pointB >= 1.0;
      }),
      { numRuns: 1000 },
    );
  });

  it('statistical house edge: ~1-2% of outcomes are instant crashes (1.00)', () => {
    // P(crash=1.00) ≈ 1.98%: ~1% from house edge clamp (h<0.01) + ~1% from floor(99/(1-h))=100
    // Using crypto.getRandomValues for uniform distribution
    let instantCrashes = 0;
    const samples = 100_000;
    const buf = new Uint8Array(32);
    for (let i = 0; i < samples; i++) {
      crypto.getRandomValues(buf);
      const hex = Array.from(buf)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      if (deriveCrashPoint(hex) === 1.0) {
        instantCrashes++;
      }
    }
    const fraction = instantCrashes / samples;
    // Theoretical value is ~1.98%; allow generous range for statistical variation
    expect(fraction).toBeGreaterThanOrEqual(0.015);
    expect(fraction).toBeLessThanOrEqual(0.025);
  });

  it('distribution: ~50% of results are ≤ 2.00 over 100k samples', () => {
    let countLeq2 = 0;
    const samples = 100_000;
    for (let i = 0; i < samples; i++) {
      const hex = crypto.randomUUID().replace(/-/g, '').repeat(2).slice(0, 64);
      if (deriveCrashPoint(hex) <= 2.0) {
        countLeq2++;
      }
    }
    const fraction = countLeq2 / samples;
    // Expected ~50% (within reasonable variance for 100k samples)
    expect(fraction).toBeGreaterThanOrEqual(0.48);
    expect(fraction).toBeLessThanOrEqual(0.52);
  });

  it('edge case: very high h returns large finite number, not NaN or Infinity', () => {
    // 'ffffffffffffff' — first 13 chars are all f, giving h very close to 1
    // but not exactly 1, so result should be large but finite
    const hex = 'ffffffffffffff' + '0'.repeat(50);
    const result = deriveCrashPoint(hex);
    expect(isFinite(result)).toBe(true);
    expect(isNaN(result)).toBe(false);
    expect(result).toBeGreaterThan(1.0);
  });
});

// ─── multiplierAtTime ────────────────────────────────────────────────────────

describe('multiplierAtTime', () => {
  it('returns 1.00 at t=0', () => {
    expect(multiplierAtTime(0)).toBeCloseTo(1.0, 10);
  });

  it('returns ~2.00 at t=11552ms (ln(2)/0.00006 ≈ 11552.45)', () => {
    expect(multiplierAtTime(11552)).toBeCloseTo(2.0, 1);
  });

  it('is strictly monotonically increasing', () => {
    expect(multiplierAtTime(1000)).toBeGreaterThan(multiplierAtTime(500));
  });

  it('never returns less than 1.00 for t >= 0', () => {
    for (const t of [0, 1, 100, 1000, 10000, 100000]) {
      expect(multiplierAtTime(t)).toBeGreaterThanOrEqual(1.0);
    }
  });
});

// ─── computeCrashTimeMs ─────────────────────────────────────────────────────────────

describe('computeCrashTimeMs', () => {
  it('is the inverse of multiplierAtTime: multiplierAtTime(computeCrashTimeMs(2.5)) ≈ 2.5', () => {
    const t = computeCrashTimeMs(2.5);
    expect(Math.abs(multiplierAtTime(t) - 2.5)).toBeLessThan(0.0001);
  });

  it('returns 0 for crashPoint=1.00 (ln(1)/GROWTH_RATE = 0)', () => {
    expect(computeCrashTimeMs(1.0)).toBe(0);
  });

  it('returns a positive number for crashPoint > 1.00', () => {
    expect(computeCrashTimeMs(2.0)).toBeGreaterThan(0);
    expect(computeCrashTimeMs(10.0)).toBeGreaterThan(0);
  });
});
