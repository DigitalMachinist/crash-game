# Documentation Plan — Crash Game Technical Docs

**Date:** 2026-03-11
**Status:** Draft — awaiting approval

## Objective

Create comprehensive technical documentation for the Crash Game MVP. Documentation should serve two audiences: (1) developers maintaining/extending the codebase, and (2) players wanting to understand the provably fair system. All architecture diagrams use Mermaid.

---

## Deliverables

### 1. `docs/project-architecture.md` — System Architecture & Deployment

High-level architecture reference covering the technology stack, deployment topology, and how the pieces connect.

**Sections:**

#### 1.1 Technology Stack Table
- Runtime: Cloudflare Workers (Durable Objects) with `partyserver`
- Frontend: Svelte 5 (Vite, no SvelteKit), `partysocket` for WebSocket
- Randomness: drand quicknet via Cloudflare relay
- Build: Vite (client → `public/`), Wrangler (server bundling + DO bindings)
- Node: v20.20.1, TypeScript strict mode

#### 1.2 Deployment Architecture (Mermaid)
```
Mermaid diagram showing:
- Browser → Cloudflare Worker → env.ASSETS binding (static files from /public, which is Vite build output)
- Browser ↔ WebSocket → Cloudflare Worker (src/server/index.ts) → routePartykitRequest
- Worker → Durable Object (CrashGame, single room "crash-main")
- Durable Object → drand Cloudflare relay (HTTPS fetch)
- Durable Object → DO Storage (single 'gameData' key)
```

#### 1.3 Client Architecture (Mermaid)
```
Mermaid component diagram showing:
- index.html (SPA shell) → main.ts → App.svelte
- App.svelte → {Multiplier, BetForm, CashoutButton, GameStatus, PlayerList, History, VerifyModal}
- socket.ts → partysocket connection → connectionStatus store
- messageHandler.ts → dispatches to stores (gameState, players, history, displayMultiplier)
- messageHandler.ts → dispatches DOM CustomEvents (crash:crashed, crash:pendingPayout, crash:error)
- App.svelte ← listens for crash:crashed + crash:pendingPayout (round result accounting)
- BetForm.svelte ← listens for crash:error
- stores.ts → writable stores + derived stores (phase, countdown, playersList, isInRound)
- balance.ts → localStorage (crashBalance, crashHistory, crashPlayerId)
- verify.ts → client-side provably fair verification (no server dependency)
- commands.ts → sends messages through socket (join, cashout)
```

#### 1.4 Server Architecture (Mermaid)
```
Mermaid component diagram showing:
- index.ts (Worker entry) → routePartykitRequest → CrashGame DO
- index.ts → env.ASSETS fallback (static file serving)
- CrashGame (crash-game.ts) → GameStateMachine functions (game-state.ts) [pure, stateless handlers]
- CrashGame → hash-chain.ts [seed generation, chain verification]
- CrashGame → drand.ts [beacon fetching, effective seed computation]
- CrashGame → crash-math.ts [multiplier curve, crash point derivation]
- CrashGame → DO Storage [single 'gameData' key persistence]
- CrashGame → Alarm API [game loop tick scheduling]
- CrashGame → onRequest [debug HTTP endpoint, gated by CRASH_DEBUG env var]
```

#### 1.5 Configuration Reference
- Full table of all constants from `src/config.ts` with: constant name, default value, unit, description, and tuning guidance
  - Game timing: `WAITING_DURATION_MS` (10 000 ms), `CRASHED_DISPLAY_MS` (5 000 ms), `TICK_INTERVAL_MS` (100 ms), `COUNTDOWN_TICK_MS` (1 000 ms)
  - Multiplier curve: `GROWTH_RATE` (0.00006) — increasing this makes the multiplier climb faster, reducing average round duration; include the formula `e^(GROWTH_RATE × t)` and the reference-point table (2x, 3x, 10x)
  - House edge: `HOUSE_EDGE` (0.01 = 1%) — changing this requires also updating the hardcoded `99` in `src/client/lib/verify.ts`; document this dependency explicitly
  - Hash chain: `CHAIN_LENGTH` (10 000), `CHAIN_ROTATION_THRESHOLD` (100) — increasing chain length extends the interval between seed rotations; decreasing threshold gives more lead-time before rotation
  - drand: `DRAND_CHAIN_HASH`, `DRAND_GENESIS_TIME`, `DRAND_PERIOD_SECS` (3 s), `DRAND_FETCH_TIMEOUT_MS` (2 000 ms) — these are tied to the drand quicknet deployment and should not be changed without also updating the drand network
  - History limits: `HISTORY_LENGTH` (20 server-broadcast), `CLIENT_HISTORY_LIMIT` (50 localStorage)
  - Room: `ROOM_ID` (`'crash-main'`) — changing this creates a new DO instance
