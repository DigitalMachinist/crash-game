/**
 * Shared hex↔Uint8Array, SHA-256, and HMAC-SHA-256 utilities for WebCrypto operations.
 * Used by both server (drand.ts, hash-chain.ts) and client (verify.ts) code.
 */

export function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const buf = new ArrayBuffer(hex.length / 2);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Computes SHA-256 of `input` (encoded as UTF-8) and returns a 64-char lowercase hex string. */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(hashBuffer));
}

/**
 * Computes `HMAC-SHA256(key = keyHex, data = dataHex)` and returns a 64-char lowercase hex string.
 * SECURITY: the key must be the uncontrollable external input (drand randomness) — see provably-fair.md §2.5.
 */
export async function hmacSha256Hex(keyHex: string, dataHex: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    hexToBytes(keyHex),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, hexToBytes(dataHex));
  return bytesToHex(new Uint8Array(signature));
}
