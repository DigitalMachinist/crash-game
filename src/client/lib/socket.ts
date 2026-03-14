/**
 * WebSocket connection management via `partysocket` (auto-reconnect).
 *
 * Connects to room `crash-main`, party `crash-game`. Updates `connectionStatus`
 * store: `'connecting'` → `'connected'` on open, `'reconnecting'` on close.
 * All incoming messages are forwarded to `dispatchMessage()`.
 *
 * `connect()` returns a cleanup function (identical to calling `disconnect()`)
 * for use in component `onDestroy()` hooks. Calling `connect()` while a socket
 * is already open closes the previous one first (singleton guard). [High-23]
 *
 * @see docs/websocket-protocol.md §4.1
 */
import PartySocket from 'partysocket';
import { ROOM_ID } from '../../config';
import type { ServerMessage } from '../../types';
import { dispatchMessage } from './message-handler';
import { connectionStatus, multiplierAnimating } from './stores';

let socket: PartySocket | null = null;

function onOpen(): void {
  connectionStatus.set('connected');
}

function onClose(): void {
  connectionStatus.set('reconnecting');
  multiplierAnimating.set(false);
}

function onMessage(e: MessageEvent): void {
  try {
    const parsed: unknown = JSON.parse(e.data as string);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>).type !== 'string'
    ) {
      console.warn('[socket] received structurally invalid message:', e.data);
      return;
    }
    dispatchMessage(parsed as ServerMessage);
  } catch (err) {
    console.warn('[socket] failed to parse server message:', e.data, err);
  }
}

export function connect(playerId?: string): () => void {
  // Singleton guard: close any existing socket before opening a new one [High-23]
  if (socket) {
    disconnect();
  }

  connectionStatus.set('connecting');
  socket = new PartySocket({
    host: typeof window !== 'undefined' ? window.location.host : 'localhost:8787',
    room: ROOM_ID,
    party: 'crash-game',
    ...(playerId ? { query: { playerId } } : {}),
  });

  socket.addEventListener('open', onOpen);
  socket.addEventListener('close', onClose);
  socket.addEventListener('message', onMessage);

  return disconnect;
}

export function disconnect(): void {
  if (socket) {
    socket.removeEventListener('open', onOpen);
    socket.removeEventListener('close', onClose);
    socket.removeEventListener('message', onMessage);
    socket.close();
    socket = null;
  }
  connectionStatus.set('disconnected');
}

export function getSocket(): PartySocket | null {
  return socket;
}
