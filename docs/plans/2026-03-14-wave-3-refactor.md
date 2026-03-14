# Wave 3 Refactor — Implementation Plan

**Date:** 2026-03-14
**Spec:** [docs/specs/2026-03-13-wave-3-refactor.md](../specs/2026-03-13-wave-3-refactor.md)
**Approach:** TDD, agent swarm, parallelized PRs

---

## PR Map

| PR | Issues | Branch | Depends On |
|----|--------|--------|------------|
| PR-A | High-24 + High-25 | `phase-6-2-3-eliminate-custom-events` | — |
| PR-B | Medium-18 | `phase-9-1-props-rune` | — |
| PR-C | Medium-22 + Medium-13 | `phase-medium-22-13-server-logging` | — |
| PR-D | Medium-19 | `phase-9-2-derived-rune` | PR-B merged |
| PR-E | Medium-20 | `phase-9-3-cashout-ack` | PR-A merged |

Round 1 (parallel): PR-A, PR-B, PR-C
Round 2 (parallel, after dependencies merge): PR-D, PR-E

---

## PR-A: [High-24+25] Eliminate Dual Dispatch

**Branch:** `phase-6-2-3-eliminate-custom-events`

### Step 1 — Tests first

**File:** `src/client/lib/__tests__/stores.test.ts`
- Add tests: `lastCrashResult`, `lastPendingPayout`, `lastError` stores exist and are writable with correct initial values (null)

**File:** `src/client/lib/__tests__/messageHandler.test.ts` (existing)
- Add/update tests:
  - On `stateSnapshot` message with phase CRASHED: `lastCrashResult` store is set to the snapshot; no CustomEvent dispatched
  - On `pendingPayout` message: `lastPendingPayout` store is set; no CustomEvent dispatched
  - On `error` message: `lastError` store is set to message string; no CustomEvent dispatched
  - Existing behavioral tests still pass (gameState, players, history still updated correctly)

**File:** `src/client/__tests__/App.test.ts` (existing component tests)
- Update crash result tests: instead of dispatching `crash:crashed` CustomEvent, set `lastCrashResult` store
- Update pending payout tests: instead of dispatching `crash:pendingPayout` CustomEvent, set `lastPendingPayout` store
- Verify `hasPendingResult` guard still prevents double-application

**File:** `src/client/__tests__/BetForm.test.ts` (existing component tests)
- Update error display tests: instead of dispatching `crash:error` CustomEvent, set `lastError` store

### Step 2 — Implementation

**File:** `src/client/lib/stores.ts`
- Add three new writable stores:
  ```typescript
  export const lastCrashResult = writable<GameStateSnapshot | null>(null);
  export const lastPendingPayout = writable<PendingPayoutMessage | null>(null);
  export const lastError = writable<string | null>(null);
  ```
- Import `GameStateSnapshot` and `PendingPayoutMessage` from types if not already imported

**File:** `src/client/lib/messageHandler.ts`
- Import `lastCrashResult`, `lastPendingPayout`, `lastError` from stores
- Replace `window.dispatchEvent(new CustomEvent('crash:crashed', { detail: snapshot }))` with `lastCrashResult.set(snapshot)`
- Replace `window.dispatchEvent(new CustomEvent('crash:pendingPayout', { detail: msg }))` with `lastPendingPayout.set(msg)`
- Replace `window.dispatchEvent(new CustomEvent('crash:error', { detail: { message: msg.message } }))` with `lastError.set(msg.message)`
- Remove all CustomEvent imports/usage

**File:** `src/client/App.svelte`
- Import `lastCrashResult`, `lastPendingPayout` from stores
- Remove `window.addEventListener('crash:crashed', handleCrashedResult)` and `window.addEventListener('crash:pendingPayout', handlePendingPayout)`
- Remove corresponding `window.removeEventListener` calls from onDestroy
- Add `$effect` blocks:
  ```svelte
  $effect(() => {
    const result = $lastCrashResult;
    if (result) {
      handleCrashedResult(result);
      lastCrashResult.set(null);
    }
  });
  $effect(() => {
    const payout = $lastPendingPayout;
    if (payout) {
      handlePendingPayout(payout);
      lastPendingPayout.set(null);
    }
  });
  ```
- Update `handleCrashedResult` and `handlePendingPayout` signatures to accept the typed value directly (not an Event)
- Verify `hasPendingResult` guard remains in place

**File:** `src/client/components/BetForm.svelte`
- Import `lastError` from stores
- Remove `window.addEventListener('crash:error', handleErrorEvent)` and onDestroy cleanup
- Add reactive statement or `$effect` to watch `$lastError`:
  ```svelte
  $effect(() => {
    if ($lastError) {
      errorMessage = $lastError;
      lastError.set(null);
    }
  });
  ```

### Step 3 — High-25 verification
- Search entire codebase for remaining `CustomEvent` usage — must be zero instances of `crash:` events
- Search for any remaining `as GameStateSnapshot`, `as PendingPayoutMessage` casts on event detail — must be zero
- Typecheck passes: `npm run typecheck`

### Step 4 — Review pass
- Run `npm run test` (unit + store tests)
- Run component tests: `~/.nvm/versions/node/v20.20.1/bin/node ./node_modules/.bin/vitest run --config vitest.svelte.config.ts`
- Run `npm run lint` and `npm run check`
- Verify no `window.addEventListener` calls remain for crash: events

---

## PR-B: [Medium-18] `$props()` Migration

**Branch:** `phase-9-1-props-rune`

### Step 1 — Tests first
**File:** `src/client/__tests__/VerifyModal.test.ts` (existing)
- Read existing tests — they should already pass props via `render({ props: { entry, onClose } })`
- The `$props()` change is transparent to the testing API; tests should pass without modification
- Run tests in isolation to confirm current state (they should be green already)

