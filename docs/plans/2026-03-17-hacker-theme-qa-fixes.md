# Hacker Theme QA Fixes — Implementation Plan

**Spec**: `docs/specs/2026-03-17-hacker-theme-qa-fixes.md`
**Date**: 2026-03-17
**Status**: Draft — Updated after mockup session (B2/B3 rewritten, Wave E merged into B2)

---

## Overview

10 issues from the Wave 10e Visual QA pass (Fix 11 merged into Fix 6). Organized into 4 waves by dependency profile. All CSS/layout/config fixes — no new stores, no new dependencies. One new shared module (`crash-agency.ts`).

**No server API changes.** `config.ts` is shared but Fix 9 is a safe timing constant edit.

**Mockup references**: `docs/mockups/crash-transition-mockup.html` (Option A), `docs/mockups/cashout-transition-mockup.html` (Option A).

**TDD note**: Most fixes are CSS/structural with no testable logic. Tests are written where behavior assertions are meaningful (hostname format, character pool content, config value).

---

## Wave A — Independent One-File Fixes (run concurrently)

All steps in Wave A touch disjoint files and can be assigned to parallel agents.

---

### Step A1 — Fix 1: `[ verify ]` Button Wrapping

**File**: `src/client/components/History.svelte`

```css
/* Add to .verify-btn */
white-space: nowrap;

/* Add to .crash-point */
overflow: hidden;
text-overflow: ellipsis;
max-width: 4.5rem;
```

**Tests**: Update `History.test.ts` — add a test that verifies no wrapping by confirming the button element has `white-space: nowrap` via computed style, OR just verify that `[ verify ]` renders as a single inline element. (Low value test — skip if it requires jsdom computed-style hacks; the visual fix is trivially verifiable by eye.)

---

### Step A2 — Fix 9: Crash Duration 10s

**File**: `src/config.ts`

```typescript
export const CRASHED_DISPLAY_MS = 10_000; // was 5_000
```

**Tests**: No unit test needed — it's a constant. Visual QA confirms.

---

### Step A3 — Fix 7: Hostname FQDNs

**File**: `src/client/lib/prng.ts`

Replace the `HOSTNAMES` array with FQDNs. Use a mix of corporate TLDs (`.corp`, `.io`, `.net`, `.internal`) and believable subdomains:

```typescript
const HOSTNAMES = [
  'api.nexus-biotech.net',
  'db-primary.ellingson.corp',
  'mail.orca-capital.io',
  'cdn-prod.axiom-financial.net',
  'auth.meridian-labs.corp',
  'backup.atlas-defense.internal',
  'gateway.massive-dynamic.io',
  'cache.veridian-dynamics.net',
  'svc.northside-digital.corp',
  'log-agg.initech-systems.internal',
];
```

The `stable.hostname` in `terminal-content.ts` draws from a separate inline array — update it to match the same FQDN style:

```typescript
hostname: seededPick(
  [
    'api.nexus-biotech.net',
    'db-primary.ellingson.corp',
    'mail.orca-capital.io',
    'cdn-prod.axiom-financial.net',
    'auth.meridian-labs.corp',
  ],
  stableRng,
),
```

**Tests**: `src/client/lib/__tests__/prng.test.ts` — add assertion that every entry in `HOSTNAMES` contains a `.` (is FQDN-like). Or just verify `generateRoundTarget()` returns a hostname that matches `/\.\w+$/`.

---

### Step A4 — Fix 8a: Terminal Corruption Characters

**File**: `src/client/lib/terminal-content-pools.ts`

Replace mid-word `██` with `??` in TIER5. Standalone `██ TEXT ██` blocks in TIER6 remain (intentional visual framing):

```typescript
// TIER5 — change:
{ text: '[!] li██ integrity fa██ure on {iface}', ... }
// →
{ text: '[!] link integrity fa??ure on {iface}', ... }

{ text: '[ERR] {iface}: li██ is not re░dy', ... }
// →
{ text: '[ERR] {iface}: link is not re??dy', ... }
```

Note: `░` (U+2591) in `re░dy` is also mid-word — replace with `??`:
`'[ERR] {iface}: link is not re??dy'`

TIER6 standalone blocks (`██ DISCONNECT NOW ██`, etc.) are intentional — leave unchanged.

