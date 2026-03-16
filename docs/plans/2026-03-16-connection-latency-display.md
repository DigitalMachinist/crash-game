# Implementation Plan: Connection Latency Display

**Date**: 2026-03-16
**Spec**: `docs/specs/2026-03-16-connection-latency-display.md`

## Approach

TDD bottom-up: types → config → server validation → server handler → client store → client message handler → client socket ping lifecycle → UI component. Each step has tests written before implementation.

## Critical Path

The implementation is mostly serial — types must exist before validation, validation before handler, etc. However, server-side and client-side work can be parallelized once types are in place.

```
Step 1: Types (shared)
  ├── Step 2: Config (shared)
  ├── Step 3: Server validation + tests
  │   └── Step 4: Server handler + tests
  ├── Step 5: Client store
  │   └── Step 6: Client message handler + tests
  │       └── Step 7: Client socket ping lifecycle
  └── Step 8: UI component + tests
Step 9: Integration verification & review passes
```

## Steps

### Step 1: Add message types to `src/types.ts`

Add `ping` to `ClientMessage` union:
```typescript
| { type: 'ping'; t: number }
```

Add `pong` to `ServerMessage` union:
```typescript
| { type: 'pong'; t: number }
```

**Tests**: None — type-only change, verified by typecheck.

### Step 2: Add `PING_INTERVAL_MS` to `src/config.ts`

```typescript
export const PING_INTERVAL_MS = 5_000;
```

Add under the `Client` section.

**Tests**: None — constant-only change.

### Step 3: Server validation — `src/server/validation.ts`

Update `isValidClientMessage` to accept `{ type: 'ping', t: number }`.

**Tests** (in existing validation test file):
- `ping` with valid `t` (number) → accepted
- `ping` with missing `t` → rejected
- `ping` with `t` as string → rejected

### Step 4: Server handler — `src/server/crash-game.ts`

In `onMessage`, add a handler for `msg.type === 'ping'` that sends `{ type: 'pong', t: msg.t }` back to `conn`. Place it early (before `setName`) since it's the most latency-sensitive message type — no `await`, no state mutation.

**Tests** (in existing server test file):
- Sending `ping` with `t: 12345` returns `pong` with `t: 12345` to the sender only
- `ping` does not broadcast to other connections

### Step 5: Add `latency` store — `src/client/lib/stores.ts`

```typescript
export const latency = writable<number | null>(null);
```

**Tests**: None — trivial writable declaration.

### Step 6: Client message handler — `src/client/lib/message-handler.ts`

Add case for `type: 'pong'`: compute `Date.now() - msg.t` and set `latency` store.

Also add `pong` to the `MESSAGE_FIELDS` validation map in `socket.ts`:
```typescript
pong: [['t', 'number']],
```

**Tests** (message handler tests):
- Dispatching a `pong` message sets the `latency` store to `Date.now() - msg.t`

### Step 7: Client socket ping lifecycle — `src/client/lib/socket.ts`

- Module-level `let pingInterval: ReturnType<typeof setInterval> | null = null`
- `onOpen()`: start interval that sends `{ type: 'ping', t: Date.now() }` via `socket.send()`
- `onClose()`: clear interval, set `latency` store to `null`
- `disconnect()`: clear interval
- Helper `clearPingInterval()` to DRY the cleanup

**Tests**: Difficult to unit test interval logic in isolation without mocking timers. Covered by integration verification in Step 9.

### Step 8: UI component — `src/client/components/ConnectionStatus.svelte`

- Import `latency` store
- When connected and latency is not null, append ` · {latency}ms` after the label
- Color-code the latency value:
  - `#00c853` (green): < 100ms
  - `gold`: 100–249ms
  - `crimson`: >= 250ms
- Latency text uses a `<span>` with inline `color` style

**Tests** (component tests):
- Renders "Connected" without latency when `latency` is null
- Renders "Connected · 42ms" in green when latency is 42
- Renders latency in gold when latency is 150
- Renders latency in crimson when latency is 300

### Step 9: Integration verification & review passes

1. Run `npm run typecheck` and `npm run typecheck:server`
2. Run `npm run test` and `npm run test:workers`
3. Run `npm run lint` and `npm run format`
4. Manual smoke test: `npm run dev:server` + `npm run dev:client`, verify latency appears in UI
5. Code review pass: check for missed edge cases, style consistency

## Agent Swarm Plan

Steps 1–2 must be done first (shared types/config). Then:
- **Agent A** (server): Steps 3–4 (validation + handler + tests)
- **Agent B** (client): Steps 5–8 (store + message handler + socket + UI + tests)

Agent B depends on Agent A only for conflict-free merge — they work on different files.

Step 9 runs after both agents complete, on the main conversation.