- TypeScript config split: `tsconfig.json` (client, DOM libs, excludes `src/server/`) vs `tsconfig.server.json` (server, `@cloudflare/workers-types`, excludes `src/client/`)
- Wrangler bindings: `CRASH_DEBUG` var (set `"true"` to enable debug HTTP endpoint), `ASSETS` binding (serves Vite build output from `/public`), DO migration tag `v1`
- Note: house edge formula is parameterized via `HOUSE_EDGE` in `crash-math.ts` but hardcoded as `99` in client `verify.ts` — flag as known divergence; document the two files that must be updated in sync

#### 1.6 Build & Development
- Local development with `wrangler dev` and `vite dev`
- Test commands: unit tests (`vitest`), component tests (requires Node v20.20.1 for `node:util` `styleText`), typecheck commands (`typecheck` + `typecheck:server`)
- Linting with Biome v2

---

### 2. `docs/provably-fair.md` — Provably Fair System

Two-audience document: opens with a plain-English explainer for any player, then layers in technical depth for developers.

**Sections:**

#### 2.0 Plain-English Explainer (non-technical)

This section comes first and uses no jargon beyond what is defined inline. Target reader: a player who wants to know "can I trust this game?"

Key ideas to convey:

- **The problem**: In a normal online casino, you have to trust the casino didn't rig the result after you bet. You have no way to check.
- **Our solution in one sentence**: We decide the crash point *before* you bet, lock it in with a public promise, and then reveal all the ingredients after the round so you can verify it yourself.
- **The promise (commitment)**: Before every round, the server publishes a short fingerprint (the "chain commitment") — like a sealed envelope. After the round, it opens the envelope. You can confirm the contents match what was promised.
- **The coin flip (drand)**: We mix the pre-committed seed with a random number from an independent public lottery (drand) that nobody — not even us — can control or predict. This means even if we wanted to cheat, the final crash point is out of our hands once you've placed a bet. In fact, *we don't know the crash point of any future round ourselves* until wagers have been placed and that round has begun — it only becomes knowable at the moment we fetch the drand value.
- **Analogy**: Imagine you write a number on a piece of paper, seal it in an envelope, hand it to a stranger, then roll a die. You combine your number with the die roll to get the final result. You can't change your number after seeing the die. The stranger can verify the envelope was sealed before the roll.
- **How to verify**: Click "Verify" next to any round in the history panel. The page will re-compute the crash point from the public ingredients and show you whether it matches. No special software required.
- **What we can't fake**: We cannot change the crash point after bets are placed, because the commitment is already public. We cannot choose a convenient drand value, because drand is operated by parties independent of this game. And we cannot know any future crash point in advance — the result doesn't exist until the independent drand lottery produces its value at the start of that round.

#### 2.1 Overview & Goals (technical)
- What "provably fair" means in the context of Crash
- Two properties guaranteed: (a) the house cannot change the crash point after bets are placed, (b) anyone can verify the crash point was correctly derived

