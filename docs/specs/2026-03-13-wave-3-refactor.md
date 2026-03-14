# Wave 3 Refactor — Specification

**Date:** 2026-03-13
**Issues:** High-24, High-25, Medium-18, Medium-19, Medium-20, Medium-22 (+Medium-13 logging)

---

## Overview

Wave 3 completes the remaining IMPLEMENT IMMEDIATELY items from the post-MVP hardening plan. There are two independent workstreams:

- **Workstream A (Client Architecture):** High-24 → High-25 + Medium-20 (sequential)
- **Workstream B (Svelte 5 Migration):** Medium-18 → Medium-19 (sequential)
- **Workstream C (Server Logging):** Medium-22 + Medium-13 (independent)

Workstreams B and C can run in parallel with A. High-25 and Medium-20 depend on High-24.

---

## Issue Specifications

---

### High-24: Eliminate Dual Dispatch Pattern

**Problem:**
`messageHandler.ts` dispatches both store updates AND `window` CustomEvents for the same data. `App.svelte` and `BetForm.svelte` listen to CustomEvents to respond to game state changes. This creates two parallel channels for the same information, making it hard to trace data flow and test.

**Current CustomEvent flow:**
```
messageHandler.ts dispatches:
  window.dispatchEvent(new CustomEvent('crash:crashed', { detail: GameStateSnapshot }))
  window.dispatchEvent(new CustomEvent('crash:pendingPayout', { detail: pendingPayoutMsg }))
  window.dispatchEvent(new CustomEvent('crash:error', { detail: { message: string } }))

Listeners:
  App.svelte: 'crash:crashed' → handleCrashedResult()
  App.svelte: 'crash:pendingPayout' → handlePendingPayout()
  BetForm.svelte: 'crash:error' → handleErrorEvent() → sets errorMessage
```

**Solution:**
Add three new writable stores and replace all CustomEvent dispatch/listen with store writes/reads.

**New stores (add to `stores.ts`):**
- `lastCrashResult: Writable<GameStateSnapshot | null>` — set when phase transitions to CRASHED
- `lastPendingPayout: Writable<PendingPayoutMessage | null>` — set when server sends pending payout
- `lastError: Writable<string | null>` — set when server sends an error message

**Changes to `messageHandler.ts`:**
- Replace `window.dispatchEvent(new CustomEvent('crash:crashed', ...))` with `lastCrashResult.set(snapshot)`
- Replace `window.dispatchEvent(new CustomEvent('crash:pendingPayout', ...))` with `lastPendingPayout.set(msg)`
- Replace `window.dispatchEvent(new CustomEvent('crash:error', ...))` with `lastError.set(msg.message)`

**Changes to `App.svelte`:**
- Remove `window.addEventListener('crash:crashed', ...)` and `window.addEventListener('crash:pendingPayout', ...)`
- Replace with `$effect(() => { if ($lastCrashResult) { handleCrashedResult($lastCrashResult); lastCrashResult.set(null); } })`
- Same pattern for `$lastPendingPayout`

**Changes to `BetForm.svelte`:**
- Remove `window.addEventListener('crash:error', ...)`
- Replace with reactive `$effect` or reactive statement watching `$lastError`
- Clear `lastError` after consuming

**Behavioral invariants (must be preserved):**
- `hasPendingResult(roundId)` guard still prevents double-application of crash results
- Balance accounting (applyBet, applyCashout) still fires exactly once per round
- Pending payout toast still appears and dismisses after 4 seconds
- Error message in BetForm still appears when server rejects a join

---

### High-25: Type-Safe Event Detail Handling

**Problem:**
The CustomEvent handlers in App.svelte cast event.detail without null safety:
```typescript
const detail = e.detail as GameStateSnapshot  // no null check
const detail = e.detail as PendingPayoutMessage  // no null check
```

**Solution:**
This issue is fully resolved as a side effect of High-24. Once CustomEvents are eliminated, all data flows through typed Svelte stores with proper TypeScript types. No null-cast event detail reads remain.

If any CustomEvents are NOT eliminated in High-24, typed event factories with runtime validation are required instead. The spec for High-24 fully eliminates all three events, so High-25 requires no additional implementation work beyond verifying that no `as EventType` casts remain in the CustomEvent handlers after High-24.

---

### Medium-18: Convert `export let` to `$props()`

**Problem:**
Two components use the Svelte 4 `export let` prop syntax instead of Svelte 5 `$props()` runes.

**Affected components:**

**`VerifyModal.svelte`:**
```svelte
<!-- Before -->
export let entry: HistoryEntry;
export let onClose: () => void;

<!-- After -->
let { entry, onClose }: { entry: HistoryEntry; onClose: () => void } = $props();
```

**`History.svelte`:**
- No `export let` props found — no changes needed.

**`BetForm.svelte`:**
- No `export let` props found — no changes needed.

**Test impact:**
- Component tests for VerifyModal that pass props via Svelte Testing Library need to be checked — `$props()` is compatible with `@testing-library/svelte`'s `render({ props: { ... } })` API and should require no test changes.

---

### Medium-19: Convert `$:` to `$derived()`

**Problem:**
Two components use Svelte 4 `$:` reactive declarations instead of Svelte 5 `$derived()` runes.

**Affected components:**