Progress bar `█` / `░` characters remain — they are clearly a progress bar and render correctly.

**Tests**: Scan `TIER5` array in the test — assert no entry contains the pattern `/\w██\w/` or `/\w░\w/` (mid-word block chars). Simple string assertion.

---

### Step A5 — Fix 8b: CJK Font Fallback (system-ui approach)

Add a global CSS rule that applies `font-family: system-ui, sans-serif` to any element with a `.jp` class (or equivalent Japanese-text class). All components that render Japanese decorative text use a class like `.jp-accent`, `.side-jp`, `.modal-jp`, `.live-label`'s Japanese portion, etc.

**Approach**: Add a `:global` rule in `App.svelte` that targets all known Japanese-text classes:

```css
:global(.jp-accent),
:global(.side-jp),
:global(.modal-jp) {
  font-family: system-ui, sans-serif;
}
```

For classes scoped inside their own components (e.g. `.live-label` in Multiplier.svelte, `.panel-label` JP portions in History/PlayerList/ThreatPanel), add `font-family: system-ui, sans-serif` directly in those components' scoped CSS for the relevant rule.

No changes to `index.html`. No new network requests.

**Tests**: None — font rendering is not testable in jsdom.

---

### Step A6 — Fix 10: History Multiplier Colors → Threat Palette

**Files**:
- `src/client/lib/threat.ts` — add `getThreatColor` helper
- `src/client/components/History.svelte` — swap `getRarityColor` for `getThreatColor`
- `src/client/components/__tests__/History.test.ts` — update color assertions

**threat.ts** — add one exported function:

```typescript
/** Returns the threat-palette hex color for a given multiplier value. */
export function getThreatColor(multiplier: number): string {
  return getDangerColors(getThreatLevel(multiplier)).color;
}
```

**History.svelte** — update import and usage:

```svelte
<!-- Remove: import { getRarityColor } from '../lib/rarity'; -->
import { getThreatColor } from '../lib/threat';

<!-- In template: -->
<span class="crash-point" style:color={getThreatColor(entry.crashPoint)}>
```

**History.test.ts** — update the four color assertion tests. Current expected values (Borderlands):
- `1.23x` → `rgb(208, 208, 208)` (Common grey)
- `2.50x` → `rgb(0, 200, 83)` (Uncommon green)
- `5.75x` → `rgb(66, 165, 245)` (Rare blue)

New expected values (threat palette, using `getDangerColors(getThreatLevel(n)).color`):
- `1.23x` (GHOST) → `#ffb000` → `rgb(255, 176, 0)`
- `2.50x` (ELEVATED) → `#ff8c00` → `rgb(255, 140, 0)`
- `5.75x` (HIGH) → `#ff6600` → `rgb(255, 102, 0)`

Add a fourth test for CRITICAL range to match the new tier coverage:
- `30.0x` (CRITICAL) → `#ff0040` → `rgb(255, 0, 64)`

**Tests**: Update 3 existing color tests + add 1 new CRITICAL test. `rarity.ts` and `getRarityColor` are unchanged; no other tests affected.

---

## Wave B — Layout Restructuring (B1 independent; B2 and B3 are the main layout changes)

---

### Step B1 — Fix 2: Terminal Fixed Height (Stop Button Jank)

**File**: `src/client/App.svelte`

The `TerminalDisplay` in the RUNNING branch currently has `maxHeight="280px"` but starts at 0 height. Wrap it in a container with a matching minimum height:

```svelte
<div class="terminal-wrapper">
  <TerminalDisplay lines={$terminalLines} maxHeight="280px" threatLevel={$threatLevel} />
</div>
```

```css
.terminal-wrapper {
  min-height: 280px;
  display: flex;
  flex-direction: column;
}
```

This keeps the action-area (CashoutButton) anchored below a consistently-sized slot.

**Tests**: No automated test — visually verified. The button should not move between the first and 50th terminal line.

---

### Step B2 — Fix 6 + Fix 11 (merged): Crash Panel — Full Main-Column Takeover

> **Mockup reference**: `docs/mockups/crash-transition-mockup.html` — Option A (FBI and NSA variants).

