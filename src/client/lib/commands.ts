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
import { getRawSocket } from './socket';
import { myPlayerId, sessionToken } from './stores';

function send(msg: ClientMessage): void {
  const socket = getRawSocket();
  if (!socket) return;
  socket.send(JSON.stringify(msg));
}

export function sendJoin(wager: number, name: string, autoCashout: number | null): void {
  const token = get(sessionToken);
  send({
    type: 'join',
    playerId: get(myPlayerId),
    wager,
    name,
    autoCashout,
    ...(token !== null ? { sessionToken: token } : {}),
  });
}

export function sendCashout(): void {
  send({ type: 'cashout' });
}
