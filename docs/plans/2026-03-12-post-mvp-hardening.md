# Post-MVP Hardening — Implementation Plan

**Date:** 2026-03-12
**Source:** [TODO.md](../../TODO.md) derived from [docs/review-2026-03-11.md](../review-2026-03-11.md)
**Approach:** TDD, issue-by-issue PRs, severity-ordered, parallelizable where noted

---

## How to Use This Plan

Each issue has a **Status** field. Update it as work progresses:
- `PLANNED` — spec'd out, not started
- `IN PROGRESS` — actively being worked
- `IN REVIEW` — PR open, awaiting review
- `MERGED` — PR merged to main
- `BLOCKED` — waiting on dependency or user input

Issues within the same **Phase** can be worked in parallel by agent swarm unless a dependency is noted. Issues across phases should generally proceed top-to-bottom, but independent phases can overlap.

---

## Phase 1: Server Input Validation & Type Safety

*These issues harden the server against malformed/malicious input. They touch `crash-game.ts`, `game-state.ts`, `drand.ts`, and `types.ts` with minimal coupling between them. All can be parallelized.*

### Issue 1.1: [Security-3] Validate autoCashout value
**Status:** `MERGED`
**Files:** `src/server/game-state.ts`, `src/server/__tests__/game-state.test.ts`

---

### Issue 1.2: [Security-4] Validate playerId length
**Status:** `MERGED`
**Files:** `src/server/game-state.ts`, `src/config.ts`, `src/server/__tests__/game-state.test.ts`

---

### Issue 1.3: [High-1 + High-4] Runtime message validation (server + client)
**Status:** `MERGED`
**Files:** `src/server/crash-game.ts`, `src/server/validation.ts` (new), `src/server/__tests__/validation.test.ts` (new)

---

### Issue 1.4: [High-2] Validate drand beacon structure
**Status:** `MERGED`
**Files:** `src/server/drand.ts`, `src/server/validation.ts`, `src/server/__tests__/drand.test.ts`, `src/server/__tests__/validation.test.ts`

---

### Issue 1.5: [High-3] Validate storage fields on load
**Status:** `MERGED`
**Files:** `src/server/crash-game.ts`, `src/server/validation.ts`, `src/server/__tests__/validation.test.ts`

---

### Issue 1.6: [High-13] Exhaustive phase handling in onAlarm
**Status:** `MERGED`
**Files:** `src/server/crash-game.ts`

---

## Phase 2: Server State Persistence & Error Handling

*Critical backend fixes that prevent data loss and game loop freezes. These touch `crash-game.ts` lifecycle methods and should be implemented sequentially since they modify overlapping code regions.*

### Issue 2.1: [Backend-1 + Backend-2] Persist state on join and cashout
**Status:** `IN REVIEW`
**Files:** `src/server/crash-game.ts`, `src/server/__tests__/workers/crash-game.do.test.ts`
**Depends on:** Nothing

**Tests first:**
- After `handleJoin()` succeeds, storage contains updated player state
- After `handleCashout()` succeeds, storage contains updated cashout state
- Verify by reading storage directly in worker test after each operation

**Implementation:**
- In `onMessage()` join handler: call `await this.persistState()` after `handleJoin()` returns success, before broadcasting
- In `onMessage()` cashout handler: call `await this.persistState()` after `handleCashout()` returns success, before broadcasting
- Note: `persistState()` is already async; these paths become async

---

### Issue 2.2: [Backend-3] Error handling in onStart()
**Status:** `IN REVIEW`
**Files:** `src/server/crash-game.ts`, `src/server/__tests__/workers/crash-game.do.test.ts`
**Depends on:** Nothing

**Tests first:**
- If `generateRootSeed()` throws, DO logs error and retries initialization
- If storage.get() throws, DO logs error and initializes fresh state
- After error recovery, game loop still schedules alarm and can accept connections