This step consolidates Fix 6 (crash sidebar preservation) and Fix 11 (crash layout augmentation) into a single unified approach: the crash panel takes over the full main column (v3 Option A style), terminal is hidden, sidebar stays visible.

**Sub-step B2a — Extract `pickAgency()` to shared module**

**New file**: `src/client/lib/crash-agency.ts`

Move `pickAgency()`, `randomDigits()`, `randomAlpha()`, and `RIVAL_HANDLES` out of `CrashScreen.svelte`:

```typescript
export type AgencyEntry = { name: string; subtitle: string; caseRef: string };
export function pickAgency(): AgencyEntry { /* existing impl */ }
```

Update `CrashScreen.svelte` to import from the new module. No behavioral change yet.

**Tests**: `src/client/lib/__tests__/crash-agency.test.ts` — test that `pickAgency()` returns an object with `name`, `subtitle`, and `caseRef` string fields.

---

**Sub-step B2b — Simplify CrashScreen.svelte**

**File**: `src/client/components/CrashScreen.svelte`

Remove the `.side-panel` (status readout, agency block). The status readout information (PROXIES, COVER, IDS) is already displayed by the sidebar's ThreatPanel. Move agency name + case reference into the `.main-content` area:

```svelte
<div class="crash-screen">
  <div class="vhs-band"></div>
  <div class="hazard-stripe top"></div>
  <div class="main-content">
    <div class="jp-accent">警告 — 追跡完了</div>
    <div class="traced">TRACED</div>
    <div class="subtitle">{agency.subtitle}</div>
    <div class="crash-multiplier">{crashPoint.toFixed(2)}x</div>
    <div class="agency-divider"></div>
    <div class="agency-name">{agency.name}</div>
    {#if agency.caseRef}
      <div class="case-ref">{agency.caseRef}</div>
    {/if}
    {#if !isSpectator}
      <div class="funds-seized">ALL FUNDS SEIZED</div>
    {/if}
  </div>
  <div class="hazard-stripe bottom"></div>
</div>
```

CSS changes:
- Remove `.side-panel`, `.side-jp`, `.side-title`, `.readout-row`, `.rk`, `.rv` rules.
- `.crash-screen` changes from `display: flex` to `display: flex; flex-direction: column` (no longer side-by-side).
- Add `.agency-divider`, `.agency-name`, `.case-ref` styles (moved from side panel).
- Keep hazard stripes, VHS band, `.main-content` centered layout.

**Tests**: `CrashScreen.test.ts` — update tests:
- Remove assertions for status readout text (PROXIES, COVER, IDS).
- Add assertions for agency name rendering in main content area.
- Existing tests for TRACED, crashPoint display, funds-seized remain valid.

---

**Sub-step B2c — App.svelte: Crash layout integration**

**File**: `src/client/App.svelte`

1. Remove `.full-span` wrapper from the CRASHED branch.
2. Add sidebar alongside CrashScreen.
3. Update `showCashoutScreen` to exclude CRASHED phase:

```typescript
// Was: hasCashedOutThisRound && ($phase === 'RUNNING' || $phase === 'CRASHED')
const showCashoutScreen = $derived(
  hasCashedOutThisRound && $phase === 'RUNNING',
);
```

4. Reorder template branches so CRASHED comes before the cashout/RUNNING check:

```svelte
{:else if $phase === 'CRASHED'}
  <CrashScreen
    crashPoint={$gameState?.crashPoint ?? 0}
    isSpectator={!wasInRound}
  />
  <aside class="sidebar">
    <PlayerList />
    <ThreatPanel threatLevel={$threatLevel} multiplier={$displayMultiplier} />
    <History />
  </aside>
```

**Tests**: `App.test.ts` — add tests:
- During CRASHED phase, CrashScreen is rendered (TRACED text visible).
- During CRASHED phase, sidebar is present (PlayerList visible).
- During CRASHED phase with prior cashout, crash panel is shown (not cashout screen).

---

### Step B3 — Fix 4: Cashout — Live Multiplier + Cashout Card

> **Mockup reference**: `docs/mockups/cashout-transition-mockup.html` — Option A (Tier 1 and Tier 2).

The cashout confirmation no longer takes over the full grid. Instead, the RUNNING layout skeleton is preserved: the multiplier stays live at top, and CashoutScreen replaces the terminal + action area below it. Sidebar stays visible.