#### 2.2 Hash Chain (Mermaid)
```
Mermaid diagram showing:
- Forward computation (how chain is built):
  rootSeed → SHA-256 → seed[1] → SHA-256 → seed[2] → ... → seed[CHAIN_LENGTH] = terminalHash (commitment)
- Reverse usage (how games consume seeds):
  Game 1 uses seed at index (CHAIN_LENGTH - 1)
  Game 2 uses seed at index (CHAIN_LENGTH - 2)
  ...etc
- Verification (uses chain INDEX notation):
  Given seed at index I, verify SHA-256(seed[I]) === seed[I+1]
  In GAME terms: SHA-256(currentGameSeed) === previousGameSeed (because game order is reversed)
```
- Explicitly clarify the two numbering systems: chain index (forward, 0 = root) vs game number (1, 2, 3... consuming chain backwards)
- Why reverse order: the commitment (terminalHash) is published first; revealing a seed proves it was pre-committed because hashing is one-way
- Chain length: 10,000 games; rotation threshold at 100 remaining

#### 2.3 drand Beacon Integration
- What drand is: decentralized randomness beacon (quicknet chain, 3-second period)
- Why it's needed: prevents the server from choosing seeds to manipulate outcomes
- Fetching: primary URL with round number, fallback to `/latest`
- Timing: beacon fetched during STARTING phase; uses `getCurrentDrandRound()` which computes the round from the current wall-clock time relative to drand genesis
- `DrandFetchError`: custom error class for fetch failures
- `drandRoundTime()`: converts round number back to Unix timestamp (useful for debugging)

#### 2.4 Effective Seed Computation (Mermaid sequence diagram)
```
Mermaid sequence diagram:
1. Server publishes chainCommitment (terminalHash) in every state broadcast
2. Players place bets during WAITING
3. STARTING: server fetches drand beacon for current round (blockConcurrencyWhile ensures isolation)
4. Server computes: effectiveSeed = HMAC-SHA256(key=drand_randomness, data=chain_seed)
5. Server computes: crashPoint = deriveCrashPoint(effectiveSeed)
6. Round plays out (RUNNING)
7. CRASHED: server reveals chain_seed, drand_round, drand_randomness
8. Client verifies: SHA-256(chain_seed) === previous commitment AND re-derives crash point
```

#### 2.5 HMAC Ordering — Security-Critical Detail
- Why drand randomness is the HMAC **key** (not data)
- HMAC(key, data) semantics: the key is the privileged, uncontrollable input
- If reversed, a malicious server could choose chain seeds to cancel out drand's entropy

#### 2.6 Crash Point Derivation
- `hashToFloat(hex)`: first 13 hex chars → float in [0, 1)
- Server formula (parameterized): `max(1.00, floor((1 - HOUSE_EDGE) * 100 / (1 - h)) / 100)`
- Client formula (hardcoded): `max(1.00, floor(99 / (1 - h)) / 100)`
- Note: numerically equivalent when `HOUSE_EDGE = 0.01`, but would diverge if house edge changes — flag as known technical debt
- Distribution properties: ~1% chance of instant crash (1.00x), exponential tail

#### 2.7 Client-Side Verification
- How `verify.ts` works step-by-step
- What the VerifyModal displays: crash point, round seed (truncated), drand round, chain commitment (truncated), verification status
- Tolerance: ±0.001 for floating-point rounding
- `VerificationResult` type: `valid`, `reason`, `computedCrashPoint`, `chainValid`, `drandRound`, `drandRandomness`

#### 2.8 Chain Rotation
- When rotation happens (gameNumber > CHAIN_LENGTH - CHAIN_ROTATION_THRESHOLD)
- New rootSeed generation via `generateRootSeed()`, new terminalHash commitment
- Continuity: no game interruption during rotation

---

### 3. `docs/game-state-machine.md` — Game State & Lifecycle

Complete reference for the game state machine, player lifecycle, and timing.

**Sections:**

