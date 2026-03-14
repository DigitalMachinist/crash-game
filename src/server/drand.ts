/**
 * drand quicknet beacon fetching and effective seed computation.
 *
 * drand provides independent, verifiable randomness that prevents the server
 * from choosing seeds to manipulate crash points. The drand randomness value
 * is used as the HMAC key (not data) — see §2.5 for why this ordering is
 * security-critical.
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
import { bytesToHex, hexToBytes } from '../crypto-hex';
import type { DrandBeacon } from '../types';
import { isValidDrandBeacon } from './validation';

export class DrandFetchError extends Error {
  constructor(message: string) {
    super(message);
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
    } catch (e) {
      throw new DrandFetchError(`Failed to fetch drand beacon for round ${round}: ${e}`);
    }
  }
}

/**
 * Computes the effective seed by mixing the chain seed with the drand beacon.
 * Formula: `HMAC-SHA256(key = beacon.randomness, data = chainSeed)`
 *
 * SECURITY: drand randomness MUST be the HMAC key (not data). This prevents a
 * malicious server from choosing chain seeds to exploit predictable drand values.
 * See §2.5 for the full explanation.
 *
 * @see docs/provably-fair.md §2.5
 * @see docs/provably-fair.md §2.4
 */
export async function computeEffectiveSeedFromBeacon(
  chainSeed: string,
  beacon: DrandBeacon,
): Promise<string> {
  // drandRandomness is the KEY (critical: uncontrollable external input in privileged position)
  const keyBytes = hexToBytes(beacon.randomness);
  const dataBytes = hexToBytes(chainSeed);

  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, dataBytes);
  return bytesToHex(new Uint8Array(signature));
}
