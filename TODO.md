# Crash Game — Post-MVP TODO

Derived from [docs/review-2026-03-11.md](docs/review-2026-03-11.md).
Each item should be implemented TDD-style, validated, and submitted as its own PR.

---

## IMPLEMENT IMMEDIATELY

Issues are ordered by severity (Critical > High > Medium > Low) and by ID within each severity tier.

### Critical — Security

- [ ] **[Security-1]** Drand beacon signatures not verified (cryptographic attack vector)
  - File: `src/server/drand.ts:62-90`, `src/client/lib/verify.ts`
  - Import drand BLS signature verification; verify beacon signature against drand's public key before accepting beacon data; fail round with error if verification fails.

- [ ] **[Security-2]** Client can spoof playerId to claim another player's pending payout
  - File: `src/server/crash-game.ts:113-123`
  - Bind pending payouts to both playerId AND WebSocket connection ID; verify reconnecting player identity via token or similar mechanism.

- [x] **[Security-3]** No validation on autoCashout value
  - File: `src/server/game-state.ts:74-149`
  - Validate in `handleJoin()`: reject if autoCashout is not null and is not finite or < 1.0.

- [x] **[Security-4]** No length validation on playerId (DoS via memory exhaustion)
  - File: `src/server/crash-game.ts:125-143`
  - Reject playerId values exceeding 256 characters.

- [ ] **[Security-5]** No rate limiting on join/cashout messages (DoS vector)
  - File: `src/server/crash-game.ts:102-168`
  - Implement per-connection rate limiting; reject messages exceeding threshold (e.g., 5 joins per 10 seconds).

### Critical — Backend / Durable Objects

- [x] **[Backend-1]** Player join state not persisted (data loss on DO eviction)
  - File: `src/server/crash-game.ts:125-143`
  - Call `persistState()` immediately after `handleJoin()` returns, before sending confirmation.

- [x] **[Backend-2]** Player cashout state not persisted (data loss on DO eviction)
  - File: `src/server/crash-game.ts:157-167`
  - Call `persistState()` immediately after `handleCashout()` returns.

- [x] **[Backend-3]** Durable Object initialization has no error handling
  - File: `src/server/crash-game.ts:62-85`
  - Wrap all initialization in try/catch; log errors; implement graceful fallback so the game loop can continue.

- [x] **[Backend-4]** Durable Object game loop has no error handling (frozen multiplier on crash)
  - File: `src/server/crash-game.ts:194-238`
  - Wrap all game loop handlers in try/catch; always reschedule alarm even on error; dispatch error message to clients; log exception with full context.

### Critical — Frontend UX

- [ ] **[UX-1]** No WebSocket connection status indicator visible
  - File: `src/client/stores.ts:20`, `src/client/App.svelte`
  - Add connection status indicator in app header (green=connected, yellow=reconnecting, red=disconnected).

### Critical — Accessibility

- [ ] **[A11y-1]** Modal focus trap missing and backdrop role incorrect
  - File: `src/client/VerifyModal.svelte:35-41`
  - Implement focus trap using `inert` on page content; manage focus on modal open/close; use proper ARIA markup or `<dialog>` element.

- [x] **[A11y-2]** Toast notifications not announced to screen readers
  - File: `src/client/App.svelte:122`
  - Add `role="status" aria-live="polite" aria-atomic="true"` to toast container.

### High — Security & Validation

- [x] **[High-1]** No type validation on JSON messages (bypasses safety)
  - File: `src/server/crash-game.ts:105`, `src/client/socket.ts:36`
  - Create type guard or use validation library (zod/valibot) to validate message shape and field types before processing.

- [x] **[High-2]** No validation of drand beacon structure (cryptic failures on malformed data)
  - File: `src/server/drand.ts:75`
  - Validate beacon structure: ensure `round` is number, `randomness` and `signature` are hex strings; fail round with clear error if invalid.

- [x] **[High-3]** Storage fields loaded without validation (corrupted state recovery)
  - File: `src/server/crash-game.ts:64-70`
  - Validate all required fields after loading from storage; reinitialize from scratch if any field is missing or invalid.

