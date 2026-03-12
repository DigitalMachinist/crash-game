/**
 * WebSocket message dispatcher. Handles all `ServerMessage` types received
 * from the server, performing a dual dispatch:
 * 1. Updates Svelte stores (`gameState`, `players`, `history`, `displayMultiplier`).
 * 2. Dispatches DOM `CustomEvent`s as a decoupled event bus:
 *    - `crash:crashed`      → consumed by `App.svelte` (round result accounting);
 *                             detail is the `GameStateSnapshot` with phase='CRASHED'
 *    - `crash:pendingPayout`→ consumed by `App.svelte` (reconnect payout delivery)
 *    - `crash:error`        → consumed by `BetForm.svelte` (server validation errors)
 *
 * All phase transitions — including RUNNING→CRASHED — use `state` messages.
 * When a `state{phase:'CRASHED'}` arrives the handler freezes the multiplier
 * display and dispatches `crash:crashed`, covering both fresh crashes and
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
        document.dispatchEvent(new CustomEvent('crash:crashed', { detail: snapshot }));
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
        const entry = Object.entries(p).find(([, player]) => player.id === msg.id);
        if (!entry) return p;
        const [playerId, player] = entry;
        return {
          ...p,
          [playerId]: {
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
      document.dispatchEvent(new CustomEvent('crash:pendingPayout', { detail: msg }));
      break;
    }
    case 'error': {
      document.dispatchEvent(new CustomEvent('crash:error', { detail: { message: msg.message } }));
      break;
    }
    default:
      break;
  }
}
