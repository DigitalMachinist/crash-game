/**
 * Client → server message helpers.
 *
 * `sendJoin` includes the stable `playerId` from the `myPlayerId` store.
 * `sendCashout` sends only `{ type: 'cashout' }` — player identification on
 * the server side is by connection ID (`conn.id`), not message payload.
 *
 * @see docs/websocket-protocol.md §4.2
 */
import { get } from 'svelte/store';
import type { ClientMessage } from '../../types';
import { getSocket } from './socket';
import { myPlayerId } from './stores';

function send(msg: ClientMessage): void {
  const socket = getSocket();
  if (!socket) return;
  socket.send(JSON.stringify(msg));
}

export function sendJoin(wager: number, autoCashout: number | null): void {
  send({
    type: 'join',
    playerId: get(myPlayerId),
    wager,
    autoCashout,
  });
}

export function sendSetName(name: string): void {
  send({
    type: 'setName',
    playerId: get(myPlayerId),
    name,
  });
}

export function sendCashout(): void {
  send({ type: 'cashout' });
}