**Implementation:**
- Wrap entire `onStart()` body in try/catch
- On error: `console.error('CrashGame initialization failed:', error)`
- Attempt to initialize fresh state (new root seed, gameNumber=0)
- If that also fails, log and let DO restart naturally

---

### Issue 2.3: [Backend-4] Error handling in onAlarm()
**Status:** `IN REVIEW`
**Files:** `src/server/crash-game.ts`, `src/server/__tests__/workers/crash-game.do.test.ts`
**Depends on:** Nothing

**Tests first:**
- If `handleTick()` throws during RUNNING, alarm is rescheduled and error message broadcast to clients
- If `startRound()` throws, alarm is rescheduled and game returns to WAITING
- After any error, game loop continues on next alarm

**Implementation:**
- Wrap `onAlarm()` body in try/catch
- In catch: `console.error('CrashGame alarm error:', error)`
- Always reschedule alarm in a `finally` block (unless phase is CRASHED and the error occurred during the crash-to-waiting transition)
- Broadcast error message to all clients: `{ type: 'error', message: 'Server error — retrying' }`

---

## Phase 3: Server Security (Advanced)

*These require more significant changes — new dependencies or architectural modifications.*

### Issue 3.1: [Security-5] Rate limiting on join/cashout messages
**Status:** `PLANNED`
**Files:** `src/server/crash-game.ts`, `src/server/__tests__/workers/crash-game.do.test.ts`
**Depends on:** Nothing

**Tests first:**
- First join message from a connection → accepted
- 5 join messages within 10 seconds → 6th is rejected with rate limit error
- After 10 seconds, rate limit resets → next message accepted
- Rate limit is per-connection, not global

**Implementation:**
- Add `rateLimits: Map<connectionId, { count: number, windowStart: number }>` to CrashGame class
- In `onMessage()`, before processing: check rate limit (5 messages per 10 seconds per connection)
- On limit exceeded: send `{ type: 'error', message: 'Rate limited — try again shortly' }`
- Clean up map entries in `onClose()`

---

### Issue 3.2: [Security-1] Drand beacon signature verification
**Status:** `PLANNED`
**Files:** `src/server/drand.ts`, `package.json`, `src/server/__tests__/drand.test.ts`
**Depends on:** Nothing (but needs investigation of BLS library compatibility with Cloudflare Workers)