#### 3.1 Phase State Machine (Mermaid statechart)
```
Mermaid stateDiagram-v2:
[*] --> WAITING
WAITING --> STARTING : countdown ≤ 0
STARTING --> RUNNING : drand fetched, crash point set
STARTING --> WAITING : drand fetch failed (void round — gameNumber rewound, state persisted)
RUNNING --> CRASHED : multiplier ≥ crashPoint
CRASHED --> WAITING : display timer expires (CRASHED_DISPLAY_MS)
note: STARTING alarm re-schedules itself if still in STARTING (waiting for blockConcurrencyWhile)
```
- Each state with: duration, allowed player actions, server behavior, alarm interval
- Alarm intervals: COUNTDOWN_TICK_MS (WAITING), immediate reschedule (STARTING), TICK_INTERVAL_MS (RUNNING), CRASHED_DISPLAY_MS (CRASHED)

#### 3.2 Void Rounds
- When drand fetch fails during STARTING, the round is voided
- Server rewinds `gameNumber` (so the same chain seed is reused next attempt)
- Server resets phase to WAITING with full countdown
- State is persisted to prevent seed loss
- Players' bets are effectively cancelled (they rejoin in the next WAITING phase)

#### 3.3 Round Lifecycle (Mermaid sequence diagram)
```
Mermaid sequence diagram showing full round flow:
Server → All: state (WAITING, countdown=10000)
Player → Server: join (wager, name, autoCashout)
Server → All: playerJoined
Server → All: state (countdown ticks, every COUNTDOWN_TICK_MS)
-- STARTING phase --
Server → Server: blockConcurrencyWhile { fetch drand, compute crash point }
Server → All: state (RUNNING, crashPoint=null)
-- RUNNING phase --
Server → All: tick (multiplier, elapsed) [repeated every TICK_INTERVAL_MS]
Player → Server: cashout
Server → All: playerCashedOut (multiplier, payout)
-- CRASHED --
Server → All: crashed (crashPoint, seeds, players)
[If player was disconnected during auto-cashout]:
Server stores pendingPayout in DO
Player reconnects → Server → Player: pendingPayout
-- Next round --
Server → All: state (WAITING, next roundId)
```

#### 3.4 Player State Within a Round
- Join: only during WAITING, server confirms with `playerJoined`
- Playing: during RUNNING, player is active
- Cashout: manual (player sends `cashout`) or auto (server processes at target multiplier)
- Result: `cashedOut=true` with payout, or `cashedOut=false` with payout=0
- Player identification: `cashout` message has no payload — server identifies player by connection ID (`conn.id`)

#### 3.5 Disconnect Semantics
- `onClose` is intentionally a no-op in `crash-game.ts`
- Disconnected players' entries persist in `gameState.players` — auto-cashouts continue to fire
- If a disconnected player had an auto-cashout that triggers, the payout is stored as a `PendingPayout` in DO storage
- On reconnect, pending payouts are delivered immediately via `pendingPayout` message
- PendingPayouts are keyed by `playerId` (stable UUID from localStorage), not connection ID

#### 3.6 Multiplier Curve
- Formula: `multiplier(t) = e^(GROWTH_RATE × t)` where t is milliseconds
- Inverse: `crashTimeMs = ln(crashPoint) / GROWTH_RATE`
- Reference points: 2.00x at ~11.5s, 3.00x at ~18.3s, 10.00x at ~38.4s
- Client interpolation: CSS transition on `TICK_INTERVAL_MS` (100ms), not a tweened store

#### 3.7 Auto-Cashout
- Set by player on join (`autoCashout` field)
- Processed server-side in `handleTick()` — guaranteed to execute at target multiplier (not current tick multiplier)
- Payout calculated as: `floor(wager × autoCashoutTarget × 100) / 100`
- This prevents overshoot penalty: player gets exactly what they asked for

