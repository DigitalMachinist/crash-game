import type { GameStateSnapshot, PlayerSnapshot } from '../../types';

export function makeGameState(overrides: Partial<GameStateSnapshot> = {}): GameStateSnapshot {
  return {
    phase: 'WAITING',
    roundId: 1,
    countdown: 5000,
    multiplier: 1.0,
    elapsed: 0,
    crashPoint: null,
    players: [],
    chainCommitment: 'abc',
    drandRound: null,
    drandRandomness: null,
    history: [],
    ...overrides,
  };
}

export function makePlayer(overrides: Partial<PlayerSnapshot> = {}): PlayerSnapshot {
  return {
    id: 'conn-1',
    playerId: 'player-1',
    name: 'Alice',
    wager: 100,
    payout: null,
    cashedOut: false,
    cashoutMultiplier: null,
    autoCashout: null,
    ...overrides,
  };
}
