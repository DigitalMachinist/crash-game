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

/** Required field checks per server message variant. Each entry is [field, 'string'|'number'|'array']. */
type FieldType = 'string' | 'number' | 'array';
const MESSAGE_FIELDS: Record<string, [string, FieldType][]> = {
  state: [
    ['phase', 'string'],
    ['roundId', 'number'],
    ['players', 'array'],
  ],
  tick: [
    ['multiplier', 'number'],
    ['elapsed', 'number'],
  ],
  playerJoined: [
    ['id', 'string'],
    ['playerId', 'string'],
    ['name', 'string'],
    ['wager', 'number'],
  ],
  playerCashedOut: [
    ['id', 'string'],
    ['playerId', 'string'],
    ['multiplier', 'number'],
    ['payout', 'number'],
  ],
  pendingPayout: [
    ['roundId', 'number'],
    ['wager', 'number'],
    ['payout', 'number'],
    ['cashoutMultiplier', 'number'],
    ['crashPoint', 'number'],
  ],
  error: [['message', 'string']],
};

function checkField(msg: Record<string, unknown>, field: string, type: FieldType): boolean {
  return type === 'array' ? Array.isArray(msg[field]) : typeof msg[field] === type;
}

function isValidServerMessage(data: unknown): data is ServerMessage {
  if (typeof data !== 'object' || data === null) return false;
  const msg = data as Record<string, unknown>;
  const checks = MESSAGE_FIELDS[msg.type as string];
  return checks !== undefined && checks.every(([field, type]) => checkField(msg, field, type));
}

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
    if (!isValidServerMessage(parsed)) {
      console.warn('[socket] received structurally invalid message:', e.data);
      return;
    }
    dispatchMessage(parsed);
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