#### 3.8 Balance Management (Mermaid sequence diagram)
```
Mermaid sequence diagram showing balance accounting:
Player → Server: join (wager=100)
Server → All: playerJoined
App.svelte: if myPlayerId matches → applyBet(100) → localStorage balance -= 100

-- Round plays out --

Server → All: crashed { players: [...] }
App.svelte: crash:crashed event fires
App.svelte: hasPendingResult() guard → prevents double-apply
App.svelte: find my player in crashed.players
  if cashedOut → applyCashout(payout) → localStorage balance += payout
  if not cashedOut → addHistoryEntry with payout=0

-- OR if disconnected during round --

Player reconnects
Server → Player: pendingPayout { payout, ... }
App.svelte: crash:pendingPayout event fires
App.svelte: applyCashout(payout) → localStorage balance += payout
```
- Balance is localStorage-only (no server authority)
- `applyBet()` is called on `playerJoined` server confirmation (NOT optimistic)
- `applyCashout()` is guarded by `hasPendingResult()` to prevent double-application
- `getOrCreatePlayerId()` generates stable UUID via `crypto.randomUUID()`, persisted in localStorage under `crashPlayerId`
- Client-side `RoundResult` type (localStorage) is distinct from server-side `HistoryEntry` type (broadcast)

#### 3.9 State Persistence
- Durable Object uses a **single storage key** `'gameData'` containing: `{ rootSeed, gameNumber, chainCommitment, history, pendingPayouts }`
- Persisted after every crash and after void rounds (not every tick)
- Chain commitment published in every state broadcast
- `PendingPayout` interface is defined locally in `crash-game.ts` (not in shared `types.ts`)

---

### 4. `docs/websocket-protocol.md` — WebSocket Message Reference

Concise protocol reference for the client-server WebSocket communication.

**Sections:**

#### 4.1 Connection
- Transport: WebSocket via `partysocket` (auto-reconnect)
- Room: `crash-main`, party: `crash-game`
- On connect: server sends full `state` message with current game state
- `connectionStatus` store tracks: `'connecting'` → `'connected'` or `'reconnecting'`

#### 4.2 Client → Server Messages
Table with columns: type, fields, phase constraint, description
- `join`: `{ playerId, wager, name?, autoCashout? }` — WAITING only
- `cashout`: `{ type: 'cashout' }` (no additional fields) — RUNNING only, player identified by `conn.id`

#### 4.3 Server → Client Messages
Table with columns: type, fields, when sent, description
- `state`: full `GameStateSnapshot` — on connect + phase transitions
- `tick`: `{ multiplier, elapsed }` — every 100ms during RUNNING
- `crashed`: `{ crashPoint, elapsed, roundSeed, drandRound, drandRandomness, players }` — round end
- `playerJoined`: `{ id, playerId, name, wager, autoCashout }` — bet confirmation (broadcast to all)
- `playerCashedOut`: `{ id, multiplier, payout }` — cashout confirmation (broadcast to all)
- `pendingPayout`: `{ roundId, wager, payout, cashoutMultiplier, crashPoint }` — sent to individual player on reconnect
- `error`: `{ message }` — validation errors (sent to individual player)
- Security note: `crashPoint` is `null` in `state` messages during WAITING/STARTING/RUNNING; only revealed in the `crashed` message

#### 4.4 Message Flow Diagrams
- Mermaid sequence diagram: happy-path round with bet + manual cashout
- Mermaid sequence diagram: auto-cashout flow
- Mermaid sequence diagram: disconnect + pending payout on reconnect
- Mermaid sequence diagram: void round (drand fetch failure)

---

### 5. Docblock Pass — Code Cross-References

After documentation is written, add JSDoc/TSDoc comments to key source files referencing the relevant documentation. This is a surgical pass — no logic changes, only documentation additions.

#### 5.1 Server Files

