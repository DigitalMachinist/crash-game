/**
 * WebSocket message dispatcher. Handles all `ServerMessage` types received
 * from the server and updates Svelte stores:
 * - `gameState`, `players`, `history`, `displayMultiplier` — game state stores
 * - `lastCrashResult`   → set when phase transitions to CRASHED; consumed by App.svelte
 * - `lastPendingPayout` → set on reconnect payout delivery; consumed by App.svelte
 * - `lastError`         → set on server validation errors; consumed by BetForm.svelte
 *
 * All phase transitions — including RUNNING→CRASHED — use `state` messages.
 * When a `state{phase:'CRASHED'}` arrives the handler freezes the multiplier
 * display and sets `lastCrashResult`, covering both fresh crashes and
 * reconnects during the CRASHED display window.
 *
 * @see docs/websocket-protocol.md §4.3
 * @see docs/project-architecture.md §1.3
 */
import { get } from 'svelte/store';
import type { PlayerSnapshot, ServerMessage } from '../../types';
import { applyBet, getBalance } from './balance';
import {
  balance,
  displayMultiplier,
  gameState,
  history,
  lastCrashResult,
  lastError,
  lastPendingPayout,
  multiplierAnimating,
  myPlayerId,
  players,
} from './stores';

export function handleMessage(msg: ServerMessage): void {
  switch (msg.type) {
    case 'state': {
      const { type: _type, ...snapshot } = msg as ServerMessage & { type: 'state' };
      gameState.set(snapshot);
      const record: Record<string, PlayerSnapshot> = {};
      for (const p of snapshot.players) {
        record[p.playerId] = p;
      }
      players.set(record);
      if (snapshot.history) {
        history.set(snapshot.history);
      }
      // CRASHED state: freeze the multiplier display and notify App for accounting.
      // Fires for both fresh crashes and reconnects during the CRASHED display window;
      // App.svelte's hasPendingResult guard prevents double-application in both cases.
      if (snapshot.phase === 'CRASHED' && snapshot.crashPoint !== null) {
        multiplierAnimating.set(false);
        displayMultiplier.set(snapshot.crashPoint);
        lastCrashResult.set(snapshot);
      }
      break;
    }
    case 'tick': {
      multiplierAnimating.set(true);
      displayMultiplier.set(msg.multiplier);
      break;
    }
    case 'playerJoined': {
      players.update((p) => ({
        ...p,
        [msg.playerId]: {
          id: msg.id,
          playerId: msg.playerId,
          name: msg.name,
          wager: msg.wager,
          cashedOut: false,
          cashoutMultiplier: null,
          payout: null,
          autoCashout: msg.autoCashout,
        },
      }));
      // Deduct balance only when server confirms our own join
      if (msg.playerId === get(myPlayerId)) {
        applyBet(msg.wager);
        balance.set(getBalance());
      }
      break;
    }
    case 'playerCashedOut': {
      players.update((p) => {
        const player = p[msg.playerId];
        if (!player) return p;
        return {
          ...p,
          [msg.playerId]: {
            ...player,
            cashedOut: true,
            cashoutMultiplier: msg.multiplier,
            payout: msg.payout,
          },
        };
      });
      break;
    }
    case 'pendingPayout': {
      lastPendingPayout.set(msg);
      break;
    }
    case 'error': {
      lastError.set(msg.message);
      break;
    }
    default:
      break;
  }
}
