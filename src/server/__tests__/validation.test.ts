import { describe, expect, it } from 'vitest';
import { isValidClientMessage, isValidDrandBeacon, isValidStoredGameData } from '../validation';

// ─── isValidClientMessage ───────────────────────────────────────────────────

describe('isValidClientMessage', () => {
  it('accepts valid join message', () => {
    expect(
      isValidClientMessage({
        type: 'join',
        playerId: 'abc-123',
        wager: 100,
        name: 'Alice',
        autoCashout: 2.5,
      }),
    ).toBe(true);
  });

  it('accepts join with minimal fields (no name, no autoCashout)', () => {
    expect(
      isValidClientMessage({
        type: 'join',
        playerId: 'abc-123',
        wager: 50,
      }),
    ).toBe(true);
  });

  it('accepts join with autoCashout: null', () => {
    expect(
      isValidClientMessage({
        type: 'join',
        playerId: 'abc-123',
        wager: 50,
        autoCashout: null,
      }),
    ).toBe(true);
  });

  it('accepts valid cashout message', () => {
    expect(isValidClientMessage({ type: 'cashout' })).toBe(true);
  });

  it('rejects null', () => {
    expect(isValidClientMessage(null)).toBe(false);
  });

  it('rejects non-object', () => {
    expect(isValidClientMessage('hello')).toBe(false);
    expect(isValidClientMessage(42)).toBe(false);
    expect(isValidClientMessage(undefined)).toBe(false);
  });

  it('rejects object with no type field', () => {
    expect(isValidClientMessage({ playerId: 'abc', wager: 100 })).toBe(false);
  });

  it('rejects object with non-string type', () => {
    expect(isValidClientMessage({ type: 42 })).toBe(false);
  });

  it('rejects unknown message type', () => {
    expect(isValidClientMessage({ type: 'unknown' })).toBe(false);
    expect(isValidClientMessage({ type: 'hack' })).toBe(false);
  });

  it('rejects join with missing playerId', () => {
    expect(isValidClientMessage({ type: 'join', wager: 100 })).toBe(false);
  });

  it('rejects join with non-string playerId', () => {
    expect(isValidClientMessage({ type: 'join', playerId: 123, wager: 100 })).toBe(false);
  });

  it('rejects join with missing wager', () => {
    expect(isValidClientMessage({ type: 'join', playerId: 'abc' })).toBe(false);
  });

  it('rejects join with non-number wager', () => {
    expect(isValidClientMessage({ type: 'join', playerId: 'abc', wager: 'abc' })).toBe(false);
  });

  it('rejects join with non-string name', () => {
    expect(isValidClientMessage({ type: 'join', playerId: 'abc', wager: 100, name: 123 })).toBe(
      false,
    );
  });

  it('rejects join with non-number autoCashout (string)', () => {
    expect(
      isValidClientMessage({
        type: 'join',
        playerId: 'abc',
        wager: 100,
        autoCashout: 'high',
      }),
    ).toBe(false);
  });
});

// ─── isValidDrandBeacon ─────────────────────────────────────────────────────