| File | Docblocks to Add |
|------|-----------------|
| `src/server/crash-game.ts` | Module-level: link to `project-architecture.md` §1.4 and `game-state-machine.md`. `onAlarm()`: link to state machine phases §3.1. `startRound()`: link to `provably-fair.md` §2.4, note `blockConcurrencyWhile`. `crashRound()`: link to balance management §3.8 and disconnect semantics §3.5. `onClose()`: explain intentional no-op, link to §3.5. `onRequest()`: note debug endpoint gated by `CRASH_DEBUG`. `persistState()`: note single `'gameData'` key, link to §3.9. |
| `src/server/game-state.ts` | Module-level: link to `game-state-machine.md`. `handleJoin()`: link to §3.4 (WAITING only). `handleCashout()`: link to §3.4 (RUNNING only). `handleTick()`: link to auto-cashout §3.7 and multiplier curve §3.6. `handleCrash()`: link to §3.1 CRASHED transition. `handleCountdownTick()`: link to §3.1 WAITING phase. `transitionToWaiting()`: link to §3.1 next round. `buildStateSnapshot()`: link to `websocket-protocol.md` §4.3 state message. |
| `src/server/crash-math.ts` | Module-level: link to `provably-fair.md` §2.6. `hashToFloat()`: explain first 13 hex chars → [0,1). `deriveCrashPoint()`: link to house edge formula, note parameterized via `HOUSE_EDGE`. `multiplierAtTime()`: link to multiplier curve §3.6. `crashTimeMs()`: inverse of multiplierAtTime. |
| `src/server/hash-chain.ts` | Module-level: link to `provably-fair.md` §2.2. `generateRootSeed()`: 256-bit entropy. `computeSeedAtIndex()`: explain forward-chaining. `getChainSeedForGame()`: explain index inversion (`CHAIN_LENGTH - gameNumber`), link to §2.2 numbering. `verifySeedAgainstHash()`: link to verification §2.7. `computeTerminalHash()`: link to chain commitment concept. |
| `src/server/drand.ts` | Module-level: link to `provably-fair.md` §2.3. `getCurrentDrandRound()`: wall-clock computation from genesis. `drandRoundTime()`: inverse, useful for debugging. `fetchDrandBeacon()`: retry logic, `DrandFetchError`. `computeEffectiveSeedFromBeacon()`: link to HMAC ordering §2.5, security-critical. |
| `src/server/index.ts` | Module-level: link to `project-architecture.md` §1.2 deployment. Note `routePartykitRequest` for WebSocket, `env.ASSETS` fallback for static files. |

#### 5.2 Client Files

| File | Docblocks to Add |
|------|-----------------|
| `src/client/App.svelte` | Module-level: root component and round-result accounting orchestrator. Link to `game-state-machine.md` §3.8 (balance management). Document: `crash:crashed` event handler (finds player, applies cashout or records loss, guarded by `hasPendingResult`). `crash:pendingPayout` handler (reconnect payout). Toast notification system for auto-cashout. `getOrCreatePlayerId()` call on mount. |
| `src/client/lib/verify.ts` | Module-level: link to `provably-fair.md` §2.7. Note: client-side only, no server dependency. `verifyRound()`: step-by-step docblock. `computeEffectiveSeed()`: link to HMAC ordering §2.5. Note hardcoded `99` vs server's parameterized formula. |
| `src/client/lib/messageHandler.ts` | Module-level: link to `websocket-protocol.md` §4.3. Note dual dispatch: updates stores AND dispatches DOM CustomEvents. List the three events: `crash:crashed`, `crash:pendingPayout`, `crash:error`. |
| `src/client/lib/balance.ts` | Module-level: link to `game-state-machine.md` §3.8. `applyBet()`: deducted on server confirmation, not optimistic. `applyCashout()`: guarded externally by `hasPendingResult()`. `getOrCreatePlayerId()`: stable UUID in localStorage. Note `RoundResult` vs server `HistoryEntry` distinction. |
| `src/client/lib/stores.ts` | Module-level: link to `project-architecture.md` §1.3. Document derived stores: `phase`, `countdown`, `playersList`, `isInRound`. |
| `src/client/lib/socket.ts` | Module-level: link to `websocket-protocol.md` §4.1. Document `connectionStatus` store updates. |
| `src/client/lib/commands.ts` | Module-level: link to `websocket-protocol.md` §4.2. Note player identification is by connection, not message payload. |
| `src/client/main.ts` | One-line module comment: SPA entry point, mounts App to `#app`. |

#### 5.3 Component Files (lightweight)

| File | Docblocks to Add |
|------|-----------------|
| `src/client/components/History.svelte` | Brief: orchestrates VerifyModal with round data from server history. |
| `src/client/components/VerifyModal.svelte` | Brief: link to `provably-fair.md` §2.7. |
| `src/client/components/BetForm.svelte` | Brief: listens for `crash:error` DOM event for server validation errors. |
| `src/client/components/CashoutButton.svelte` | Brief: uses `isInRound` derived store for conditional rendering. |