### Step 2 — Implementation

**File:** `src/client/components/VerifyModal.svelte`
- Replace:
  ```svelte
  <script lang="ts">
    export let entry: HistoryEntry;
    export let onClose: () => void;
  ```
- With:
  ```svelte
  <script lang="ts">
    let { entry, onClose }: { entry: HistoryEntry; onClose: () => void } = $props();
  ```

### Step 3 — Review pass
- Run component tests
- Run `npm run typecheck`
- Run `npm run lint`

---

## PR-C: [Medium-22 + Medium-13] Server Validation Logging

**Branch:** `phase-medium-22-13-server-logging`

### Step 1 — Tests first

**File:** `src/server/__tests__/crash-game.test.ts` or equivalent unit test file
- Add test: when `onMessage` receives a message that fails `isValidClientMessage`, `console.warn` is called with args including the connection ID and attempted type
- Add test: when `onMessage` receives a valid but unknown message type (if possible to construct), `console.warn` is called indicating unknown type
- Use `vi.spyOn(console, 'warn')` to capture calls

### Step 2 — Implementation

**File:** `src/server/crash-game.ts`
- In `onMessage()`, after the `isValidClientMessage(parsed)` check fails:
  ```typescript
  console.warn('[onMessage] rejected invalid message', {
    connId: conn.id,
    type: typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>).type
      : undefined,
  });
  ```
- After the if-else chain for known message types, add a final else with warn:
  ```typescript
  } else {
    console.warn('[onMessage] unknown message type', { connId: conn.id, type: (msg as { type: string }).type });
  }
  ```
  Note: This else may be unreachable if `isValidClientMessage` enforces all known types — but it's valuable as a future-proofing defense.

### Step 3 — Review pass
- Run `npm run test`
- Run `npm run typecheck:server`
- Run `npm run lint`

---

## PR-D: [Medium-19] `$derived()` Migration

**Branch:** `phase-9-2-derived-rune`
**Depends on:** PR-B merged (to avoid conflicts in Svelte component script blocks)

### Step 1 — Tests first
- Component tests for BetForm and GameStatus should already be green
- Run in isolation before making changes to capture baseline

### Step 2 — Implementation

**File:** `src/client/components/BetForm.svelte`
- Replace:
  ```svelte
  $: wagerNum = parseFloat(wager);
  $: autoCashoutNum = autoCashoutStr ? parseFloat(autoCashoutStr) : null;
  $: isValid = !isNaN(wagerNum) && wagerNum >= MIN_WAGER && wagerNum <= MAX_WAGER;
  ```
- With:
  ```svelte
  const wagerNum = $derived(parseFloat(wager));
  const autoCashoutNum = $derived(autoCashoutStr ? parseFloat(autoCashoutStr) : null);
  const isValid = $derived(!isNaN(wagerNum) && wagerNum >= MIN_WAGER && wagerNum <= MAX_WAGER);
  ```
- Verify no other assignments to these variable names exist in the component

**File:** `src/client/components/GameStatus.svelte`
- Replace:
  ```svelte
  $: countdownSec = Math.ceil($countdown / 1000);
  $: playerCount = Object.keys($players).length;
  ```
- With:
  ```svelte
  const countdownSec = $derived(Math.ceil($countdown / 1000));
  const playerCount = $derived(Object.keys($players).length);
  ```

### Step 3 — Review pass
- Run component tests
- Run `npm run typecheck`
- Run `npm run lint`

---

## PR-E: [Medium-20] CashoutButton Server ACK

**Branch:** `phase-9-3-cashout-ack`
**Depends on:** PR-A merged (avoids merge conflicts in stores.ts; `isInRound` already imported)

### Step 1 — Tests first

**File:** `src/client/__tests__/CashoutButton.test.ts` (existing or new)
- Add test: after `sendCashout()` is called (mocked), setting `isInRound` store to false causes `isLoading` to become false
- Add test: if server never responds and `isInRound` stays true, button re-enables after 5 seconds (use fake timers)
- Add test: double-click guard still works (second click while `isLoading` is a no-op)

### Step 2 — Implementation

**File:** `src/client/components/CashoutButton.svelte`
- Replace the `setTimeout(() => { isLoading = false }, 2000)` pattern:
  ```svelte
  let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

  function handleCashout() {
    if (isLoading) return;
    isLoading = true;
    sendCashout();
    fallbackTimer = setTimeout(() => { isLoading = false; }, 5000);
  }

  $effect(() => {
    if (!$isInRound && isLoading) {
      clearTimeout(fallbackTimer);
      isLoading = false;
    }
  });
  ```

### Step 3 — Review pass
- Run component tests
- Run `npm run typecheck`
- Run `npm run lint`

---

## Final Self-Correction Passes (after all PRs)

After all 5 PRs are merged:
1. Run full test suite: `npm run test`
2. Run full component test suite
3. Run `npm run typecheck` and `npm run typecheck:server`
4. Run `npm run lint` and `npm run check`
5. Search for any remaining `CustomEvent` with `crash:` prefix — must be zero
6. Search for any remaining `$:` in Svelte components (excluding `$store` references) — must be zero in migrated files
7. Search for any remaining `export let` in component script blocks — must be zero in VerifyModal

---

## Node Version Note

All component tests must be run with:
```
~/.nvm/versions/node/v20.20.1/bin/node ./node_modules/.bin/vitest run --config vitest.svelte.config.ts
```

Worker tests: `npm run test:workers` (known pre-existing failure with `crypto.hash`)