describe('isValidDrandBeacon', () => {
  const validBeacon = {
    round: 100,
    randomness: 'a'.repeat(64),
    signature: 'b'.repeat(96),
  };

  it('accepts valid beacon', () => {
    expect(isValidDrandBeacon(validBeacon)).toBe(true);
  });

  it('rejects null', () => {
    expect(isValidDrandBeacon(null)).toBe(false);
  });

  it('rejects non-object', () => {
    expect(isValidDrandBeacon('string')).toBe(false);
  });

  it('rejects beacon with missing round', () => {
    expect(isValidDrandBeacon({ randomness: 'a'.repeat(64), signature: 'b'.repeat(96) })).toBe(
      false,
    );
  });

  it('rejects beacon with non-number round', () => {
    expect(
      isValidDrandBeacon({ round: 'abc', randomness: 'a'.repeat(64), signature: 'b'.repeat(96) }),
    ).toBe(false);
  });

  it('rejects beacon with NaN round', () => {
    expect(
      isValidDrandBeacon({ round: NaN, randomness: 'a'.repeat(64), signature: 'b'.repeat(96) }),
    ).toBe(false);
  });

  it('rejects beacon with missing randomness', () => {
    expect(isValidDrandBeacon({ round: 100, signature: 'b'.repeat(96) })).toBe(false);
  });

  it('rejects beacon with non-hex randomness', () => {
    expect(
      isValidDrandBeacon({ round: 100, randomness: 'xyz!@#', signature: 'b'.repeat(96) }),
    ).toBe(false);
  });

  it('rejects beacon with missing signature', () => {
    expect(isValidDrandBeacon({ round: 100, randomness: 'a'.repeat(64) })).toBe(false);
  });

  it('rejects beacon with non-string signature', () => {
    expect(isValidDrandBeacon({ round: 100, randomness: 'a'.repeat(64), signature: 123 })).toBe(
      false,
    );
  });
});

// ─── isValidStoredGameData ──────────────────────────────────────────────────

describe('isValidStoredGameData', () => {
  const validStored = {
    rootSeed: 'a'.repeat(64),
    gameNumber: 5,
    chainCommitment: 'b'.repeat(64),
    history: [],
    pendingPayouts: [],
  };

  it('accepts valid stored data', () => {
    expect(isValidStoredGameData(validStored)).toBe(true);
  });

  it('accepts stored data with non-empty history and pendingPayouts', () => {
    expect(
      isValidStoredGameData({
        ...validStored,
        history: [
          {
            roundId: 1,
            crashPoint: 2.5,
            roundSeed: 'seed',
            drandRound: 1,
            drandRandomness: 'rand',
            chainCommitment: 'commit',
          },
        ],
        pendingPayouts: [
          [
            'player1',
            { roundId: 1, wager: 100, payout: 200, cashoutMultiplier: 2.0, crashPoint: 3.0 },
          ],
        ],
      }),
    ).toBe(true);
  });

  it('rejects null', () => {
    expect(isValidStoredGameData(null)).toBe(false);
  });

  it('rejects non-object', () => {
    expect(isValidStoredGameData('string')).toBe(false);
  });

  it('rejects missing rootSeed', () => {
    const { rootSeed: _, ...rest } = validStored;
    expect(isValidStoredGameData(rest)).toBe(false);
  });

  it('rejects rootSeed with wrong length', () => {
    expect(isValidStoredGameData({ ...validStored, rootSeed: 'abc' })).toBe(false);
  });

  it('rejects rootSeed with non-hex characters', () => {
    expect(isValidStoredGameData({ ...validStored, rootSeed: 'z'.repeat(64) })).toBe(false);
  });

  it('rejects negative gameNumber', () => {
    expect(isValidStoredGameData({ ...validStored, gameNumber: -1 })).toBe(false);
  });

  it('rejects non-integer gameNumber', () => {
    expect(isValidStoredGameData({ ...validStored, gameNumber: 1.5 })).toBe(false);
  });

  it('rejects NaN gameNumber', () => {
    expect(isValidStoredGameData({ ...validStored, gameNumber: NaN })).toBe(false);
  });

  it('rejects chainCommitment with wrong length', () => {
    expect(isValidStoredGameData({ ...validStored, chainCommitment: 'short' })).toBe(false);
  });

  it('rejects non-array history', () => {
    expect(isValidStoredGameData({ ...validStored, history: 'not-array' })).toBe(false);
  });

  it('rejects non-array pendingPayouts', () => {
    expect(isValidStoredGameData({ ...validStored, pendingPayouts: 'not-array' })).toBe(false);
  });

  it('accepts gameNumber of 0', () => {
    expect(isValidStoredGameData({ ...validStored, gameNumber: 0 })).toBe(true);
  });

  it('accepts absent pendingPayouts (undefined)', () => {
    const { pendingPayouts: _, ...rest } = validStored;
    expect(isValidStoredGameData(rest)).toBe(true);
  });
});
