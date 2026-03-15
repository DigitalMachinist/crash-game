import { describe, expect, it } from 'vitest';
import { bytesToHex, hexToBytes, hmacSha256Hex, sha256Hex } from '../../crypto-hex';

describe('hexToBytes / bytesToHex', () => {
  it('round-trips: bytesToHex(hexToBytes(hex)) === hex', () => {
    const vectors = [
      '0'.repeat(64), // all zeros
      'f'.repeat(64), // all 0xff
      '0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20',
      'deadbeefcafebabe' + '0'.repeat(48),
    ];
    for (const hex of vectors) {
      expect(bytesToHex(hexToBytes(hex))).toBe(hex);
    }
  });

  it('hexToBytes produces the correct byte length (hex.length / 2)', () => {
    expect(hexToBytes('0'.repeat(64)).length).toBe(32);
    expect(hexToBytes('ff'.repeat(16)).length).toBe(16);
  });

  it('bytesToHex produces lowercase 2-char-per-byte output', () => {
    const bytes = new Uint8Array([0, 1, 15, 16, 255]);
    expect(bytesToHex(bytes)).toBe('00010f10ff');
  });

  it('hexToBytes correctly decodes known byte values', () => {
    const bytes = hexToBytes('000180ff');
    expect(bytes[0]).toBe(0x00);
    expect(bytes[1]).toBe(0x01);
    expect(bytes[2]).toBe(0x80);
    expect(bytes[3]).toBe(0xff);
  });
});

describe('sha256Hex', () => {
  it('returns a 64-char lowercase hex string', async () => {
    const result = await sha256Hex('hello');
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('matches the known SHA-256 of empty string', async () => {
    // SHA-256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    expect(await sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('is deterministic for the same input', async () => {
    const a = await sha256Hex('test-input');
    const b = await sha256Hex('test-input');
    expect(a).toBe(b);
  });

  it('produces different outputs for different inputs', async () => {
    const a = await sha256Hex('input-a');
    const b = await sha256Hex('input-b');
    expect(a).not.toBe(b);
  });
});

describe('hmacSha256Hex', () => {
  it('returns a 64-char lowercase hex string', async () => {
    const key = '0'.repeat(64);
    const data = 'f'.repeat(64);
    const result = await hmacSha256Hex(key, data);
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for the same inputs', async () => {
    const key = 'a'.repeat(64);
    const data = 'b'.repeat(64);
    const r1 = await hmacSha256Hex(key, data);
    const r2 = await hmacSha256Hex(key, data);
    expect(r1).toBe(r2);
  });

  it('key ordering matters: HMAC(key=A, data=B) !== HMAC(key=B, data=A)', async () => {
    const a = '0'.repeat(64);
    const b = 'f'.repeat(64);
    const ab = await hmacSha256Hex(a, b);
    const ba = await hmacSha256Hex(b, a);
    expect(ab).not.toBe(ba);
  });
});
