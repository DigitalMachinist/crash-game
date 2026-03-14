/**
 * WebSocket connection management via `partysocket` (auto-reconnect).
 *
 * Connects to room `crash-main`, party `crash-game`. Updates `connectionStatus`
 * store: `'connecting'` → `'connected'` on open, `'reconnecting'` on close.
 * All incoming messages are forwarded to `handleMessage()`.
 *
 * `connect()` returns a cleanup function (identical to calling `disconnect()`)
 * for use in component `onDestroy()` hooks. Calling `connect()` while a socket
 * is already open closes the previous one first (singleton guard). [High-23]
 *
 * @see docs/websocket-protocol.md §4.1
 */
import PartySocket from 'partysocket';
import type { ServerMessage } from '../../types';
import { handleMessage } from './messageHandler';
import { connectionStatus, multiplierAnimating } from './stores';

let socket: PartySocket | null = null;
let openHandler: (() => void) | null = null;
let closeHandler: (() => void) | null = null;
let messageHandler: ((e: MessageEvent) => void) | null = null;

export function connect(playerId?: string): () => void {
  // Singleton guard: close any existing socket before opening a new one [High-23]
  if (socket) {
    disconnect();
  }

  connectionStatus.set('connecting');
  socket = new PartySocket({
    host: typeof window !== 'undefined' ? window.location.host : 'localhost:8787',
    room: 'crash-main',
    party: 'crash-game',
    ...(playerId ? { query: { playerId } } : {}),
  });

  openHandler = () => {
    connectionStatus.set('connected');
  };

  closeHandler = () => {
    connectionStatus.set('reconnecting');
    multiplierAnimating.set(false);
  };

  messageHandler = (e: MessageEvent) => {
    try {
      const msg = JSON.parse(e.data as string) as ServerMessage;
      handleMessage(msg);
    } catch {
      // Ignore malformed messages
    }
  };

  socket.addEventListener('open', openHandler);
  socket.addEventListener('close', closeHandler);
  socket.addEventListener('message', messageHandler);

  return disconnect;
}

export function disconnect(): void {
  if (socket) {
    if (openHandler) socket.removeEventListener('open', openHandler);
    if (closeHandler) socket.removeEventListener('close', closeHandler);
    if (messageHandler) socket.removeEventListener('message', messageHandler);
    openHandler = null;
    closeHandler = null;
    messageHandler = null;
    socket.close();
    socket = null;
  }
  connectionStatus.set('disconnected');
}

export function getRawSocket(): PartySocket | null {
  return socket;
}