#### 5.4 Shared Files

| File | Docblocks to Add |
|------|-----------------|
| `src/types.ts` | `ServerMessage`: link to `websocket-protocol.md` §4.3. `ClientMessage`: link to §4.2. `GameStateSnapshot`: link to `game-state-machine.md` §3.1. `HistoryEntry`: note this is server-broadcast history, distinct from client `RoundResult`. `VerificationResult`: link to `provably-fair.md` §2.7. Security comment on `crashPoint` already exists — add cross-reference to `provably-fair.md` §2.4. |
| `src/config.ts` | Module-level: link to `project-architecture.md` §1.5. |

---

## Implementation Order

The docs should be written in this order because later docs reference earlier ones:

1. **`docs/project-architecture.md`** — foundational; referenced by all other docs
2. **`docs/provably-fair.md`** — references architecture; self-contained crypto explanation
3. **`docs/game-state-machine.md`** — references architecture and provably-fair for seed computation
4. **`docs/websocket-protocol.md`** — references state machine for phase constraints
5. **Docblock pass** — references all four docs above; split across server, client, components, shared

## Estimated Scope

| Deliverable | Est. Lines | Mermaid Diagrams |
|---|---|---|
| `project-architecture.md` | 180–220 | 3 (deployment, client, server) |
| `provably-fair.md` | 220–270 | 3 (hash chain, effective seed sequence, chain rotation) |
| `game-state-machine.md` | 250–300 | 4 (state chart, round lifecycle sequence, balance accounting, multiplier reference) |
| `websocket-protocol.md` | 170–200 | 4 (happy path, auto-cashout, reconnect, void round) |
| Docblock pass | ~100–130 lines of comments across 18 files | — |
| **Total** | ~950–1150 | 14 |

## Review Criteria

Each doc should be reviewed against:
1. **Accuracy**: Cross-reference with actual source code (not just the spec)
2. **Mermaid validity**: All diagrams render correctly in GitHub markdown preview
3. **Cross-linking**: Docs reference each other where appropriate with correct section anchors
4. **Completeness**: No major subsystem left undocumented
5. **Audience**: Architecture/deployment → developers; provably-fair → developers + players
6. **Index numbering consistency**: Hash chain docs clearly distinguish chain-index vs game-number

## Post-Implementation Review Checklist

- [ ] All Mermaid diagrams render in GitHub markdown preview
- [ ] All section cross-references between docs use correct anchors
- [ ] Docblocks reference correct doc file paths and section numbers
- [ ] No stale information from spec that doesn't match implementation
- [ ] Config values in docs match `src/config.ts` exactly
- [ ] HMAC ordering (drand=key) is emphasized, not just mentioned
- [ ] House edge formula discrepancy (parameterized server vs hardcoded client) is flagged
- [ ] Balance accounting flow matches actual `messageHandler.ts` + `App.svelte` + `balance.ts` behavior
- [ ] Auto-cashout uses target multiplier (not tick multiplier) is documented
- [ ] Chain rotation mechanics match `crash-game.ts` implementation
- [ ] Void round behavior (drand fetch failure → rewind gameNumber) is documented
- [ ] Disconnect semantics (onClose no-op, pending payouts) are documented
- [ ] Single 'gameData' storage key (not multiple keys) is accurately described
- [ ] `blockConcurrencyWhile` usage during STARTING is documented
- [ ] Non-technical provably-fair explainer uses no unexplained jargon
- [ ] Plain-English section gives a concrete analogy and explains what *cannot* be faked
- [ ] Config reference table includes all constants with tuning guidance, not just names
- [ ] House-edge sync dependency (config.ts + verify.ts) is explicitly called out in config docs
- [ ] No secrets or internal-only details exposed in player-facing sections
- [ ] Client event bus pattern (3 custom DOM events) is visible in client architecture