- [x] **[High-4]** Server JSON cast provides zero runtime safety for client messages
  - File: `src/server/crash-game.ts:105`
  - NOTE: Overlaps with High-1. **Implement together as one PR** — create discriminating type guard that checks `type` field presence and validates field types per message type.

- [x] **[High-5]** Player join is not idempotent (poor reconnection resilience)
  - File: `src/server/game-state.ts:105-116`
  - Return success if player already joined with same playerId and wager; update join timestamp silently to indicate reconnection.

### High — Performance

- [ ] **[High-7]** O(n^2) iteration during crash and auto-cashout
  - File: `src/server/game-state.ts:268`, `src/server/crash-game.ts:335`, `src/server/game-state.ts:254-304`
  - Build `Map<connectionId, Connection>` lookup once per phase; check membership in O(1). For auto-cashout, pre-sort players by threshold or reduce tick frequency.

- [x] **[High-8]** buildStateSnapshot() is O(n) and called on every phase transition
  - File: `src/server/crash-game.ts:97-99`, `src/server/crash-game.ts:297-299`
  - Implement delta-based broadcasting or cache snapshots; only send full state on connect and phase changes.

- [ ] **[High-9]** playersList derived store creates new array on every update
  - File: `src/client/stores.ts:28`
  - Memoize `playersList` to only recompute when player count or identities change.

### High — State Management & Limits

- [x] **[High-10]** Pending payouts Map is unbounded (memory accumulation)
  - File: `src/server/crash-game.ts:59`
  - Implement FIFO eviction (e.g., keep only last 100 entries) or round-based cap.

- [ ] **[High-11]** No max players per round (unbounded memory growth)
  - File: `src/server/game-state.ts:74-149`
  - Add configured cap (e.g., 5000 players) and reject excess joins with "room full" error.

- [ ] **[High-12]** House edge hardcoded as literal '99' (sync risk with config.ts)
  - File: `src/client/lib/verify.ts:68`, `src/config.ts:22`
  - Import `HOUSE_EDGE` from config.ts into verify.ts; add build-time test asserting `(1 - HOUSE_EDGE) * 100 === 99`.

