/**
 * HMAC-SHA256 session token utilities for playerId spoofing prevention. [Phase 3.3]
 *
 * Token = HMAC-SHA256(key=rootSeed, data=`${playerId}:${roundId}`) encoded as hex.
 * Issued to a player on successful join; required to claim a pending payout on reconnect.
 *
 * @see docs/plans/2026-03-12-post-mvp-hardening.md §Phase 3.3
 */

/**
 * Generates a deterministic HMAC-SHA256 token binding a playerId to a specific round.
 * Uses WebCrypto (`crypto.subtle`) which is available in CF Workers and Node 20+.
 */
export async function generateSessionToken(
  rootSeed: string,
  playerId: string,
  roundId: number,
): Promise<string> {
  const keyData = new TextEncoder().encode(rootSeed);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const data = new TextEncoder().encode(`${playerId}:${roundId}`);
  const sig = await crypto.subtle.sign('HMAC', key, data);
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verifies a session token against the expected HMAC for the given parameters.
 * Returns false for any mismatch, including empty tokens.
 */
export async function verifySessionToken(
  rootSeed: string,
  playerId: string,
  roundId: number,
  token: string,
): Promise<boolean> {
  if (!token) return false;
  const expected = await generateSessionToken(rootSeed, playerId, roundId);
  return expected === token;
}
