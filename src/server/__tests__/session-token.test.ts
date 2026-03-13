import { describe, expect, it } from 'vitest';
import { generateSessionToken, verifySessionToken } from '../session-token';

describe('generateSessionToken', () => {
  it('returns a 64-character hex string (SHA-256 = 32 bytes)', async () => {
    const token = await generateSessionToken('rootseed', 'player1', 1);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic — same inputs produce the same token', async () => {
    const t1 = await generateSessionToken('rootseed', 'player1', 1);
    const t2 = await generateSessionToken('rootseed', 'player1', 1);
    expect(t1).toBe(t2);
  });

  it('produces different token for different playerId', async () => {
    const t1 = await generateSessionToken('rootseed', 'player1', 1);
    const t2 = await generateSessionToken('rootseed', 'player2', 1);
    expect(t1).not.toBe(t2);
  });

  it('produces different token for different roundId', async () => {
    const t1 = await generateSessionToken('rootseed', 'player1', 1);
    const t2 = await generateSessionToken('rootseed', 'player1', 2);
    expect(t1).not.toBe(t2);
  });

  it('produces different token for different rootSeed', async () => {
    const t1 = await generateSessionToken('seed-a', 'player1', 1);
    const t2 = await generateSessionToken('seed-b', 'player1', 1);
    expect(t1).not.toBe(t2);
  });
});

describe('verifySessionToken', () => {
  it('returns true for a correctly generated token', async () => {
    const token = await generateSessionToken('rootseed', 'player1', 1);
    expect(await verifySessionToken('rootseed', 'player1', 1, token)).toBe(true);
  });

  it('returns false for an incorrect token', async () => {
    expect(await verifySessionToken('rootseed', 'player1', 1, 'deadbeef')).toBe(false);
  });

  it('returns false for an empty string', async () => {
    expect(await verifySessionToken('rootseed', 'player1', 1, '')).toBe(false);
  });

  it('returns false for a token from a different round', async () => {
    const tokenRound1 = await generateSessionToken('rootseed', 'player1', 1);
    expect(await verifySessionToken('rootseed', 'player1', 2, tokenRound1)).toBe(false);
  });

  it('returns false for a token from a different playerId', async () => {
    const tokenP1 = await generateSessionToken('rootseed', 'player1', 1);
    expect(await verifySessionToken('rootseed', 'player2', 1, tokenP1)).toBe(false);
  });

  it('returns false for a token from a different rootSeed', async () => {
    const tokenSeedA = await generateSessionToken('seed-a', 'player1', 1);
    expect(await verifySessionToken('seed-b', 'player1', 1, tokenSeedA)).toBe(false);
  });
});
