/**
 * drand quicknet beacon fetching.
 *
 * drand provides independent, verifiable randomness that prevents the server
 * from choosing seeds to manipulate crash points. The drand beacon's randomness
 * is consumed by `computeEffectiveSeed` in `provably-fair.ts` as the HMAC key
 * (not data) — see §2.5 for why this ordering is security-critical.
 *
 * @see docs/provably-fair.md §2.3
 * @see docs/provably-fair.md §2.5
 */
import {
  DRAND_BASE_URL,
  DRAND_FETCH_TIMEOUT_MS,
  DRAND_GENESIS_TIME,
  DRAND_PERIOD_SECS,
} from '../config';
import type { DrandBeacon } from '../types';
import { isValidDrandBeacon } from './validation';

export class DrandFetchError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'DrandFetchError';
  }
}

/**
 * Computes the current drand quicknet round number from the wall clock.
 * Formula: `floor((nowSec − DRAND_GENESIS_TIME) / DRAND_PERIOD_SECS) + 1`
 *
 * @see docs/provably-fair.md §2.3
 */
export function getCurrentDrandRound(nowMs?: number): number {
  const nowSec = (nowMs ?? Date.now()) / 1000;
  return Math.floor((nowSec - DRAND_GENESIS_TIME) / DRAND_PERIOD_SECS) + 1;
}

/**
 * Fetches the drand beacon for a specific round number.
 * Tries the primary URL (`/public/{round}`) first; falls back to `/public/latest`.
 * Throws `DrandFetchError` if both attempts fail or if the response fails structure
 * validation (`isValidDrandBeacon`) — triggers a void round in `startRound()`.
 *
 * @see docs/provably-fair.md §2.3
 * @see docs/game-state-machine.md §3.2 (void rounds)
 */
export async function fetchDrandBeacon(
  round: number,
  timeoutMs: number = DRAND_FETCH_TIMEOUT_MS,
): Promise<DrandBeacon> {
  const primaryUrl = `${DRAND_BASE_URL}/public/${round}`;
  const fallbackUrl = `${DRAND_BASE_URL}/public/latest`;

  async function attemptFetch(url: string): Promise<DrandBeacon> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: unknown = await res.json();
      if (!isValidDrandBeacon(data)) {
        throw new Error('Invalid drand beacon structure');
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  try {
    return await attemptFetch(primaryUrl);
  } catch (primaryErr) {
    console.warn('[drand] primary fetch failed, trying fallback:', primaryErr);
    try {
      return await attemptFetch(fallbackUrl);
    } catch (fallbackErr) {
      throw new DrandFetchError(`Failed to fetch drand beacon for round ${round}`, {
        cause: new AggregateError(
          [primaryErr, fallbackErr],
          'Both primary and fallback drand fetches failed',
        ),
      });
    }
  }
}