**File**: `src/client/App.svelte`

Restructure the RUNNING (`{:else}`) branch to support the cashout sub-state:

```svelte
{:else}
  <div class="game-area">
    <div class="multiplier-section">
      <Multiplier />
      <ThreatMeter multiplier={$displayMultiplier} threatLevel={$threatLevel} />
    </div>
    {#if showCashoutScreen}
      <CashoutScreen
        payout={lastCashoutPayout}
        cashoutMultiplier={lastCashoutMultiplier}
        threatLevel={$cashoutThreatLevel ?? 'GHOST'}
      />
    {:else}
      <div class="terminal-wrapper">
        <TerminalDisplay lines={$terminalLines} maxHeight="280px" threatLevel={$threatLevel} />
      </div>
      <div class="action-area">
        {#if $isInRound || hasCashedOutThisRound}
          <CashoutButton />
        {:else if $phase === 'RUNNING'}
          <ObserverBanner threatLevel={$threatLevel} />
        {/if}
      </div>
    {/if}
  </div>
  <aside class="sidebar">
    <PlayerList />
    <ThreatPanel threatLevel={$threatLevel} multiplier={$displayMultiplier} />
    <History />
  </aside>
{/if}
```

**File**: `src/client/components/CashoutScreen.svelte`

Minor adjustments:
- Remove or reduce `min-height: 400px` — the component no longer fills a full-span area. Use `min-height: 280px` to match the terminal slot it replaces.
- Verify padding/sizing works at main-column width (~600–700px).

**Tests**: `App.test.ts` — add tests:
- During RUNNING with cashout, multiplier is visible (LIVE HACK label present).
- During RUNNING with cashout, CashoutScreen is rendered.
- During RUNNING with cashout, terminal is NOT rendered.
- `CashoutScreen.test.ts` — existing tests remain valid.

---

## Wave C — Header Interaction Fix

### Step C1 — Fix 5: Handle Bracket Affordance

**File**: `src/client/App.svelte`

Update the header name button to bracket-style:

```svelte
{#if $myPlayerName}
  <span class="sep">@</span>
  <button class="name-btn" onclick={() => (nameModalOpen = true)}>[ {$myPlayerName} ]</button>
{:else}
  <button class="name-btn" onclick={() => (nameModalOpen = true)}>[ set handle ]</button>
{/if}
```

The `.name-btn` CSS style stays the same (dim amber, matches bracket-button idiom). The brackets communicate interactivity without a tooltip or explicit label.

**Tests**: `App.test.ts` — update any test that checks for bare `$myPlayerName` text to also check for bracket wrapping, OR check for the button's text content pattern.

---

## Wave D — BetForm Prominence

### Step D1 — Fix 3: Column Swap and Visual Weight

**File**: `src/client/App.svelte`

Swap the column order in the lobby template:

```svelte
<div class="lobby-panels">
  <BetForm />
  <TargetInfo target={$roundTarget} />
</div>
```

**File**: `src/client/components/BetForm.svelte`

Increase visual weight:
- Change the outer `.bet-form` border from `var(--color-border)` to `var(--color-primary-mid)` — make it brighter.
- Change `.panel-label` color from `var(--color-primary-dim)` to `var(--color-primary-mid)`.
- Keep all other styles the same.

```css
/* In BetForm.svelte */
.bet-form {
  border: 1px solid var(--color-primary-mid); /* was --color-border */
}

.panel-label {
  color: var(--color-primary-mid); /* was --color-primary-dim */
}
```

**Tests**: No test changes needed (BetForm test covers behavior, not color values).

---

## ~~Wave E~~ — Merged into Wave B

> Fix 11 (crash state integration) has been merged into Step B2. The original Wave E approach ("augment multiplier section, keep terminal visible") was replaced by a simpler full main-column takeover based on the 2026-03-17 mockup session. CrashScreen.svelte is kept and simplified rather than retired.

---

## Dependency Graph

