import { describe, expect, it } from 'vitest';
import { HOUSE_EDGE } from '../../../config';
import { computeEffectiveSeedFromRandomness, verifyRound } from '../verify';

// ─── Local helpers (mirrors unexported functions in verify.ts) ────────────────

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256AsHex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(hashBuffer));
}

function hashToFloat(hex: string): number {
  return parseInt(hex.slice(0, 13), 16) / 2 ** 52;
}

const CRASH_NUMERATOR = Math.round((1 - HOUSE_EDGE) * 100);

function deriveCrashPoint(effectiveSeed: string): number {
  const h = hashToFloat(effectiveSeed);
  return Math.max(1.0, Math.floor(CRASH_NUMERATOR / (1 - h)) / 100);
}

// ─── House edge constant parity ───────────────────────────────────────────────

describe('HOUSE_EDGE config parity', () => {
  it('CRASH_NUMERATOR equals 99 when HOUSE_EDGE is 0.01', () => {
    expect(CRASH_NUMERATOR).toBe(99);
  });
});

// ─── Test vectors ─────────────────────────────────────────────────────────────

const KEY_HEX = '0000000000000000000000000000000000000000000000000000000000000002';
const DATA_HEX = '0000000000000000000000000000000000000000000000000000000000000001';

// ─── computeEffectiveSeedFromRandomness ─────────────────────────────────────────────────────

describe('computeEffectiveSeedFromRandomness', () => {
  it('returns a 64-char hex string', async () => {
    const result = await computeEffectiveSeedFromRandomness(DATA_HEX, KEY_HEX);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic — same inputs produce the same output', async () => {
    const first = await computeEffectiveSeedFromRandomness(DATA_HEX, KEY_HEX);
    const second = await computeEffectiveSeedFromRandomness(DATA_HEX, KEY_HEX);
    expect(first).toBe(second);
  });

  it('key/data ordering matters — swapping args produces a different result', async () => {
    const correct = await computeEffectiveSeedFromRandomness(DATA_HEX, KEY_HEX);
    const reversed = await computeEffectiveSeedFromRandomness(KEY_HEX, DATA_HEX);
    expect(correct).not.toBe(reversed);
  });
});

// ─── verifyRound ──────────────────────────────────────────────────────────────

describe('verifyRound', () => {
  const roundSeed = 'a'.repeat(64); // 64-char hex string
  const drandRound = 1234;
  const drandRandomness = KEY_HEX;

  it('returns valid: true for a consistent round', async () => {
    const chainCommitment = await sha256AsHex(roundSeed);
    const effectiveSeed = await computeEffectiveSeedFromRandomness(roundSeed, drandRandomness);
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
    const chainCommitment = await sha256AsHex(roundSeed);
    const effectiveSeed = await computeEffectiveSeedFromRandomness(roundSeed, drandRandomness);
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
    const effectiveSeed = await computeEffectiveSeedFromRandomness(roundSeed, drandRandomness);
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
    const chainCommitment = await sha256AsHex(roundSeed);
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