- [x] **[High-13]** Phase handling has no exhaustiveness check (new phases won't cause compile error)
  - File: `src/server/crash-game.ts:194-237`
  - Add `const _exhaustive: never = phase;` in final else clause, or convert to switch with `default: throw`.

### High — Error Routing & UX

- [x] **[High-15]** Targeting routed error messages to specific players is broken
  - File: `src/server/crash-game.ts:137-166`
  - Implement proper routing: if `broadcast === true` use `this.broadcast()`, else look up target player's connection and route to it.

- [ ] **[High-16]** No min/max wager limits enforced
  - File: `src/client/BetForm.svelte:33`, `src/config.ts`
  - Add `MIN_WAGER = 0.10` and `MAX_WAGER = 1000.00` to config.ts; enforce server-side in `handleJoin()` and client-side in BetForm.

- [ ] **[High-17]** Provably-fair explanation is external only (not in-app)
  - File: `docs/provably-fair.md`
  - Add in-app "Fairness" or "How to Verify" button with modal explaining drand, hash chains, and round verification.

- [ ] **[High-18]** No in-app RTP display
  - File: `src/client/BetForm.svelte`, `src/client/App.svelte`
  - Add notice: "This is a game of chance. House edge: 1%. RTP: 99%." No responsible gambling controls at this time.

### High — Accessibility

- [x] **[High-19]** Multiplier display not announced to screen readers
  - File: `src/client/Multiplier.svelte:12-21`
  - Add `aria-live="polite" aria-atomic="true"` to multiplier display. NOTE: The multiplier changes very quickly so screen readers may struggle — consider throttling announcements or announcing only at key thresholds (e.g., every 0.5x).

- [x] **[High-20]** Game phase transitions not announced to screen readers
  - File: `src/client/GameStatus.svelte:8-29`
  - Add `role="status" aria-live="assertive"` to game status container.

- [ ] **[High-21]** Balance display uses color-only to indicate gain/loss (color-blind inaccessible)
  - File: `src/client/App.svelte:114-118`
  - Add text labels or aria-labels that include balance direction (e.g., "+$50 won" / "-$50 lost").

- [ ] **[High-22]** Form error messages not associated with inputs
  - File: `src/client/BetForm.svelte:48-50`
  - Add `id="wager-error"` to error div; add `aria-describedby="wager-error"` to wager input.

### High — Frontend Architecture

- [ ] **[High-23]** Socket module has side effects on import; cleanup leaks event listeners
  - File: `src/client/socket.ts:15-46`
  - Add explicit cleanup; return handle from `connect()`; implement singleton pattern or connection guard.

- [ ] **[High-24]** Dual dispatch pattern (stores + CustomEvents) creates implicit sync contracts
  - File: `src/client/messageHandler.ts:32-109`, `src/client/App.svelte:46-92`
  - Adopt store-only pattern with derived stores; eliminate CustomEvents for game state, or create typed event factories.

- [ ] **[High-25]** CustomEvent handlers cast without null-safety checks
  - File: `src/client/App.svelte:46-61`, `src/client/App.svelte:63-92`
  - Create typed event factory that validates detail on dispatch; add null checks in handlers.

### Medium — Disconnection & Resilience

- [ ] **[Medium-15]** Disconnected players lose non-auto-cashout bets with no recovery
  - File: `src/server/crash-game.ts:178-183`
  - A player who has joined, disconnected, and reconnected while the round is still playing should still be able to cashout their wager — it should not automatically be cashed out or lost upon disconnect.

### Medium — Code Quality (Svelte 5 Migration)

- [ ] **[Medium-18]** Components use old Svelte 4 `export let` syntax (not Svelte 5 idioms)
  - File: `src/client/VerifyModal.svelte`, `src/client/History.svelte`, `src/client/BetForm.svelte`
  - Convert to `let { entry, onClose } = $props()` pattern.

- [ ] **[Medium-19]** Components use old `$:` reactive declarations instead of `$derived()`
  - File: `src/client/BetForm.svelte:11-14`, `src/client/GameStatus.svelte:4-5`
  - Convert `$:` computed values to `$derived()` rune.

- [ ] **[Medium-20]** CashoutButton timeout hardcoded (button re-enables too early if server slow)
  - File: `src/client/CashoutButton.svelte:18-20`
  - Use server ACK event to reset loading state instead of 2000ms timeout.

- [ ] **[Medium-21]** Redundant type cast in stores.ts
  - File: `src/client/stores.ts:19`
  - Remove the `as Phase` assertion — type is already `Phase` after the nullish coalescing operator.

- [ ] **[Medium-22]** Unknown message types silently ignored with no logging
  - File: `src/server/crash-game.ts:206-214`
  - Add exhaustive type check; emit error message for unknown types; log in development.
  - NOTE: Overlaps with Medium-13 (IMPLEMENT LATER). **Implement together as one PR** covering both `onMessage()` and alarm handler unknown-type paths.

### Medium — Accessibility (continued)

- [ ] **[Medium-23]** Color-only status indicators for players (color-blind inaccessible)
  - File: `src/client/PlayerList.svelte:29-35`
  - Add text labels or icons: "Won 2.5x" instead of green text alone.

- [ ] **[Medium-24]** Verify button low-contrast text (below WCAG AA)
  - File: `src/client/History.svelte:32`
  - Increase button contrast to meet WCAG AA 4.5:1 ratio.

- [ ] **[Medium-25]** Focus indicator removed and not replaced (keyboard navigation degraded)
  - File: `src/client/BetForm.svelte`
  - Replace `outline: none` with `outline: 2px solid #1565c0; outline-offset: 2px;` on `:focus-visible`.

- [ ] **[Medium-26]** Table headers lack scope attribute (screen reader associations broken)
  - File: `src/client/PlayerList.svelte:5-42`
  - Add `scope="col"` to all `<th>` elements.

### Low — Documentation & Cleanup

- [x] **[Low-1]** `drandRoundTime()` exported but never called (unused utility)
  - File: `src/server/drand.ts:49-52`
  - Move to test utilities or remove from production exports.

- [x] **[Low-2]** No protocol versioning (forward/backward compatibility)
  - File: `src/types.ts`
  - Add `serverVersion?: string` to initial state message; document breaking change policy.

- [x] **[Low-3]** `playerJoined` message omits null fields without documentation
  - File: `src/types.ts:98-105`
  - Add `Omit<>` type or clarifying comment to `playerJoined` definition.

- [x] **[Low-4]** Pending payout transience not documented
  - File: `src/server/crash-game.ts:113-123`
  - Add doc comment explaining pending payouts are transient and scoped to DO lifetime.

---

## IMPLEMENT LATER

- [ ] **[Backend-5]** No error logging or observability
  - File: `src/server/crash-game.ts` (entire file)
  - Add console.error/log at minimum; consider Cloudflare Logpush for production.

- [ ] **[UX-3b]** Player name not persisted — must be re-entered every session
  - File: `src/client/lib/balance.ts` (localStorage), `src/client/components/BetForm.svelte`
  - Persist the player's preferred display name to localStorage alongside their auto-generated `playerId`, so the name field is pre-filled on return visits without requiring re-entry.

- [ ] **[UX-2]** Bet form disappears without confirmation when round starts
  - File: `src/client/BetForm.svelte:44`
  - Keep the wagering form visible whenever the player is not joined to a round so they can place a wager on the *upcoming* round after the current one. Show confirmation when bet is accepted.

- [ ] **[High-6]** Join can be rejected due to race during WAITING->STARTING transition
  - File: `src/server/crash-game.ts:207-214`, `src/server/game-state.ts:79-90`
  - Use the timestamp of message receipt by the edge to adjudicate timing — if a join was received with a timestamp before the WAITING->STARTING transition, handle it as though it arrived during WAITING.

- [ ] **[High-14]** hexToBytes uses float division without integer coercion (byte corruption)
  - File: `src/server/drand.ts:95`, `src/client/lib/verify.ts:18`
  - INVESTIGATE: Need to verify if this can actually break randomness/hashing systems. The loop increments by 2, so `i` may always be even — in which case `i/2` is always an integer and this is a false positive.

- [ ] **[Medium-1]** HistoryEntry lacks nextChainCommitment (incomplete audit trail)
  - File: `src/types.ts:60-67`
  - Add optional `nextChainCommitment?: string` to `HistoryEntry`.

- [ ] **[Medium-2]** House edge documentation is misleading (effective edge ~2%, not 1%)
  - File: `src/server/crash-math.ts:35-39`, `docs/provably-fair.md`
  - Clarify effective vs. target house edge in documentation.

- [ ] **[Medium-3]** VerifyModal lacks plain-English explanation for non-technical users
  - File: `src/client/VerifyModal.svelte:35-77`
  - Add plain-English explanation alongside technical data.

- [ ] **[Medium-4]** PlayerList crash result only visible in sidebar (no in-game feedback)
  - File: `src/client/PlayerList.svelte:29-35`
  - Add post-crash banner showing personal result ("You won +$50 at 2.50x" / "You lost $50").

- [ ] **[Medium-5]** Pending payout toast message lacks context
  - File: `src/client/App.svelte:35-43`
  - Update to include multiplier: "Payout from previous round: +$120.00 at 2.40x".

- [ ] **[Medium-6]** History displays only crash point, not personal win/loss
  - File: `src/client/History.svelte:21-36`
  - Add "Your Wager" and "Your Result" columns.

- [ ] **[Medium-7]** Auto-cashout UX unclear for new players
  - File: `src/client/BetForm.svelte:75-84`
  - Add tooltip: "Game automatically cashes you out at this multiplier."

- [ ] **[Medium-8]** JSON parse errors silently ignored (malformed messages invisible)
  - File: `src/client/socket.ts:34-41`
  - Log parse errors in development; dispatch error status on repeated failures.

- [ ] **[Medium-9]** persistState() has no error handling (silent divergence on storage failure)
  - File: `src/server/crash-game.ts:379-387`
  - Wrap in try/catch; log storage errors; implement retry with exponential backoff.

- [ ] **[Medium-11]** startRound() inside blockConcurrencyWhile has no try/catch
  - File: `src/server/crash-game.ts:249-303`
  - Add try/catch that always schedules a recovery alarm even on error.

- [ ] **[Medium-12]** applyCashout() accepts NaN/negative payout (balance corruption)
  - File: `src/client/lib/balance.ts:66-71`
  - Validate: reject NaN and negative values.

- [ ] **[Medium-13]** Unknown message types silently ignored with no logging
  - File: `src/server/crash-game.ts:111-167`
  - Add exhaustive type checking; emit error for unknown types.
  - NOTE: Overlaps with Medium-22 (IMPLEMENT IMMEDIATELY). **Implement together as one PR.**
  - NOTE: Phase 1 addressed the error-emission path (unknown/malformed messages now receive `'Invalid message format'` via `isValidClientMessage`). **Remaining work:** add server-side `console.warn` when `isValidClientMessage()` rejects a message in `onMessage()`, so rejections are visible in server logs alongside the client-facing error.

- [ ] **[Medium-22-logging]** Server-side logging missing for validation rejections (Medium-22 partial)
  - File: `src/server/crash-game.ts` (`onMessage`)
  - Phase 1 implemented `isValidClientMessage()` and returns `'Invalid message format'` to the client, but does not log the rejection server-side. Add `console.warn('onMessage: rejected invalid message', { connId: conn.id, parsed })` (or similar) in development so operators can observe malformed-message patterns.
  - NOTE: Implement together with Medium-13 in the same PR.

- [ ] **[Medium-14]** getChainSeedForGame() throws inside handler; bounds check happens inside helper
  - File: `src/server/crash-game.ts:260`
  - Add explicit bounds check before calling helper; add warning log.

- [ ] **[Medium-16]** WebSocket reconnection shows "reconnecting" with no ETA or progress
  - File: `src/client/socket.ts:29-31`
  - Show reconnection attempt count and ETA in status indicator; implement timeout with fallback message.

- [ ] **[Medium-17]** send() silently drops messages if socket is null (no error visibility)
  - File: `src/client/commands.ts:15-19`
  - Queue messages or dispatch an error event if socket unavailable.

- [ ] **[Medium-27]** Animations run unconditionally (vestibular disorder risk)
  - File: `src/client/Multiplier.svelte:69-93`
  - Wrap animations (.pulse, .crash-bg-flash, .crash-shake) in `@media (prefers-reduced-motion: no-preference) { ... }`.

- [ ] **[Medium-28]** CashoutButton loading state lacks aria-busy
  - File: `src/client/CashoutButton.svelte:31-35`
  - Add `aria-busy={isLoading}` and update `aria-label` during loading.

---

## WILL NOT IMPLEMENT

- **[Compliance-1]** Client-side balance storage with no server authority
  - Reason: This game is not for real money. May revisit if real-money play is ever considered.

- **[Compliance-2]** No responsible gambling features
  - Reason: This game is not for real money. May revisit if real-money play is ever considered.

- **[UX-3]** Client-side balance validation missing
  - Reason: We intentionally allow negative balances.

- **[Medium-10]** Storage recovery path missing (no admin endpoint)
  - Reason: No auth system exists, so admin routes are not feasible at this time.

- **[Medium-29]** No minimum age verification or jurisdictional notice
  - Reason: Not for real money; no legal exposure at this time.

- **[Medium-30]** No transaction history export
  - Reason: Not needed without server-side balance authority.

- **[Medium-31]** Bet confirmation lost between form submit and server acknowledgment
  - Reason: Addressed partially by High-6 (IMPLEMENT LATER).

- **[Medium-32]** Terms of service not displayed or required
  - Reason: Not for real money; not needed at this time.