**Tests first:**
- `fetchDrandBeacon()` with valid signature → returns beacon
- `fetchDrandBeacon()` with tampered signature → throws DrandFetchError
- `fetchDrandBeacon()` with tampered randomness (signature doesn't match) → throws DrandFetchError
- Verify against known drand quicknet test vectors

**Implementation:**
- **INVESTIGATE FIRST:** Which BLS library works in Cloudflare Workers? Options:
  - `@noble/curves` (pure JS, likely works)
  - `drand-client` (official, may have Node dependencies)
- Add BLS12-381 signature verification
- Verify beacon signature against drand quicknet public key
- Public key for quicknet chain hash `52db9ba7...`: fetch from `https://drand.cloudflare.com/{CHAIN_HASH}/info`
- Add public key as constant in config (don't fetch on every round)
- In `fetchDrandBeacon()`: verify signature before returning beacon

---

### Issue 3.3: [Security-2] Prevent playerId spoofing for pending payouts
**Status:** `PLANNED`
**Files:** `src/server/crash-game.ts`, `src/server/__tests__/workers/crash-game.do.test.ts`
**Depends on:** Nothing

**Tests first:**
- Player A joins, disconnects, has pending payout → Player A reconnects with same playerId → receives payout
- Player B connects with Player A's playerId → does NOT receive Player A's pending payout
- After legitimate reconnection and payout delivery, pending payout is cleared

**Implementation:**
- When storing pending payout, also store a `connectionToken` (random string sent to original client on join)
- Modify `playerJoined` server message to include an opaque `connectionToken`
- Client stores `connectionToken` in memory (not localStorage — it's per-session)
- On reconnection `join` message, client includes `connectionToken`
- Server validates token matches before delivering pending payout
- If no token or mismatch: payout remains pending (don't error — could be legitimate new player with same UUID from localStorage)

---

## Phase 4: Server Features & Limits

*Feature improvements that enhance resilience and enforce game rules.*

### Issue 4.1: [High-5] Idempotent player join
**Status:** `IN REVIEW`
**Files:** `src/server/game-state.ts`, `src/server/__tests__/game-state.test.ts`
**Depends on:** Nothing

**Tests first:**
- Player joins with wager $10 → success
- Same playerId joins again with wager $10 → returns success (not error), state unchanged
- Same playerId joins with different wager $20 → returns error (wager mismatch, prevents accidental double-bet)

**Implementation:**
- In `handleJoin()`, when player already exists:
  - If same wager: return success response (re-send `playerJoined` message), don't modify state
  - If different wager: return error "Already joined with different wager"

---

### Issue 4.2: [High-10] Cap pending payouts map
**Status:** `PLANNED`
**Files:** `src/server/crash-game.ts`, `src/server/__tests__/workers/crash-game.do.test.ts`
**Depends on:** Nothing

**Tests first:**
- After 100 pending payouts, adding a 101st evicts the oldest
- Evicted payouts are permanently lost (documented behavior)

**Implementation:**
- Add `MAX_PENDING_PAYOUTS = 100` to config.ts
- When adding to `pendingPayouts`, if size >= MAX, delete oldest entry (iterate map, delete first key)
- Log when evicting: `console.warn(\`Evicting stale pending payout for ${oldestPlayerId}\`)`

---

### Issue 4.3: [High-11] Max players per round
**Status:** `PLANNED`
**Files:** `src/server/game-state.ts`, `src/config.ts`, `src/server/__tests__/game-state.test.ts`
**Depends on:** Nothing

**Tests first:**
- Joining when player count < MAX_PLAYERS → success
- Joining when player count = MAX_PLAYERS → error "Room full"

**Implementation:**
- Add `MAX_PLAYERS_PER_ROUND = 5000` to config.ts
- In `handleJoin()`, after phase check: `if (state.players.size >= MAX_PLAYERS_PER_ROUND)` → error

---

### Issue 4.4: [High-15] Fix targeted error message routing
**Status:** `PLANNED`
**Files:** `src/server/crash-game.ts`, `src/server/__tests__/workers/crash-game.do.test.ts`
**Depends on:** Nothing

**Tests first:**
- Targeted error message (e.g., invalid wager) → only the sending player receives it
- Broadcast message (e.g., playerJoined) → all connections receive it
- Two connected players: Player A sends invalid join → only Player A gets error, Player B gets nothing

**Implementation:**
- In the message dispatch loop in `onMessage()`, for non-broadcast messages:
  - Build a connection lookup: iterate `this.getConnections()`, find connection matching `targetPlayerId`
  - Send directly to that connection
- Currently the code sends to `conn` (the connection that sent the message) — which works for `onMessage()` errors but not for other targeted messages. Refactor to use `targetPlayerId` lookup for correctness.

---

### Issue 4.5: [High-16] Min/max wager limits
**Status:** `PLANNED`
**Files:** `src/config.ts`, `src/server/game-state.ts`, `src/client/components/BetForm.svelte`, tests
**Depends on:** Nothing

**Tests first (server):**
- `handleJoin()` with wager $0.05 (below min $0.10) → error
- `handleJoin()` with wager $0.10 → success
- `handleJoin()` with wager $1000.00 → success
- `handleJoin()` with wager $1000.01 → error

**Tests first (client):**
- BetForm input has min=0.10, max=1000.00 attributes
- BetForm disables button when wager < 0.10 or > 1000.00

**Implementation:**
- Add to config.ts: `MIN_WAGER = 0.10`, `MAX_WAGER = 1000.00`
- In `handleJoin()`: validate wager against min/max
- In BetForm.svelte: add min/max to input, update `isValid` check

---

### Issue 4.6: [Medium-15] Reconnected players can still cashout
**Status:** `PLANNED`
**Files:** `src/server/crash-game.ts`, `src/server/game-state.ts`, `src/server/__tests__/game-state.test.ts`
**Depends on:** Issue 4.1 (idempotent join)

**Tests first:**
- Player joins round, disconnects during RUNNING → player remains in players map (existing behavior)
- Player reconnects during RUNNING, sends cashout → cashout succeeds
- Player reconnects during CRASHED → cannot cashout (round already over)
- Disconnected player with auto-cashout → auto-cashout still fires (existing behavior)

**Implementation:**
- Current behavior: `onClose()` is intentionally a no-op — players persist in the map. Auto-cashout continues.
- The issue is that on reconnect, `handleCashout()` uses the connection ID from the original join, but the new connection has a different ID.
- Fix: In `onMessage()` for cashout, look up the player by `playerId` (from the connection's associated player), not by connection ID
- May need to track `connectionId → playerId` mapping, updated on reconnect (ties into idempotent join from 4.1)

---

## Phase 5: Server Performance

*O(n²) fixes and broadcast optimization. These touch `game-state.ts` and `crash-game.ts` internals.*

### Issue 5.1: [High-7] O(n²) → O(n) iteration during crash and auto-cashout
**Status:** `PLANNED`
**Files:** `src/server/crash-game.ts`, `src/server/game-state.ts`, `src/server/__tests__/game-state.test.ts`
**Depends on:** Nothing

**Tests first:**
- Existing crash/auto-cashout tests still pass (behavioral parity)
- Add benchmark test: 100 players, verify crash completes in < 50ms
- Auto-cashout processes correct players at correct multipliers

**Implementation:**
- In `crash-game.ts`: build `Map<string, Connection>` (connectionId → connection) once at start of `onAlarm()` RUNNING handler
- Pass connection map into `handleTick()` / crash handler instead of calling `getConnections().find()` per player
- For auto-cashout: sort players by `autoCashout` threshold ascending once when entering RUNNING; iterate only until threshold > current multiplier

---

### Issue 5.2: [High-8] Cache state snapshots
**Status:** `PLANNED`
**Files:** `src/server/crash-game.ts`, `src/server/game-state.ts`
**Depends on:** Nothing

**Tests first:**
- State snapshot on connect matches expected structure (existing tests)
- After playerJoined, new connection gets snapshot including that player

**Implementation:**
- Cache the last `buildStateSnapshot()` result in a `cachedSnapshot` field
- Invalidate cache when state changes (phase transition, player join/cashout)
- On `onConnect()`: send cached snapshot if valid, else rebuild
- For tick messages: don't rebuild full snapshot — tick already sends only `{ type: 'tick', multiplier, elapsed }`
- This is primarily an optimization for the phase-transition broadcasts

---

### Issue 5.3: [High-9] Memoize playersList derived store
**Status:** `PLANNED`
**Files:** `src/client/lib/stores.ts`, `src/client/lib/__tests__/stores.test.ts`
**Depends on:** Nothing

**Tests first:**
- `playersList` returns array of player snapshots
- Updating a player's cashout status triggers recomputation
- Setting same players object reference does NOT trigger recomputation

**Implementation:**
- Replace `derived(players, ($p) => Object.values($p))` with a memoized version that compares player IDs and count before creating new array
- Alternative: since `players` is keyed by playerId, we can use a shallow equality check on the store value itself (Svelte already does reference equality)

---

## Phase 6: Client Architecture Refactoring

*These are the most impactful client-side changes. They should be done sequentially as each builds on the previous.*

### Issue 6.1: [High-23] Socket module lifecycle cleanup
**Status:** `PLANNED`
**Files:** `src/client/lib/socket.ts`, `src/client/lib/__tests__/socket.test.ts`, `src/client/App.svelte`
**Depends on:** Nothing

**Tests first:**
- `connect()` called twice → second call cleans up first socket before creating new one
- `disconnect()` → socket is closed, event listeners removed
- After `disconnect()`, `getRawSocket()` returns null

**Implementation:**
- Add singleton guard: if socket exists, close it before creating new one
- Return cleanup function from `connect()` for `onDestroy()` usage
- Remove all event listeners on disconnect

---

### Issue 6.2: [High-24] Eliminate dual dispatch pattern (stores + CustomEvents)
**Status:** `PLANNED`
**Files:** `src/client/lib/messageHandler.ts`, `src/client/lib/stores.ts`, `src/client/App.svelte`, `src/client/components/BetForm.svelte`, all component tests
**Depends on:** Issue 6.1

**Tests first:**
- All existing component tests pass (behavioral parity)
- Balance accounting works without CustomEvents
- BetForm error display works via store instead of CustomEvent

**Implementation:**
- Add new stores: `lastCrashResult: Writable<CrashResult | null>`, `lastError: Writable<string | null>`, `lastPendingPayout: Writable<PendingPayout | null>`
- In `messageHandler.ts`: replace `window.dispatchEvent(new CustomEvent(...))` with store writes
- In `App.svelte`: replace `window.addEventListener('crash:...')` with `$effect()` or reactive statements watching the new stores
- In `BetForm.svelte`: watch `lastError` store instead of listening for `crash:error` event
- Remove all CustomEvent dispatch/listen code
- This is the largest single refactor — plan for careful testing

---

### Issue 6.3: [High-25] Type-safe event detail handling
**Status:** `PLANNED`
**Files:** `src/client/App.svelte`, `src/client/lib/stores.ts`
**Depends on:** Issue 6.2

**Tests first:**
- After 6.2, CustomEvents are eliminated — this becomes "type-safe store reads"
- All store reads are properly typed (no `as` casts)
- Null checks on store values before accessing fields

**Implementation:**
- If 6.2 fully eliminates CustomEvents, this is automatically resolved
- If any CustomEvents remain: create typed event factories with runtime validation
- Add null guards on all store reads in App.svelte balance accounting

---

## Phase 7: Client UX Features

*New UI elements and feature additions.*

### Issue 7.1: [UX-1] WebSocket connection status indicator
**Status:** `PLANNED`
**Files:** `src/client/App.svelte` (or new `ConnectionStatus.svelte`), component tests
**Depends on:** Nothing

**Tests first:**
- Indicator shows green dot + "Connected" when `connectionStatus` = 'connected'
- Indicator shows yellow dot + "Reconnecting" when = 'reconnecting'
- Indicator shows red dot + "Disconnected" when = 'disconnected'
- Indicator is always visible in the header

**Implementation:**
- Create `src/client/components/ConnectionStatus.svelte`
- Subscribe to `connectionStatus` store
- Render colored dot + label in the app header
- Style: small, unobtrusive, always visible

---

### Issue 7.2: [High-12] Derive house edge constant in verify.ts from config
**Status:** `PLANNED`
**Files:** `src/client/lib/verify.ts`, `src/config.ts`, `src/client/lib/__tests__/verify.test.ts`
**Depends on:** Nothing

**Tests first:**
- Add test: `(1 - HOUSE_EDGE) * 100` equals the value used in `deriveCrashPoint()`
- Existing verify tests still pass

**Implementation:**
- In `verify.ts`: replace hardcoded `99` with `(1 - HOUSE_EDGE) * 100`
- Import `HOUSE_EDGE` from `../../config`
- Add build-time assertion test

---

### Issue 7.3: [High-17] In-app provably-fair explanation
**Status:** `PLANNED`
**Files:** New `src/client/components/FairnessModal.svelte`, `src/client/App.svelte`, component tests
**Depends on:** Nothing

**Tests first:**
- "How it works" button visible in the UI
- Clicking button opens modal
- Modal contains explanation of drand, hash chains, verification
- Modal can be closed

**Implementation:**
- Create `FairnessModal.svelte` with plain-English explanation of the provably-fair system
- Content sourced from `docs/provably-fair.md` but simplified
- Add "How it works" / "Fairness" button in the app footer or header
- Use `<dialog>` element (ties into A11y-1 pattern)

---

### Issue 7.4: [High-18] In-app RTP display
**Status:** `PLANNED`
**Files:** `src/client/components/BetForm.svelte`, `src/client/App.svelte`
**Depends on:** Nothing

**Tests first:**
- RTP notice visible near the bet form
- Text includes house edge percentage and RTP

**Implementation:**
- Add small text below the bet form: "Game of chance · House edge: 1% · RTP: 99%"
- Import `HOUSE_EDGE` from config for consistency
- Style: muted, small font, non-intrusive

---

## Phase 8: Accessibility

*All accessibility improvements. These are mostly independent CSS/ARIA changes that can be parallelized.*

### Issue 8.1: [A11y-1] Modal focus trap and proper dialog element
**Status:** `PLANNED`
**Files:** `src/client/components/VerifyModal.svelte`, component tests
**Depends on:** Nothing

**Tests first:**
- Modal uses `<dialog>` element (or proper ARIA role="dialog")
- Focus moves to modal on open
- Focus returns to trigger element on close
- Tab key cycles within modal (focus trap)
- Escape key closes modal
- Backdrop click closes modal

**Implementation:**
- Convert VerifyModal to use native `<dialog>` element with `showModal()`/`close()`
- Native `<dialog>` provides: focus trap, Escape handling, backdrop, proper ARIA role
- Set `inert` on main content when modal is open (progressive enhancement)
- Also apply this pattern to FairnessModal (Issue 7.3) if it's implemented first

---

### Issue 8.2: [A11y-2] Toast notifications announced to screen readers
**Status:** `PLANNED`
**Files:** `src/client/App.svelte`
**Depends on:** Nothing

**Tests first:**
- Toast container has `role="status"` and `aria-live="polite"`
- New toast content is announced by screen reader (verify via DOM attribute presence)

**Implementation:**
- Add `role="status" aria-live="polite" aria-atomic="true"` to toast container div
- Ensure toast text is meaningful (already is: "Payout from previous round: +$X.XX")

---

### Issue 8.3: [High-19] Multiplier display aria-live
**Status:** `PLANNED`
**Files:** `src/client/components/Multiplier.svelte`
**Depends on:** Nothing

**Tests first:**
- Multiplier container has `aria-live` attribute
- During RUNNING, `aria-label` includes current multiplier value

**Implementation:**
- Add `aria-live="polite" aria-atomic="true"` to multiplier display
- Since multiplier updates every 100ms, this will be very noisy for screen readers
- Add throttled `aria-label` update: only update the accessible label every 500ms or at 0.5x thresholds
- Use a visually-hidden span for the accessible value, separate from the visual display

---

### Issue 8.4: [High-20] Game phase transitions announced
**Status:** `PLANNED`
**Files:** `src/client/components/GameStatus.svelte`
**Depends on:** Nothing

**Tests first:**
- GameStatus container has `role="status"` and `aria-live="assertive"`
- Phase text is descriptive (e.g., "Next round in 5 seconds", "Round in progress", "Crashed at 2.50x")

**Implementation:**
- Add `role="status" aria-live="assertive"` to the game status container
- Ensure text content is screen-reader-friendly (already has descriptive text per phase)

---

### Issue 8.5: [High-21] Balance display includes text direction (not color-only)
**Status:** `PLANNED`
**Files:** `src/client/App.svelte`
**Depends on:** Nothing

**Tests first:**
- Positive balance shows "+" prefix or "won" label
- Negative balance shows "-" prefix or "lost" label
- `aria-label` on balance element includes direction

**Implementation:**
- Add `aria-label` to balance display: e.g., `aria-label="Balance: $150.00"`
- For round result toast: include "+$50 won" / "-$50 lost" text (not just color)
- Add a screen-reader-only prefix (visually hidden) for color-blind users

---

### Issue 8.6: [High-22] Form error messages linked to inputs
**Status:** `PLANNED`
**Files:** `src/client/components/BetForm.svelte`
**Depends on:** Nothing

**Tests first:**
- Error message div has `id="wager-error"`
- Wager input has `aria-describedby="wager-error"` when error is present
- When no error, `aria-describedby` is absent or empty

**Implementation:**
- Add `id="wager-error"` to error message element
- Add `aria-describedby="wager-error"` to wager input (conditionally, only when errorMessage is non-empty)
- Add `aria-invalid="true"` to input when error is present

---

### Issue 8.7: [Medium-23] Color-only player status indicators
**Status:** `PLANNED`
**Files:** `src/client/components/PlayerList.svelte`
**Depends on:** Nothing

**Tests first:**
- Cashed-out player shows text like "Won 2.50x" (not just green color)
- Lost player shows "Lost" text (not just red color)
- Pending player shows "—" or "Playing" text

**Implementation:**
- Add descriptive text to the Result column alongside color
- Use icons or text prefixes for non-color indication

---

### Issue 8.8: [Medium-24] Verify button contrast
**Status:** `PLANNED`
**Files:** `src/client/components/History.svelte`
**Depends on:** Nothing

**Implementation:**
- Change verify button text color from `#aaa` to `#ccc` or lighter (≥4.5:1 contrast on dark background)
- Verify contrast ratio with WCAG tool

---

### Issue 8.9: [Medium-25] Focus indicators
**Status:** `PLANNED`
**Files:** `src/client/components/BetForm.svelte`, other components with `outline: none`
**Depends on:** Nothing

**Implementation:**
- Replace `outline: none` with `:focus-visible { outline: 2px solid #42a5f5; outline-offset: 2px; }`
- Apply to all interactive elements across components

---

### Issue 8.10: [Medium-26] Table header scope attributes
**Status:** `PLANNED`
**Files:** `src/client/components/PlayerList.svelte`
**Depends on:** Nothing

**Implementation:**
- Add `scope="col"` to all `<th>` elements in the player list table

---

## Phase 9: Svelte 5 Migration & Code Quality

*Modernize components to Svelte 5 idioms. These touch every component but are safe to parallelize since each component is independent.*

### Issue 9.1: [Medium-18] Convert `export let` to `$props()`
**Status:** `PLANNED`
**Files:** All Svelte components with `export let`
**Depends on:** Phase 8 complete (avoid merge conflicts with a11y changes)

**Implementation:**
- VerifyModal: `export let entry` + `export let onClose` → `let { entry, onClose } = $props()`
- History: check for any `export let` props
- BetForm: check for any `export let` props
- Update component tests to pass props via the new pattern

---

### Issue 9.2: [Medium-19] Convert `$:` to `$derived()`
**Status:** `PLANNED`
**Files:** `BetForm.svelte`, `GameStatus.svelte`, any other components using `$:`
**Depends on:** Issue 9.1

**Implementation:**
- BetForm: `$: wagerNum = ...` → `const wagerNum = $derived(...)`
- GameStatus: `$: countdownSec = ...` → `const countdownSec = $derived(...)`
- Update tests if needed (should be transparent)

---

### Issue 9.3: [Medium-20] CashoutButton server ACK instead of timeout
**Status:** `PLANNED`
**Files:** `src/client/components/CashoutButton.svelte`, `src/client/lib/stores.ts`
**Depends on:** Issue 6.2 (if CustomEvents are eliminated, the ACK mechanism changes)

**Implementation:**
- Listen for `playerCashedOut` message (via store) where playerId matches self
- Reset `isLoading` when ACK received
- Keep 5-second timeout as fallback (increased from 2s)

---

### Issue 9.4: [Medium-21] Remove redundant type cast
**Status:** `PLANNED`
**Files:** `src/client/lib/stores.ts`
**Depends on:** Nothing

**Implementation:**
- Remove `as Phase` from line 19 — type is already `Phase` after `??` operator

---

## Phase 10: Documentation & Cleanup

*Quick documentation fixes.*

### Issue 10.1: [Low-1] Remove or relocate unused `drandRoundTime()`
**Status:** `PLANNED`
**Files:** `src/server/drand.ts`
**Depends on:** Nothing

**Implementation:**
- Remove `export` keyword (keep function for potential future use) or move to test utils

---

### Issue 10.2: [Low-2] Add protocol versioning
**Status:** `PLANNED`
**Files:** `src/types.ts`, `src/server/game-state.ts`
**Depends on:** Nothing

**Implementation:**
- Add `serverVersion?: string` to `GameStateSnapshot`
- Set in `buildStateSnapshot()`: `serverVersion: '1.0.0'`

---

### Issue 10.3: [Low-3] Document playerJoined field omissions
**Status:** `PLANNED`
**Files:** `src/types.ts`
**Depends on:** Nothing

**Implementation:**
- Add JSDoc comment to `playerJoined` message type explaining omitted fields
- Or use `Omit<PlayerSnapshot, 'cashedOut' | 'cashoutMultiplier' | 'payout'>` for type clarity

---

### Issue 10.4: [Low-4] Document pending payout transience
**Status:** `PLANNED`
**Files:** `src/server/crash-game.ts`
**Depends on:** Nothing

**Implementation:**
- Add JSDoc comment above `pendingPayouts` field:
  ```
  /** Transient in-memory map; lost on DO eviction. Scoped to DO lifetime (~5 min idle). */
  ```

---

## Parallelization Map

```
Phase 1 (all parallel):
  1.1 ─┬─ 1.2 ─┬─ 1.3 ─┬─ 1.4 ─┬─ 1.5 ─┬─ 1.6
       │       │       │       │       │
Phase 2 (sequential within, parallel with Phase 1):
  2.1 → 2.2 → 2.3
       │
Phase 3 (parallel within):
  3.1 ─┬─ 3.2 ─┬─ 3.3
       │       │
Phase 4 (mostly parallel):
  4.1 ─┬─ 4.2 ─┬─ 4.3 ─┬─ 4.4 ─┬─ 4.5
       │                        │
       └────────────────────────┘
  4.6 depends on 4.1
       │
Phase 5 (parallel):
  5.1 ─┬─ 5.2 ─┬─ 5.3
       │
Phase 6 (sequential — each builds on previous):
  6.1 → 6.2 → 6.3
       │
Phase 7 (parallel):
  7.1 ─┬─ 7.2 ─┬─ 7.3 ─┬─ 7.4
       │
Phase 8 (all parallel):
  8.1 ─┬─ 8.2 ─┬─ 8.3 ─┬─ 8.4 ─┬─ 8.5 ─┬─ 8.6 ─┬─ 8.7 ─┬─ 8.8 ─┬─ 8.9 ─┬─ 8.10
       │
Phase 9 (sequential):
  9.1 → 9.2 → 9.3 → 9.4
       │
Phase 10 (all parallel):
  10.1 ─┬─ 10.2 ─┬─ 10.3 ─┬─ 10.4
```

**Cross-phase parallelism:** Phases 1-3 (server) can run in parallel with Phases 7-8 (client) since they touch different file sets. Phase 6 (client architecture) should precede Phase 9 (Svelte 5 migration) to avoid conflicts.

---

## PR Naming Convention

Each PR should be titled: `[ISSUE-ID] Short description`

Examples:
- `[Security-3] Validate autoCashout value in handleJoin`
- `[Backend-1+2] Persist state on join and cashout`
- `[High-1+4] Runtime message validation with type guards`

Grouped issues (noted in TODO.md) share a single PR:
- High-1 + High-4 → one PR
- Medium-22 + Medium-13 → one PR
- Backend-1 + Backend-2 → one PR
