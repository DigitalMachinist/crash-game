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
import { PING_INTERVAL_MS, ROOM_ID } from '../../config';
import type { ServerMessage } from '../../types';
import { dispatchMessage } from './message-handler';
import { connectionStatus, latency, multiplierAnimating } from './stores';

let socket: PartySocket | null = null;
let pingInterval: ReturnType<typeof setInterval> | null = null;

function clearPingInterval(): void {
  if (pingInterval !== null) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
}

/** Required field checks per server message variant. Each entry is [field, type]. */
type FieldType = 'string' | 'number' | 'array' | 'nullable-number' | 'nullable-string';
const MESSAGE_FIELDS: Record<ServerMessage['type'], [string, FieldType][]> = {
  state: [
    ['phase', 'string'],
    ['roundId', 'number'],
    ['countdown', 'number'],
    ['multiplier', 'number'],
    ['elapsed', 'number'],
    ['crashPoint', 'nullable-number'],
    ['players', 'array'],
    ['chainCommitment', 'string'],
    ['drandRound', 'nullable-number'],
    ['drandRandomness', 'nullable-string'],
    ['history', 'array'],
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
    ['autoCashout', 'nullable-number'],
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
  pong: [['t', 'number']],
  error: [['message', 'string']],
};

function isFieldOfType(msg: Record<string, unknown>, field: string, type: FieldType): boolean {
  if (type === 'array') return Array.isArray(msg[field]);
  if (type === 'nullable-number') return msg[field] === null || typeof msg[field] === 'number';
  if (type === 'nullable-string') return msg[field] === null || typeof msg[field] === 'string';
  return typeof msg[field] === type;
}

function isValidServerMessage(data: unknown): data is ServerMessage {
  if (typeof data !== 'object' || data === null) return false;
  const msg = data as Record<string, unknown>;
  const msgType = msg.type;
  if (typeof msgType !== 'string' || !(msgType in MESSAGE_FIELDS)) return false;
  const checks = MESSAGE_FIELDS[msgType as ServerMessage['type']];
  return checks.every(([field, type]) => isFieldOfType(msg, field, type));
}

function onOpen(): void {
  connectionStatus.set('connected');
  clearPingInterval();
  pingInterval = setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'ping', t: Date.now() }));
    }
  }, PING_INTERVAL_MS);
}

function onClose(): void {
  connectionStatus.set('reconnecting');
  multiplierAnimating.set(false);
  clearPingInterval();
  latency.set(null);
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
  clearPingInterval();
  latency.set(null);
  connectionStatus.set('disconnected');
}

export function getSocket(): PartySocket | null {
  return socket;
}
