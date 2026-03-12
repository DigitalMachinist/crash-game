# Crash Game MVP — Full Specification

**Date:** 2026-03-11
**Status:** Draft — awaiting approval

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Game State Machine](#3-game-state-machine)
4. [Crash Point Determination](#4-crash-point-determination)
5. [Provably Fair System](#5-provably-fair-system)
6. [WebSocket Protocol](#6-websocket-protocol)
7. [Server Implementation](#7-server-implementation)
8. [Client Implementation](#8-client-implementation)
9. [Auto-Cashout](#9-auto-cashout)
10. [Player Balance](#10-player-balance)
11. [Verification Page](#11-verification-page)
12. [Project Structure](#12-project-structure)
13. [Deployment](#13-deployment)
14. [Decision Log](#14-decision-log)

---

## 1. Overview

A multiplayer Crash gambling game deployed on Cloudflare Workers via PartyKit (`partyserver`). Players wager to join a round during a waiting phase, then watch a multiplier rise during the playing phase. They must cash out before the multiplier "crashes" at a random point, or lose their wager.

### Core Experience

1. A 10-second countdown invites players to place bets
2. Bets lock — a brief "starting" moment while the crash point is determined
3. The round begins — a multiplier climbs from 1.00x upward
4. Players smash a cashout button (or rely on auto-cashout) before the crash
5. The crash point is revealed, results are displayed for 5 seconds
6. Repeat

### Key Properties

- Provably fair: crash points are pre-committed via hash chain + drand randomness beacon
- Real-time: multiplier broadcasts at ~10Hz, client interpolates to 60fps
- Serverless: runs entirely on Cloudflare Workers / Durable Objects
- Simple: client balances in localStorage, no accounts, no authentication

---

## 2. Architecture

### Technology Stack

| Component | Technology |
|---|---|
| Server runtime | Cloudflare Workers (Durable Objects) |
| Server framework | `partyserver` (standalone PartyKit for Workers) |
| Game loop | Durable Object alarm API |
| Randomness beacon | drand quicknet via Cloudflare relay |
| Frontend framework | Svelte (with Vite, no SvelteKit) |
| Frontend transport | Native WebSocket (via `partysocket` for auto-reconnect) |
| Static hosting | Cloudflare Workers static assets |
| Build tool | Vite |

### System Diagram

```
┌─────────────┐     WebSocket      ┌──────────────────────┐
│  Svelte UI  │◄──────────────────►│  CrashGame Server    │
│  (browser)  │                    │  (Durable Object)    │
└─────────────┘                    │                      │
                                   │  - Game state machine│
                                   │  - Hash chain        │
                                   │  - Player management │
                                   │  - Alarm-based ticks │
                                   └──────────┬───────────┘
                                              │ fetch()
                                              ▼
                                   ┌──────────────────────┐
                                   │  drand quicknet      │
                                   │  (Cloudflare relay)  │
                                   └──────────────────────┘
```

### Single Room Model

For MVP, all players connect to a single room (room ID: `"crash-main"`). The Durable Object for this room manages the entire game. This supports up to ~32,000 concurrent connections with hibernation enabled, which is more than sufficient for MVP.

---

## 3. Game State Machine

### Phases

```
WAITING (10s) ──► STARTING (~0-3s) ──► RUNNING (variable) ──► CRASHED (5s) ──► WAITING
```

| Phase | Duration | Player Actions | Server Behavior |
|---|---|---|---|
| `WAITING` | 10 seconds (countdown) | Place bets (join with wager), set auto-cashout | Accept bet messages, broadcast countdown ticks |
| `STARTING` | ~0-3 seconds (typically <1s) | None (bets locked, observe) | Fetch drand beacon, compute crash point, broadcast phase change |
| `RUNNING` | Until crash point reached | Cash out (manual or auto) | Broadcast multiplier ticks, process cashouts |
| `CRASHED` | 5 seconds | None (view results) | Broadcast crash result + round seed, display player outcomes |

### Phase Transitions

**WAITING → STARTING:**
- Triggered when the 10-second countdown expires
- Bets are locked — no new `join` messages accepted
- Server identifies the target drand quicknet round and begins fetching the beacon
- Client displays a brief "Round starting..." state

**STARTING → RUNNING:**
- Triggered when the drand beacon is received
- Server computes `effective_seed = HMAC-SHA256(key=drand_randomness, data=chain_seed)`
- Server derives the crash point from the effective seed
- Server records `roundStartTime = Date.now()`
- Server computes `crashTimeMs = Math.log(crashPoint) / GROWTH_RATE` and schedules the crash alarm
- The crash point now exists in server memory — but bets were already locked in WAITING, so it cannot influence wagering decisions
- If no players joined, the round still runs (crash point is still determined and revealed for chain integrity)

**RUNNING → CRASHED:**
- Triggered when `multiplier(elapsed) >= crashPoint`
- All players who haven't cashed out lose their wagers
- Server reveals the chain seed for this round
- Auto-cashout orders that haven't triggered are voided

**CRASHED → WAITING:**
- Triggered after 5-second display timer expires
- Player list is cleared for the new round
- Countdown begins for the next round

### Security Property: Crash Point Isolation

The STARTING phase exists specifically to ensure the crash point never coexists with an open betting window:

| Phase | Bets accepted? | Crash point known? |
|---|---|---|
| `WAITING` | Yes | No — drand beacon hasn't been fetched yet |
| `STARTING` | No — locked | Being computed (exists briefly at end of phase) |
| `RUNNING` | No | Yes — but bets are already locked |
| `CRASHED` | No | Yes — revealed publicly |

Even if the crash point were leaked from server memory during RUNNING, no player could act on it by placing or changing a bet. The only action available during RUNNING is cashout, and a leaked crash point would only tell a player *when* to cash out — which is the game's intended mechanic (deciding when to exit is the whole point).

### Edge Cases

- **Player disconnects during RUNNING:** Treated as not cashing out — wager is lost. The client can auto-cashout on disconnect if an auto-cashout target was set (handled server-side).
- **Player connects mid-round:** Receives current game state snapshot. Cannot join the current round (betting is closed during STARTING, RUNNING, or CRASHED). Can observe and join the next round.
- **Player connects during STARTING:** Same as mid-round — observe only.
- **Empty round (no players):** Runs normally. Crash point is determined and revealed. This maintains hash chain integrity — no rounds are skipped.
- **drand fetch fails during STARTING:** Retry once with `/public/latest`. If that also fails, skip the round (transition directly to CRASHED with a special "void" result), preserving the chain seed for the next round. This avoids consuming a hash chain seed without a valid drand input. Void rounds are not counted in game history.
- **drand fetch is slow (>3s):** The STARTING phase simply waits. Clients see a "Round starting..." message. This is rare since the Cloudflare relay is on the same network, but the design tolerates it gracefully.

---

## 4. Crash Point Determination

### Combined Seed Formula

```
effective_seed = HMAC-SHA256(key=drand_randomness, data=chain_seed)
crash_point = derive(effective_seed)
```

Where:
- `drand_randomness` is the HMAC **key** — the public, externally-controlled source of unpredictability that the server cannot forge
- `chain_seed` is the HMAC **data** — from the pre-generated hash chain (server-committed)

Using `drand_randomness` as the key means the unpredictable component holds the privileged HMAC position. A compromised `chain_seed` alone is insufficient to predict outcomes because the server cannot know future drand values. See [Decision Log](#14-decision-log) for the full trust-model reasoning.

### Derivation Function

```javascript
function hashToFloat(hexString) {
  // Take first 13 hex chars (52 bits) — matches JS float64 precision
  return parseInt(hexString.slice(0, 13), 16) / Math.pow(2, 52);
}

function deriveCrashPoint(effectiveSeed) {
  const h = hashToFloat(effectiveSeed);
  // 1% house edge: 99 / (1 - h)
  // Floor to 2 decimal places
  // Clamp minimum to 1.00
  return Math.max(1.00, Math.floor(99 / (1 - h)) / 100);
}
```

### Distribution Properties

| Crash Point | P(crash ≤ x) | Meaning |
|---|---|---|
| 1.00x | 1% | Instant crash (house edge) |
| 1.50x | 34% | One-third of rounds crash by here |
| 2.00x | 50.5% | Coin-flip territory |
| 5.00x | 80.2% | Most rounds have crashed |
| 10.00x | 90.1% | Getting rare |
| 100.00x | 99.01% | Very rare |

**House edge:** Exactly 1%, uniform across all cashout strategies. A player who always cashes out at any fixed multiplier `m` has expected return `m * (0.99/m) = 0.99` per unit wagered.

### Multiplier Growth Curve

During the RUNNING phase, the displayed multiplier follows an exponential curve:

```javascript
function multiplierAtTime(elapsedMs) {
  const GROWTH_RATE = 0.00006; // tunable — places 2x at ~5.5 seconds
  return Math.pow(Math.E, GROWTH_RATE * elapsedMs);
}
```

The round ends when `multiplierAtTime(elapsed) >= crashPoint`. The server computes the exact crash time at round start:

```javascript
const crashTimeMs = Math.log(crashPoint) / GROWTH_RATE;
```

This allows the server to schedule the crash alarm precisely.

---

## 5. Provably Fair System

### Design Goals

1. The server cannot change a round's outcome after players have bet
2. Players can verify any round's outcome after it completes
3. A compromised server seed alone is insufficient to predict outcomes

### Why Hash Chain Alone Is Insufficient

A hash chain commits the server to a sequence of seeds in advance, preventing mid-game manipulation. However, the server generates the entire chain — it could theoretically pre-compute millions of chains and select one with favorable properties (e.g., frequent low crash points in the first N games).

**Decision:** Add player seed mixing using drand to neutralize this attack vector. See [Decision Log](#14-decision-log) for the full reasoning.

### Combined Scheme

**Pre-game setup (once):**
1. Server generates `seed[0]` (random 256-bit value)
2. Computes chain: `seed[k] = SHA256(seed[k-1])` for k = 1 to N
3. Publishes `seed[N]` (terminal hash) — the public commitment
4. Chain is used in reverse: game 1 uses `seed[N-1]`, game 2 uses `seed[N-2]`, etc.

**Per round:**
1. Server identifies the drand quicknet round to use (the round whose timestamp is closest to but not before the round start time)
2. Server fetches the drand beacon: `{ round, randomness, signature }`
3. Computes: `effective_seed = HMAC-SHA256(key=drand_randomness, data=chain_seed)`
4. Derives: `crash_point = deriveCrashPoint(effective_seed)`
5. After the round: reveals `chain_seed` and `drand_round` number

**Player verification (after round):**
1. Verify `SHA256(chain_seed) == previous_round_chain_seed` (hash chain integrity)
2. Fetch the drand beacon for the specified round from any public relay
3. Verify the drand beacon's BLS signature (optional — trusting Cloudflare relay is reasonable for MVP)
4. Compute `HMAC-SHA256(key=drand_randomness, data=chain_seed)` independently
5. Derive crash point and confirm it matches

### drand Integration Details

**Chain:** quicknet (3-second rounds, unchained BLS on G1)
**Relay:** `https://drand.cloudflare.com/{chain_hash}`
**Chain hash:** `52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971`

**Round selection:** When the WAITING countdown expires (WAITING → STARTING transition), the server:
1. Computes the current drand quicknet round number: `floor((now - genesis) / period) + 1`
2. Fetches that round's beacon from the relay: `GET /{chain_hash}/public/{round}`
3. If the beacon isn't available yet (timing edge case), the fetch blocks until it is (the relay holds the request until the round is produced — typically <3s)
4. If the fetch fails or times out (2s), retry once with `/public/latest`

**Timing:** drand quicknet produces a new value every 3 seconds. The fetch happens during the STARTING phase, so any latency is isolated between bet-locking and multiplier start. Players see a brief "Round starting..." state. Typical latency from Cloudflare's relay is ~50-200ms.

### Hash Chain Sizing

**10,000 games** per chain. At one game per minute this covers ~7 days. When the chain is exhausted (or approaching exhaustion at ~100 games remaining), the server generates a new chain, publishes the new terminal hash, and transitions seamlessly. Both chains are independently verifiable.

With a 10,000-game chain, recomputing the seed for game K requires hashing forward from `seed[0]` at most 10,000 times, which is ~10ms — trivially fast and happens during the STARTING phase. The server stores only `seed[0]` and the current game index in DO storage.

---

## 6. WebSocket Protocol

All messages are JSON. The `type` field discriminates message types.

### Server → Client Messages

#### `state` — Full state snapshot
Sent on connect and on phase transitions.

```json
{
  "type": "state",
  "phase": "WAITING" | "STARTING" | "RUNNING" | "CRASHED",
  "roundId": 42,
  "countdown": 7500,
  "multiplier": 1.00,
  "elapsed": 0,
  "crashPoint": null,
  "players": [
    {
      "id": "abc123",
      "name": "Player1",
      "wager": 100,
      "cashedOut": false,
      "cashoutMultiplier": null,
      "payout": null,
      "autoCashout": null
    }
  ],
  "chainCommitment": "a1b2c3...",
  "drandRound": null,
  "history": [
    { "roundId": 41, "crashPoint": 2.37 },
    { "roundId": 40, "crashPoint": 1.04 }
  ]
}
```

Notes:
- `phase` includes `"STARTING"` — a brief transitional phase where drand is being fetched and the crash point is computed. Bets are locked but the multiplier hasn't started.
- `crashPoint` is `null` during WAITING, STARTING, and RUNNING; revealed during CRASHED
- `countdown` is milliseconds remaining in WAITING phase (0 during other phases)
- `history` contains the last ~20 rounds for display
- `chainCommitment` is the hash that the current round's seed will be verified against

#### `tick` — Multiplier update during RUNNING

```json
{
  "type": "tick",
  "multiplier": 2.34,
  "elapsed": 5500
}
```

Sent at ~100ms intervals (10Hz). Client interpolates between ticks for smooth 60fps display.

#### `crashed` — Round ended

```json
{
  "type": "crashed",
  "crashPoint": 2.37,
  "elapsed": 6120,
  "roundSeed": "deadbeef...",
  "drandRound": 26801425,
  "drandRandomness": "cd0b899f...",
  "players": [
    {
      "id": "abc123",
      "name": "Player1",
      "wager": 100,
      "cashedOut": true,
      "cashoutMultiplier": 1.85,
      "payout": 185,
      "autoCashout": null
    },
    {
      "id": "def456",
      "name": "Player2",
      "wager": 50,
      "cashedOut": false,
      "cashoutMultiplier": null,
      "payout": 0,
      "autoCashout": 5.00
    }
  ]
}
```

#### `playerJoined` — A player placed a bet

```json
{
  "type": "playerJoined",
  "id": "abc123",
  "name": "Player1",
  "wager": 100,
  "autoCashout": 2.50
}
```

#### `playerCashedOut` — A player cashed out

```json
{
  "type": "playerCashedOut",
  "id": "abc123",
  "multiplier": 1.85,
  "payout": 185
}
```

#### `error` — Error response to client action

```json
{
  "type": "error",
  "message": "Cannot join during RUNNING phase"
}
```

### Client → Server Messages

#### `join` — Place a bet during WAITING

```json
{
  "type": "join",
  "playerId": "550e8400-e29b-41d4-a716-446655440000",
  "wager": 100,
  "name": "Player1",
  "autoCashout": 2.50
}
```

- `playerId`: UUID v4, generated by the client on first visit and stored in localStorage. Used to correlate reconnections and deliver pending auto-cashout payouts.
- `wager`: number, must be > 0 (unconstrained for MVP)
- `name`: string, display name (optional, defaults to truncated `playerId`)
- `autoCashout`: number or null. If set, server automatically cashes out at this multiplier.

#### `cashout` — Cash out during RUNNING

```json
{
  "type": "cashout"
}
```

No payload needed — the server uses the current multiplier at message receipt time.

---

## 7. Server Implementation

### Game Loop via Alarm API

The server uses Durable Object alarms to drive the game loop. There is only one alarm active at a time.

```
Phase       Alarm behavior
─────────   ──────────────────────────────────────────
WAITING     Alarm fires every 1s to broadcast countdown.
            Final alarm at countdown=0 triggers WAITING→STARTING.

STARTING    No alarm. The phase is driven by an async drand fetch.
            On fetch completion, compute crash point, transition to RUNNING.
            Set the first RUNNING tick alarm.

RUNNING     Alarm fires every 100ms to broadcast multiplier tick.
            When multiplier >= crashPoint, triggers RUNNING→CRASHED.

CRASHED     Single alarm set for 5s in the future.
            When it fires, triggers CRASHED→WAITING.
```

**STARTING phase implementation detail:** The STARTING phase does not use alarms. Instead, the final WAITING alarm handler (at countdown=0) synchronously transitions to STARTING, broadcasts the phase change, then calls `this.ctx.blockConcurrencyWhile(async () => { ... })` wrapping the drand fetch and crash point computation. This is critical: a bare `await` inside an alarm handler does **not** block other messages from interleaving — it yields the event loop, allowing `onMessage` handlers to run between microtasks. `blockConcurrencyWhile` holds the DO's input gate until the callback resolves, ensuring no `join` messages (or any other messages) can be processed while the crash point is being determined. Once the callback completes, the handler transitions to RUNNING and sets the first tick alarm. From the outside, STARTING appears as a brief pause between the countdown ending and the multiplier beginning.

### State Persistence

Critical state is persisted to Durable Object storage:
- Hash chain: `seed[0]` and current chain index (not the full chain — recompute on demand)
- Terminal hash (the public commitment)
- Round history (last 20 rounds, for client display)
- Current game number
- `runStartTimestamp`: wall-clock time the RUNNING phase began (needed to compute elapsed time accurately across tick drift or DO restart mid-round)
- `crashPoint`: the computed crash point for the current round (needed for crash detection after DO restart during RUNNING)
- `activeBets`: the full bet map for the current round (needed so disconnected-player auto-cashout payouts survive a DO restart)

Non-critical state is kept in memory only:
- Current phase, countdown
- Live connection handles (WebSocket objects)
- The multiplier tick state (can be recomputed from `runStartTimestamp`)

If the Durable Object is evicted and restarts (`onStart`), it loads from storage and begins a fresh WAITING phase. Any in-progress round is abandoned — this is acceptable for MVP since eviction is rare and rounds are short.

### Cashout Adjudication

When a `cashout` message arrives during RUNNING:
1. The server computes `multiplier(now - roundStartTime)`
2. If this multiplier is < crashPoint, the cashout is valid
3. Payout = wager * multiplier (floored to 2 decimal places)
4. The player is marked as cashed out and a `playerCashedOut` message is broadcast

The single-threaded Durable Object model guarantees that `onMessage` handlers and `onAlarm` handlers execute sequentially. Messages received before the crash alarm fires are processed before it. This provides natural fairness — no race conditions.

### drand Fetch Timing

The drand fetch is the sole purpose of the STARTING phase:
1. The WAITING countdown expires → transition to STARTING (bets locked, broadcast phase change)
2. Server computes the current drand quicknet round number: `floor((now - genesis) / period) + 1`
3. Server fetches the beacon: `fetch(https://drand.cloudflare.com/{chain}/public/{round})`
4. If the fetch fails or times out (2s), retry once with `/public/latest`
5. If both fail, void the round (see edge cases in Section 3)
6. Server computes the effective seed and crash point
7. Server sets `roundStartTime = Date.now()` → transition to RUNNING

The STARTING phase isolates drand latency (~50-200ms typically) into a visible, distinct state. Clients display "Round starting..." during this phase. The crash point does not exist anywhere until the drand beacon arrives, ensuring it cannot be leaked during the betting window.

---

## 8. Client Implementation

### Svelte Application Structure

```
src/
  App.svelte              — Main layout, WebSocket lifecycle, top-level state
  lib/
    stores.ts             — Svelte writable/derived stores for shared game state
    socket.ts             — WebSocket connection manager (partysocket); creates/destroys connection
    messageHandler.ts     — Maps incoming server messages to store updates (no socket coupling)
    commands.ts           — sendJoin(), sendCashout() — thin wrappers that write to the socket
    verify.ts             — Client-side provably fair verification logic
    balance.ts            — localStorage balance management
  components/
    Multiplier.svelte     — Animated multiplier display (writable store + CSS transition)
    PlayerList.svelte     — Table of current round's players and outcomes
    BetForm.svelte        — Wager input + auto-cashout input (shown only during WAITING)
    CashoutButton.svelte  — Cashout button (shown/enabled only during RUNNING when isInRound)
    GameStatus.svelte     — Phase indicator (waiting countdown, live, crashed)
    History.svelte        — Recent round results list
    VerifyModal.svelte    — Round verification UI
```

Splitting socket.ts into three focused modules prevents a god-object:
- `socket.ts` — owns the `PartySocket` instance and connection lifecycle
- `messageHandler.ts` — pure message routing; imports stores, no socket import (testable in isolation)
- `commands.ts` — imports socket to send messages; imports stores to read playerId

### Multiplier Interpolation

The server sends ticks at ~10Hz. The client smooths display to ~60fps using a CSS `transition` on the multiplier element, controlled by a `multiplierAnimating` flag in a writable store:

```javascript
// stores.ts
export const displayMultiplier = writable(1.0);
export const multiplierAnimating = writable(false);

// In messageHandler.ts:
// On 'tick': set multiplierAnimating(true), then displayMultiplier.set(data.multiplier)
// On 'crashed': set multiplierAnimating(false) FIRST, then update displayMultiplier
//               so the final snap-to-crash-value is instant, not animated
```

```svelte
<!-- Multiplier.svelte -->
<span class="multiplier" class:animating={$multiplierAnimating}>
  {$displayMultiplier.toFixed(2)}x
</span>

<style>
  .multiplier.animating { transition: all 100ms linear; }
</style>
```

This avoids the `tweened` store's snap problem: `tweened` has no mechanism to interrupt in-flight interpolation when the crash arrives, causing the display to animate toward the wrong value. CSS transitions can be disabled instantly by removing the class.

### Connection Management

Use `partysocket` for automatic reconnection with exponential backoff:

```javascript
import PartySocket from 'partysocket';

const socket = new PartySocket({
  host: location.host,
  room: 'crash-main',
  party: 'CrashGame'
});
```

On reconnect, the server sends a `state` message with the current snapshot, so the client can catch up.

---

## 9. Auto-Cashout

### Behavior

- Player sets an auto-cashout target (e.g., 2.50x) when placing their bet
- During RUNNING, the server checks auto-cashout targets on each tick
- When the multiplier reaches or exceeds a player's target, the server automatically cashes them out
- The cashout multiplier is the player's target (not the current tick multiplier), ensuring they get exactly what they requested
- If the crash point is below the auto-cashout target, the auto-cashout never triggers — the player loses

### Server Logic

On each tick during RUNNING:

```
for each player with autoCashout set and not yet cashed out:
  if currentMultiplier >= player.autoCashout:
    cash out player at player.autoCashout
    broadcast playerCashedOut
```

### Auto-Cashout on Disconnect

If a player disconnects during RUNNING and had an auto-cashout set, it remains active on the server keyed by `playerId`. The server still auto-cashes them out if the multiplier reaches their target. Their payout is included in the `crashed` message (which broadcasts all player outcomes), so when they reconnect the client can reconcile its balance by checking if its `playerId` appears in a recent `crashed` result it hasn't yet applied.

If a player disconnects without an auto-cashout set, they lose their wager (treated as not cashing out).

---

## 10. Player Balance

### Storage

Balances are stored in the client's `localStorage`:

```json
{
  "crashBalance": 0,
  "crashHistory": [
    {
      "roundId": 42,
      "wager": 100,
      "payout": 185,
      "cashoutMultiplier": 1.85,
      "crashPoint": 2.37,
      "timestamp": 1710172800000
    }
  ]
}
```

### Behavior

- Starting balance: `0` (net position tracker)
- When placing a bet: `balance -= wager`
- When cashing out: `balance += payout`
- When crashing without cashout: no change (wager was already subtracted)
- Balance can go negative — this is intentional (tracks net losses)
- Players can tamper with localStorage — this is accepted for MVP (no real money)

### Server's Role

The server does not track balances. It:
- Accepts any wager amount > 0
- Computes payouts and includes them in `crashed` and `playerCashedOut` messages
- The client is responsible for updating its local balance based on these messages

---

## 11. Verification Page

A simple UI component (modal or dedicated section) where players can verify past rounds:

### Inputs
- Round seed (revealed after each round)
- drand round number
- Chain commitment (the hash the seed should match)

### Process
1. Fetch the drand beacon for the given round from any public relay
2. Compute `HMAC-SHA256(key=drand_randomness, data=round_seed)`
3. Derive crash point using `deriveCrashPoint()`
4. Compute `SHA256(round_seed)` and compare to the chain commitment
5. Display: computed crash point, chain verification status, drand round details

### Data Availability
The client stores the last N rounds' verification data (seeds, drand round numbers, commitments) in memory. The `crashed` message includes all data needed for verification.

---

## 12. Project Structure

```
crash-game/
  public/                    — Built Svelte output (generated by Vite)
  src/
    server/
      index.ts               — Worker fetch handler + partyserver routing
      crash-game.ts           — CrashGame Durable Object (main game logic)
      hash-chain.ts           — Hash chain generation and management
      drand.ts                — drand quicknet fetch + round calculation
      crash-math.ts           — HMAC, crash point derivation, multiplier curve
    client/
      App.svelte              — Root component
      lib/
        stores.ts             — Svelte stores for game state
        socket.ts             — WebSocket connection manager (partysocket)
        messageHandler.ts     — Maps server messages to store updates
        commands.ts           — sendJoin(), sendCashout()
        verify.ts             — Client-side verification
        balance.ts            — localStorage balance management
      components/
        Multiplier.svelte     — Animated multiplier display (CSS transition)
        PlayerList.svelte     — Player list with bet/cashout status
        BetForm.svelte        — Wager + auto-cashout input (WAITING only)
        CashoutButton.svelte  — Cashout control (RUNNING + isInRound only)
        GameStatus.svelte     — Phase and countdown display
        History.svelte        — Recent rounds sidebar/list
        VerifyModal.svelte    — Provably fair verification UI
  wrangler.toml               — Cloudflare Workers config
  vite.config.js              — Vite + Svelte build config
  package.json
```

### wrangler.toml

```toml
name = "crash-game"
main = "src/server/index.ts"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = "./public"

[[durable_objects.bindings]]
name = "CrashGame"
class_name = "CrashGame"

[[migrations]]
tag = "v1"
new_classes = ["CrashGame"]
```

---

## 13. Deployment

### Local Development

```bash
# Install dependencies
npm install

# Build Svelte client (outputs to public/)
npm run build:client

# Start local Wrangler dev server (serves static + runs DO)
npm run dev
```

### Production

```bash
npm run build:client && npx wrangler deploy
```

The Worker serves:
- Static assets from `public/` (the built Svelte app)
- WebSocket connections via `routePartykitRequest()` to the CrashGame Durable Object

---

## 14. Decision Log

### Why a STARTING phase between WAITING and RUNNING?

**Context:** In the original design, the crash point was computed at the WAITING → RUNNING transition boundary. This meant the crash point existed in server memory during the entire RUNNING phase. While the provably fair system prevents the server from *changing* the result, it doesn't prevent the crash point from being *leaked* — via a code bug, memory inspection, or side-channel observation of the scheduled crash alarm time.

**Concern:** If the crash point were computed while bets are still open (during WAITING), a leak could allow a player or insider to make informed wagering decisions. The drand mixing prevents *pre-round* prediction (the drand value doesn't exist until it's fetched), but if the fetch happened in a single atomic transition, any bug in that transition code could expose the crash point while the betting window is technically still closing.

**Decision:** Introduce a distinct STARTING phase that separates bet-locking from crash point computation.

**Sequence:**
1. WAITING ends → bets lock → broadcast `STARTING` phase to all clients
2. Server fetches drand beacon (async, ~50-200ms)
3. Server computes crash point
4. Transition to RUNNING → multiplier begins

**What this guarantees:**
- During WAITING (bets open): crash point doesn't exist — drand hasn't been fetched
- During STARTING (bets locked): crash point is being computed — no player actions accepted
- During RUNNING (cashouts only): crash point exists in memory, but bets are already locked

Even a complete leak of the crash point during RUNNING only reveals *when the multiplier will stop* — which is the fundamental gamble players are making (when to cash out). It cannot influence bet placement because bets were locked before the crash point was computed.

**Cost:** A brief (~50-200ms) visible pause between countdown and multiplier start. Masked with a "Round starting..." animation. Negligible UX impact.

### Why pre-determined crash points (not per-tick RNG)?

**Context:** Two approaches exist for determining when a round crashes:
1. Pre-determine the crash point before the round starts
2. Roll RNG each tick during the round, with a fixed probability of crashing

**Decision:** Pre-determined crash points.

**Reasoning:**
- Enables provably fair verification — the outcome is committed before bets are placed
- Simpler timing adjudication — crash happens at a known server timestamp
- Identical distribution to per-tick RNG (tunable via the derivation formula)
- Per-tick RNG cannot be meaningfully committed to in advance, making fairness unverifiable

### Why hash chain + drand (not hash chain alone)?

**Context:** A hash chain alone commits the server to outcomes in advance, preventing mid-round manipulation. However, the server generates the chain and could pre-compute many chains, selecting one with favorable properties.

**Threat model escalation:** Beyond chain selection, if an attacker gains access to the server's seed material (via infrastructure compromise, insider access, leaked backup, or side-channel attack on the shared Cloudflare infrastructure), they can compute all future crash points.

**Decision:** Combine the hash chain with drand quicknet randomness using HMAC.

**Formula:** `effective_seed = HMAC-SHA256(key=drand_randomness, data=chain_seed)`

**Reasoning:**
- Neither the server seed nor the drand value alone determines the outcome
- The server cannot predict drand values when generating the chain (drand is produced by a distributed threshold protocol)
- A compromised server seed is insufficient — the attacker also needs future drand values, which don't exist yet
- drand is publicly verifiable — anyone can fetch and verify a beacon from any relay
- Minimal implementation cost (~10 lines of code for the HMAC + fetch)

### Why drand (not blockchain block hashes)?

**Context:** Both drand and blockchain block hashes provide public, unpredictable randomness.

**Decision:** drand quicknet.

**Reasoning:**
- drand is a Cloudflare service — the relay runs on the same network as our Worker, minimizing latency
- No external blockchain dependency (no RPC provider needed, no chain-specific concerns)
- quicknet produces values every 3 seconds (vs. ~12s for Ethereum blocks), giving us more granularity
- BLS signatures are verifiable without a blockchain node
- Simpler API: single HTTP GET returns round + randomness + signature

### Why is drand the HMAC key (not chain_seed)?

**Context:** `HMAC-SHA256` takes a key and data: `HMAC(key, data)`. Two orderings are possible:
- `HMAC(key=chain_seed, data=drand_randomness)` — server's secret in the key position
- `HMAC(key=drand_randomness, data=chain_seed)` — drand's public randomness in the key position

**Decision:** `HMAC-SHA256(key=drand_randomness, data=chain_seed)`

**Reasoning:** In HMAC, the key is the privileged, "controlling" input — the one whose holder can forge the output. If `chain_seed` is the key, the server holds full control: knowing the chain seeds (via infrastructure compromise, insider access, or backup leak) is sufficient to compute all future outcomes, making drand a cosmetic addition. Placing `drand_randomness` in the key position means the server's chain seeds are "just data" — an attacker with the full chain still cannot predict outcomes without future drand values, which are uncomputable in advance. This is the correct trust model for a provably fair system: the server commits to its seeds (chain), but cannot control the outcome because an uncontrollable external value (drand) is always in the key position.

**Verification symmetry:** Players verifying a round fetch the drand beacon (public), use it as the HMAC key with the revealed `chain_seed` as data — exactly mirroring the server's computation.

### Why Svelte (not React, Solid, or vanilla JS)?

**Context:** The frontend needs to display a multiplier updating at 60fps (interpolated from 10Hz server ticks), a reactive player list, and simple controls.

**Decision:** Svelte with Vite (no SvelteKit).

**Reasoning:**
- Reactive stores (`writable`, `derived`) combined with CSS transitions handle multiplier interpolation cleanly — no manual `requestAnimationFrame` loop or third-party animation library needed
- Compiled reactivity: when the multiplier changes, Svelte updates exactly one DOM node (no virtual DOM diffing)
- Minimal code: reactive declarations (`$:`) and template syntax (`{#each}`) reduce boilerplate vs. React hooks or vanilla DOM manipulation
- Small bundle (~8KB framework overhead) suitable for a single-page game
- Not a dead end: SvelteKit migration path exists for future enhancements (routing, SSR)

### Why `partyserver` (not managed PartyKit platform)?

**Context:** PartyKit can be used either as a managed platform or as a standalone library (`partyserver`) with standard Wrangler deployment.

**Decision:** `partyserver` with Wrangler.

**Reasoning:**
- Full control over deployment, static assets, and Cloudflare service integrations (e.g., drand fetch)
- Standard Wrangler tooling — no additional CLI or platform dependency
- Direct Durable Object access for storage and alarm API
- Can combine with other Cloudflare services (KV, R2, D1) if needed later

### Why a single room (not sharded)?

**Decision:** Single room (`"crash-main"`) for MVP.

**Reasoning:**
- One game running at a time simplifies state management, hash chain tracking, and client UX
- Durable Objects support ~32,000 hibernated connections — sufficient for MVP scale
- Sharding can be added later (multiple rooms, each with their own hash chain) if needed

### Why client-side balances (not server-side)?

**Decision:** localStorage-only balances with no server persistence.

**Reasoning:**
- No accounts, no authentication — minimal MVP scope
- Balance is a net position tracker, not real money
- Tamper-tolerant by design — players can only affect their own display
- Server-side balances would require user identity, persistence, and anti-cheat — all deferred

---

## Open Questions (Post-MVP)

- **Player seed contribution:** Allow players to submit entropy that's mixed into the crash point derivation, further reducing trust in any single party.
- **Chat:** Real-time chat alongside the game (natural fit for PartyKit).
- **Multiplier chart:** Animated curve showing the multiplier's path, with markers for player cashouts.
- **Sound design:** Audio feedback for countdown, multiplier ticks, cashout, and crash.
- **Mobile optimization:** Touch-friendly controls and responsive layout.
- **Multi-room / sharding:** Run concurrent games with different parameters (speed, house edge).
- **Server-side balances:** Accounts, leaderboards, anti-cheat.
