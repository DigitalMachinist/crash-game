import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DRAND_BASE_URL, DRAND_GENESIS_TIME, DRAND_PERIOD_SECS } from '../../config';
import {
  computeEffectiveSeedFromBeacon,
  DrandFetchError,
  drandRoundTime,
  fetchDrandBeacon,
  getCurrentDrandRound,
} from '../drand';

const mockBeacon = { round: 100, randomness: 'a'.repeat(64), signature: 'b'.repeat(96) };

afterEach(() => vi.unstubAllGlobals());

// ─── getCurrentDrandRound ────────────────────────────────────────────────────

describe('getCurrentDrandRound', () => {
  it('returns 1 at exactly genesis time', () => {
    expect(getCurrentDrandRound(DRAND_GENESIS_TIME * 1000)).toBe(1);
  });

  it('returns 2 at genesis + 1 period', () => {
    expect(getCurrentDrandRound((DRAND_GENESIS_TIME + DRAND_PERIOD_SECS) * 1000)).toBe(2);
  });

  it('floor behavior: returns 3 at genesis + 2.5 periods', () => {
    expect(getCurrentDrandRound((DRAND_GENESIS_TIME + 2.5 * DRAND_PERIOD_SECS) * 1000)).toBe(3);
  });

  it('consistency: drandRoundTime(getCurrentDrandRound(t)) * 1000 <= t < drandRoundTime(getCurrentDrandRound(t) + 1) * 1000', () => {
    const testTimes = [
      DRAND_GENESIS_TIME * 1000,
      (DRAND_GENESIS_TIME + 1) * 1000,
      (DRAND_GENESIS_TIME + 7.5 * DRAND_PERIOD_SECS) * 1000,
      (DRAND_GENESIS_TIME + 100 * DRAND_PERIOD_SECS) * 1000,
      (DRAND_GENESIS_TIME + 999.9 * DRAND_PERIOD_SECS) * 1000,
    ];
    for (const t of testTimes) {
      const round = getCurrentDrandRound(t);
      const roundStartMs = drandRoundTime(round) * 1000;
      const nextRoundStartMs = drandRoundTime(round + 1) * 1000;
      expect(roundStartMs).toBeLessThanOrEqual(t);
      expect(t).toBeLessThan(nextRoundStartMs);
    }
  });
});

// ─── drandRoundTime ──────────────────────────────────────────────────────────

describe('drandRoundTime', () => {
  it('returns DRAND_GENESIS_TIME for round 1', () => {
    expect(drandRoundTime(1)).toBe(DRAND_GENESIS_TIME);
  });

  it('returns DRAND_GENESIS_TIME + DRAND_PERIOD_SECS for round 2', () => {
    expect(drandRoundTime(2)).toBe(DRAND_GENESIS_TIME + DRAND_PERIOD_SECS);
  });

  it('is the inverse of getCurrentDrandRound at round boundaries', () => {
    for (const round of [1, 2, 10, 100, 500]) {
      const t = drandRoundTime(round) * 1000;
      expect(getCurrentDrandRound(t)).toBe(round);
    }
  });
});

// ─── fetchDrandBeacon ────────────────────────────────────────────────────────

describe('fetchDrandBeacon', () => {
  it('calls the correct primary URL and returns parsed beacon on success', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockBeacon,
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchDrandBeacon(100);

    expect(mockFetch).toHaveBeenCalledWith(
      `${DRAND_BASE_URL}/public/100`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result).toEqual(mockBeacon);
  });

  it('falls back to /public/latest when primary returns non-200 status', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({ ok: true, json: async () => mockBeacon }),
    );

    const result = await fetchDrandBeacon(100);

    expect(result).toEqual(mockBeacon);
  });

  it('falls back to /public/latest when primary throws (simulated AbortError)', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValueOnce(abortError)
        .mockResolvedValueOnce({ ok: true, json: async () => mockBeacon }),
    );

    const result = await fetchDrandBeacon(100);

    expect(result).toEqual(mockBeacon);
  });

  it('throws DrandFetchError when both primary and fallback fail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    await expect(fetchDrandBeacon(100)).rejects.toThrow(DrandFetchError);
    await expect(fetchDrandBeacon(100)).rejects.toThrow(
      /Failed to fetch drand beacon for round 100/,
    );
  });

  it('passes an AbortSignal to fetch', async () => {
    let capturedSignal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, opts: RequestInit) => {
        capturedSignal = opts?.signal as AbortSignal | undefined;
        return Promise.resolve({ ok: true, json: async () => mockBeacon });
      }),
    );

    await fetchDrandBeacon(100, 2000);

    expect(capturedSignal).toBeInstanceOf(AbortSignal);
  });

  it('calls fallback URL when primary fails', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, json: async () => mockBeacon });
    vi.stubGlobal('fetch', mockFetch);

    await fetchDrandBeacon(42);

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      `${DRAND_BASE_URL}/public/42`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      `${DRAND_BASE_URL}/public/latest`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});

// ─── computeEffectiveSeedFromBeacon ──────────────────────────────────────────

describe('computeEffectiveSeedFromBeacon', () => {
  const chainSeed = '0000000000000000000000000000000000000000000000000000000000000001';
  const randomness = '0000000000000000000000000000000000000000000000000000000000000002';
  const beacon = { round: 1, randomness, signature: '' };

  it('returns a 64-char hex string', async () => {
    const result = await computeEffectiveSeedFromBeacon(chainSeed, beacon);
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for same inputs', async () => {
    const result1 = await computeEffectiveSeedFromBeacon(chainSeed, beacon);
    const result2 = await computeEffectiveSeedFromBeacon(chainSeed, beacon);
    expect(result1).toBe(result2);
  });

  it('cross-module consistency: returns deterministic 64-char hex for known inputs', async () => {
    const result = await computeEffectiveSeedFromBeacon(chainSeed, {
      round: 1,
      randomness: '0000000000000000000000000000000000000000000000000000000000000002',
      signature: '',
    });
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
    // Verify determinism by calling again
    const result2 = await computeEffectiveSeedFromBeacon(chainSeed, {
      round: 1,
      randomness: '0000000000000000000000000000000000000000000000000000000000000002',
      signature: '',
    });
    expect(result).toBe(result2);
  });

  it('key ordering: swapping key and data gives a different result', async () => {
    // Normal: key=randomness, data=chainSeed
    const normal = await computeEffectiveSeedFromBeacon(chainSeed, beacon);

    // Swapped: key=chainSeed (as raw bytes), data=randomness — raw crypto.subtle call
    function hexToBytes(hex: string): Uint8Array {
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
      }
      return bytes;
    }
    function bytesToHex(bytes: Uint8Array): string {
      return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }

    const keyBytes = hexToBytes(chainSeed);
    const dataBytes = hexToBytes(randomness);
    const key = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, dataBytes);
    const swapped = bytesToHex(new Uint8Array(sig));

    expect(normal).not.toBe(swapped);
  });
});
