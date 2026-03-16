# Connection Latency Display

**Date**: 2026-03-16
**Status**: Draft

## 1. Overview

Display the user's WebSocket round-trip latency (in milliseconds) alongside the existing connection status indicator. When connected, the indicator will show something like `Connected · 42ms` instead of just `Connected`.

## 2. Motivation

Players benefit from knowing their connection quality, especially in a real-time game where cashout timing matters. A visible latency indicator helps players understand whether slow reactions are due to network conditions or game mechanics.

## 3. Design

### 3.1 Protocol: Ping/Pong Messages

Add two new message types to the WebSocket protocol:

**Client → Server** (`ClientMessage`):
```typescript
{ type: 'ping'; t: number }  // t = client's Date.now() at send time
```

**Server → Client** (`ServerMessage`):
```typescript
{ type: 'pong'; t: number }  // t = echoed from the client's ping
```

The server simply echoes `t` back — no server-side timestamp needed. The client computes RTT as `Date.now() - t`.

### 3.2 Ping Interval

- The client sends a `ping` every **5 seconds** while connected.
- The ping timer starts on WebSocket `open` and stops on `close`/`disconnect`.
- A configurable constant `PING_INTERVAL_MS = 5_000` is added to `src/config.ts`.

### 3.3 Latency Store

A new Svelte writable store `latency` (type `number | null`) in `stores.ts`:
- `null` when disconnected or no pong received yet.
- Set to the most recent RTT value on each pong.
- Reset to `null` on disconnect/reconnecting.

### 3.4 Server Handler

In `crash-game.ts`, the `onMessage` handler recognizes `type: 'ping'` and responds with `{ type: 'pong', t: msg.t }` directly to the sending connection. No broadcast, no state mutation, no persistence.

### 3.5 Client Validation

- The existing `MESSAGE_FIELDS` validation map in `socket.ts` is extended with a `pong` entry: `[['t', 'number']]`.
- The `message-handler.ts` dispatcher handles `pong` by updating the `latency` store.

### 3.6 UI Changes

`ConnectionStatus.svelte` is augmented to show the latency when connected:

- When `connectionStatus === 'connected'` and `latency !== null`: show `Connected · {latency}ms`
- Color-code the latency text:
  - Green (`#00c853`): < 100ms
  - Gold (`gold`): 100–249ms
  - Crimson (`crimson`): >= 250ms
- When not connected or latency is null: show only the status label (current behavior).

### 3.7 Ping Lifecycle in socket.ts

The ping interval is managed inside `socket.ts`:
- On `open`: start a `setInterval` that sends `{ type: 'ping', t: Date.now() }`.
- On `close`: clear the interval and reset the `latency` store to `null`.
- On `disconnect()`: clear the interval.
- The interval ID is stored in module-level state alongside `socket`.

## 4. Files Changed

| File | Change |
|------|--------|
| `src/config.ts` | Add `PING_INTERVAL_MS` constant |
| `src/types.ts` | Add `ping` to `ClientMessage`, `pong` to `ServerMessage` |
| `src/client/lib/stores.ts` | Add `latency` writable store |
| `src/client/lib/socket.ts` | Ping interval lifecycle, `pong` validation entry |
| `src/client/lib/message-handler.ts` | Handle `pong` messages |
| `src/client/components/ConnectionStatus.svelte` | Display latency |
| `src/server/crash-game.ts` | Echo `ping` → `pong` in `onMessage` |
| `src/server/validation.ts` | Add `ping` to `isValidClientMessage` |

## 5. Non-Goals

- Latency smoothing/averaging (EWMA) — not needed for a simple display. Show the most recent RTT.
- Server-initiated pings — the client drives the cadence.
- Latency history or graphs — out of scope.
- Using latency data for gameplay decisions (e.g., adjusting cashout timing) — out of scope.

## 6. Edge Cases

- **Rapid reconnects**: PartySocket auto-reconnects; the `open` handler restarts the ping interval cleanly.
- **Stale pong after reconnect**: Since pong echoes the client's timestamp, a stale pong from a previous connection will compute a very large RTT. This self-corrects on the next ping cycle. Acceptable for v1.
- **Server processing delay**: The server echoes pong synchronously (no `await`), so server processing time is negligible.
