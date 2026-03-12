/**
 * WebSocket connection management via `partysocket` (auto-reconnect).
 *
 * Connects to room `crash-main`, party `crash-game`. Updates `connectionStatus`
 * store: `'connecting'` → `'connected'` on open, `'reconnecting'` on close.
 * All incoming messages are forwarded to `handleMessage()`.
 *
 * @see docs/websocket-protocol.md §4.1
 */
import PartySocket from 'partysocket';
import type { ServerMessage } from '../../types';
import { handleMessage } from './messageHandler';
import { connectionStatus, multiplierAnimating } from './stores';

let socket: PartySocket | null = null;

export function connect(): void {
  connectionStatus.set('connecting');
  socket = new PartySocket({
    host: typeof window !== 'undefined' ? window.location.host : 'localhost:8787',
    room: 'crash-main',
    party: 'crash-game',
  });

  socket.addEventListener('open', () => {
    connectionStatus.set('connected');
  });

  socket.addEventListener('close', () => {
    connectionStatus.set('reconnecting');
    multiplierAnimating.set(false);
  });

  socket.addEventListener('message', (e: MessageEvent) => {
    try {
      const msg = JSON.parse(e.data as string) as ServerMessage;
      handleMessage(msg);
    } catch {
      // Ignore malformed messages
    }
  });
}

export function disconnect(): void {
  socket?.close();
  socket = null;
  connectionStatus.set('disconnected');
}

export function getRawSocket(): PartySocket | null {
  return socket;
}