```
Wave A (A1, A2, A3, A4, A5, A6) — all independent, run concurrently
       ↓
Wave B (B1, B2, B3) — sequential within wave:
  B1: terminal fixed height (RUNNING only — unblocks B3's terminal-wrapper CSS)
  B2: crash panel (B2a → B2b → B2c — extract pickAgency, simplify CrashScreen, wire into App)
  B3: cashout layout (restructure RUNNING branch, depends on B1 terminal wrapper)
  NOTE: B2 and B3 both touch App.svelte template — run B2 before B3
       ↓
Wave C (C1) — independent, can run alongside A or after B
       ↓
Wave D (D1) — independent, can run alongside A/C or after B
```

Wave A is fully parallel. Wave B is sequential (B1 → B2 → B3). Waves C and D can run alongside any wave.

---

## Files Changed

| File | Fixes |
|------|-------|
| `src/config.ts` | A2 (crash duration) |
| `src/client/App.svelte` | A5 (jp CSS), B1 (terminal wrapper), B2c (crash layout), B3 (cashout layout), C1 (handle brackets), D1 (column swap) |
| `src/client/components/CrashScreen.svelte` | B2b (simplify — remove side-panel, integrate agency into main) |
| `src/client/components/CashoutScreen.svelte` | B3 (reduce min-height for main-column fit) |
| `src/client/components/History.svelte` | A1 (verify button), A6 (threat colors) |
| `src/client/components/BetForm.svelte` | D1 (border brightness) |
| `src/client/lib/prng.ts` | A3 (FQDNs) |
| `src/client/lib/terminal-content.ts` | A3 (stable hostname pool) |
| `src/client/lib/terminal-content-pools.ts` | A4 (corruption chars) |
| `src/client/lib/threat.ts` | A6 (`getThreatColor` helper) |
| `src/client/lib/crash-agency.ts` | B2a (new file — extracted from CrashScreen) |
| `src/client/components/__tests__/CrashScreen.test.ts` | B2b (update assertions — remove status readout, add agency in main) |
| `src/client/components/__tests__/History.test.ts` | A1 (white-space), A6 (threat color assertions) |
| `src/client/lib/__tests__/prng.test.ts` | A3 (FQDN assertion) |
| `src/client/lib/__tests__/threat.test.ts` | A6 (`getThreatColor` tests) |
| `src/client/lib/__tests__/crash-agency.test.ts` | B2a (pickAgency tests) |
| `src/client/components/__tests__/App.test.ts` | B2c (crash layout tests), B3 (cashout layout tests), C1 (bracket handle) |

---

## Review Self-Assessment

**Spec completeness**: All 10 issues have clear desired states and explicit solutions (Fix 11 merged into Fix 6). Approved mockups provide visual targets for the two most complex changes (B2, B3).

**Implementation risk**:
- **B2 (crash panel)** is the highest-risk step: CrashScreen.svelte's internal layout changes (removing side-panel, restructuring to single-column) require updating both the component and its tests. The App.svelte template reordering (CRASHED before cashout check) plus the `showCashoutScreen` scope change must be done atomically to avoid a state where cashout overrides crash display.
- **B3 (cashout layout)**: CashoutScreen was designed at full-span width. At main-column width it may need `min-height` and padding adjustments. The template restructuring nests CashoutScreen inside the RUNNING `{:else}` branch alongside Multiplier + ThreatMeter — this is a significant template change.
- **B2 + B3 interaction**: Both touch App.svelte's main template. B2 must land before B3 to avoid merge conflicts. The `showCashoutScreen` derived expression is modified in B2c and relied upon in B3.
- **A3 (FQDN hostnames)**: Two separate hostname arrays (prng.ts and terminal-content.ts stable pool) must both be updated to FQDNs.
- **A5 (system-ui for Japanese)**: System-ui renders Japanese in a proportional sans-serif, not monospace. This is acceptable for decorative labels but should be checked visually — if it looks wrong, the fallback is a `font-size` reduction to compensate for different character widths.

**Simplification vs old plan**: The old Wave E (4 sequential steps, Multiplier.svelte changes, crash terminal line `$effect`, CrashScreen retirement) has been replaced by B2 (3 sub-steps, CrashScreen simplification, no Multiplier.svelte changes needed). The new approach is less invasive — CrashScreen stays in the render tree, just simplified.

**What's NOT in this plan**: Anything requiring server logic changes beyond `config.ts`, new npm packages, or new WebSocket message types.