**`BetForm.svelte`:**
```svelte
<!-- Before -->
$: wagerNum = parseFloat(wager);
$: autoCashoutNum = autoCashoutStr ? parseFloat(autoCashoutStr) : null;
$: isValid = !isNaN(wagerNum) && wagerNum >= MIN_WAGER && wagerNum <= MAX_WAGER;

<!-- After -->
const wagerNum = $derived(parseFloat(wager));
const autoCashoutNum = $derived(autoCashoutStr ? parseFloat(autoCashoutStr) : null);
const isValid = $derived(!isNaN(wagerNum) && wagerNum >= MIN_WAGER && wagerNum <= MAX_WAGER);
```

**`GameStatus.svelte`:**
```svelte
<!-- Before -->
$: countdownSec = Math.ceil($countdown / 1000);
$: playerCount = Object.keys($players).length;

<!-- After -->
const countdownSec = $derived(Math.ceil($countdown / 1000));
const playerCount = $derived(Object.keys($players).length);
```

**Note:** `$derived()` values are `const` — any code that tries to assign to them will cause a compile error. Verify no assignment to these variables exists elsewhere in the component.

**Test impact:** Behavioral parity — no test changes expected.

---

### Medium-20: CashoutButton Server ACK Instead of Timeout

**Problem:**
`CashoutButton.svelte` resets its loading state after a 2-second hardcoded timeout regardless of whether the server acknowledged the cashout. If the server is slow, the button re-enables before the response arrives, potentially allowing a double-cashout attempt.

**Solution:**
Watch `$isInRound` store (already imported). When `$isInRound` transitions from `true` to `false`, the cashout was acknowledged (either via playerCashedOut message or phase transition). Reset `isLoading = false` reactively.

**Implementation:**
```svelte
<!-- Replace timeout with reactive reset -->
$effect(() => {
  if (!$isInRound) {
    isLoading = false;
  }
});
```

Keep a **5-second fallback timeout** (increased from 2s) in case the server never responds and the round doesn't transition (edge case: socket drop after send):
```typescript
let fallbackTimer: ReturnType<typeof setTimeout>;
function handleCashout() {
  if (isLoading) return;
  isLoading = true;
  sendCashout();
  fallbackTimer = setTimeout(() => { isLoading = false; }, 5000);
}
// Clear fallback when reactive reset fires first
$effect(() => {
  if (!$isInRound && isLoading) {
    clearTimeout(fallbackTimer);
    isLoading = false;
  }
});
```

**Depends on:** High-24 is not a hard dependency for this change, but should be merged first to minimize conflicts.

**Test impact:** Component test for CashoutButton should verify `isLoading` resets when `isInRound` goes false, not just after a timeout.

---

### Medium-22 + Medium-13: Server-Side Validation Logging

**Problem:**
`crash-game.ts` `onMessage()` calls `isValidClientMessage(parsed)` and sends a generic error to the client if it fails, but logs nothing server-side. Operators cannot observe malformed message patterns in Cloudflare logs.

Additionally, unknown message types are silently ignored after validation passes (Medium-13).

**Current code (simplified):**
```typescript
if (!isValidClientMessage(parsed)) {
  // sends error to client, but NO server-side log
  return;
}
// falls through to type-specific handlers
// no exhaustive check for unknown types after validation
```

**Solution:**

1. **Log validation rejections:**
```typescript
if (!isValidClientMessage(parsed)) {
  console.warn('[onMessage] rejected invalid message', {
    connId: conn.id,
    type: typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>).type : undefined,
  });
  conn.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
  return;
}
```

2. **Log unknown message types** (after the type-specific switch/if-else):
```typescript
// After all known type handlers:
console.warn('[onMessage] unknown message type', { connId: conn.id, type: msg.type });
```

**Note:** `isValidClientMessage()` is a type guard — once it passes, `msg` is typed as `ClientMessage`. The union of `ClientMessage` types should be exhaustive in the existing switch/if-else. The `console.warn` for unknown types is a defense-in-depth log for future type additions.

**Test impact:** Server-side logging does not affect observable behavior (no return value changes, no new messages sent). Tests should verify that the `console.warn` is called with appropriate arguments when an invalid message is received.

---

## Parallelization Plan

```
Round 1 (all parallel):
  Branch A: High-24 (messageHandler + App + BetForm)
  Branch B: Medium-18 (VerifyModal $props)
  Branch C: Medium-22 (server logging)

Round 2 (after High-24 merges):
  Branch D: High-25 (verify no casts remain — likely trivial)
  Branch E: Medium-19 (BetForm + GameStatus $derived, after Medium-18)
  Branch F: Medium-20 (CashoutButton ACK)
```

In practice, High-25 verification can be bundled into the High-24 PR since it has no independent implementation, making the effective PRs:

- **PR A:** [High-24+25] Eliminate dual dispatch, verify type safety
- **PR B:** [Medium-18] `$props()` migration
- **PR C:** [Medium-22+13] Server validation logging
- **PR D:** [Medium-19] `$derived()` migration (after B)
- **PR E:** [Medium-20] CashoutButton server ACK (after A)

---

## Acceptance Criteria

| Issue | Criteria |
|-------|----------|
| High-24+25 | No `window.addEventListener('crash:...')` or `window.dispatchEvent(new CustomEvent('crash:...')` in codebase; all existing component tests pass; balance accounting still correct |
| Medium-18 | VerifyModal uses `$props()`; all component tests pass |
| Medium-19 | BetForm and GameStatus use `$derived()`; all component tests pass |
| Medium-20 | CashoutButton `isLoading` resets when `isInRound` goes false; fallback timeout is 5s; component test verifies reactive reset |
| Medium-22+13 | `console.warn` called server-side when `isValidClientMessage` rejects; `console.warn` called for unknown message types; unit tests assert warn calls |
