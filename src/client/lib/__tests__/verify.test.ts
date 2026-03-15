import { describe, expect, it } from 'vitest';
import { HOUSE_EDGE } from '../../../config';
import { sha256Hex } from '../../../crypto-hex';
import { deriveCrashPoint } from '../../../provably-fair';
import { computeEffectiveSeedFromBeacon, verifyRound } from '../verify';

// ─── House edge constant parity ───────────────────────────────────────────────

describe('HOUSE_EDGE config parity', () => {
  it('HOUSE_EDGE is 0.01 (1% house edge)', () => {
    expect(HOUSE_EDGE).toBe(0.01);
  });
});

// ─── Test vectors ─────────────────────────────────────────────────────────────

const KEY_HEX = '0000000000000000000000000000000000000000000000000000000000000002';
const DATA_HEX = '0000000000000000000000000000000000000000000000000000000000000001';

// ─── computeEffectiveSeedFromBeacon ─────────────────────────────────────────────────────

describe('computeEffectiveSeedFromBeacon', () => {
  it('returns a 64-char hex string', async () => {
    const result = await computeEffectiveSeedFromBeacon(DATA_HEX, KEY_HEX);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic — same inputs produce the same output', async () => {
    const first = await computeEffectiveSeedFromBeacon(DATA_HEX, KEY_HEX);
    const second = await computeEffectiveSeedFromBeacon(DATA_HEX, KEY_HEX);
    expect(first).toBe(second);
  });

  it('key/data ordering matters — swapping args produces a different result', async () => {
    const correct = await computeEffectiveSeedFromBeacon(DATA_HEX, KEY_HEX);
    const reversed = await computeEffectiveSeedFromBeacon(KEY_HEX, DATA_HEX);
    expect(correct).not.toBe(reversed);
  });
});

// ─── verifyRound ──────────────────────────────────────────────────────────────

describe('verifyRound', () => {
  const roundSeed = 'a'.repeat(64); // 64-char hex string
  const drandRound = 1234;
  const drandRandomness = KEY_HEX;

  it('returns valid: true for a consistent round', async () => {
    const chainCommitment = await sha256Hex(roundSeed);
    const effectiveSeed = await computeEffectiveSeedFromBeacon(roundSeed, drandRandomness);
    const displayedCrashPoint = deriveCrashPoint(effectiveSeed);

    const result = await verifyRound({
      roundSeed,
      chainCommitment,
      drandRound,
      drandRandomness,
      displayedCrashPoint,
    });

    expect(result.valid).toBe(true);
  });

  it('always includes computedCrashPoint, chainValid, drandRound, drandRandomness', async () => {
    const chainCommitment = await sha256Hex(roundSeed);
    const effectiveSeed = await computeEffectiveSeedFromBeacon(roundSeed, drandRandomness);
    const displayedCrashPoint = deriveCrashPoint(effectiveSeed);

    const result = await verifyRound({
      roundSeed,
      chainCommitment,
      drandRound,
      drandRandomness,
      displayedCrashPoint,
    });

    expect(result.computedCrashPoint).toBeTypeOf('number');
    expect(result.chainValid).toBeTypeOf('boolean');
    expect(result.drandRound).toBe(drandRound);
    expect(result.drandRandomness).toBe(drandRandomness);
  });

  it('returns valid: false with reason "chain link invalid" when chainCommitment is wrong', async () => {
    const wrongChainCommitment = 'b'.repeat(64);
    const effectiveSeed = await computeEffectiveSeedFromBeacon(roundSeed, drandRandomness);
    const displayedCrashPoint = deriveCrashPoint(effectiveSeed);

    const result = await verifyRound({
      roundSeed,
      chainCommitment: wrongChainCommitment,
      drandRound,
      drandRandomness,
      displayedCrashPoint,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('chain link invalid');
    expect(result.chainValid).toBe(false);
    expect(result.computedCrashPoint).toBeTypeOf('number');
    expect(result.drandRound).toBe(drandRound);
    expect(result.drandRandomness).toBe(drandRandomness);
  });

  it('returns valid: false with reason "crash point mismatch" when displayedCrashPoint is wrong', async () => {
    const chainCommitment = await sha256Hex(roundSeed);
    const displayedCrashPoint = 999.99; // deliberately wrong

    const result = await verifyRound({
      roundSeed,
      chainCommitment,
      drandRound,
      drandRandomness,
      displayedCrashPoint,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('crash point mismatch');
    expect(result.chainValid).toBe(true);
    expect(result.computedCrashPoint).toBeTypeOf('number');
    expect(result.drandRound).toBe(drandRound);
    expect(result.drandRandomness).toBe(drandRandomness);
  });
});
