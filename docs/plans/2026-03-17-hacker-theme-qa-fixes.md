# Hacker Theme QA Fixes — Implementation Plan

**Spec**: `docs/specs/2026-03-17-hacker-theme-qa-fixes.md`
**Date**: 2026-03-17
**Status**: Draft — Updated after second feedback pass (Waves E–G added for Fixes 13–20; Fixes 1–12 confirmed implemented)

---

## Overview

11 issues from the Wave 10e Visual QA pass and subsequent feedback (Fix 11 merged into Fix 6, Fix 12 added). Organized into 4 waves by dependency profile. All CSS/layout/config fixes — no new stores, no new dependencies. One new shared module (`crash-agency.ts`).

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

### Step A2 — Fix 9 + Fix 12: Timing Constants

**File**: `src/config.ts`

```typescript
export const WAITING_DURATION_MS = 15_000; // was 10_000 — more time to join
export const CRASHED_DISPLAY_MS = 10_000; // was 5_000 — more time to read crash
```

**Tests**: No unit test needed — they're constants. Visual QA confirms.

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
- `.crash-screen` gets `max-height: 500px` to prevent excessive stretching on tall windows. Content is vertically centered within this constraint.
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
3. **`showCashoutScreen` keeps its current scope** — `hasCashedOutThisRound && ($phase === 'RUNNING' || $phase === 'CRASHED')`. Players who cashed out see their cashout confirmation persist through the crash phase. The crash panel only shows for players who were still in the round (lost) or spectators.
4. Template priority: `showCashoutScreen` check comes **before** the CRASHED branch. If the player cashed out, they see cashout through the entire round including crash:

```svelte
{#if showCashoutScreen}
  <!-- Cashout card with live multiplier — persists through CRASHED -->
  <div class="game-area">
    <div class="multiplier-section">
      <Multiplier />
      {#if $phase !== 'CRASHED'}
        <ThreatMeter multiplier={$displayMultiplier} threatLevel={$threatLevel} />
      {/if}
    </div>
    <CashoutScreen
      payout={lastCashoutPayout}
      cashoutMultiplier={lastCashoutMultiplier}
      threatLevel={$cashoutThreatLevel ?? 'GHOST'}
    />
  </div>
  <aside class="sidebar">
    <PlayerList />
    <ThreatPanel threatLevel={$threatLevel} multiplier={$displayMultiplier} />
    <History />
  </aside>
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
- During CRASHED phase (no cashout), CrashScreen is rendered (TRACED text visible).
- During CRASHED phase (no cashout), sidebar is present (PlayerList visible).
- During CRASHED phase with prior cashout, cashout screen persists (not crash panel).

---

### Step B3 — Fix 4: Cashout — Live Multiplier + Cashout Card

> **Mockup reference**: `docs/mockups/cashout-transition-mockup.html` — Option A (Tier 1 and Tier 2).

The cashout confirmation no longer takes over the full grid. Instead, the RUNNING layout skeleton is preserved: the multiplier stays live at top, and CashoutScreen replaces the terminal + action area below it. Sidebar stays visible. The cashout screen persists through the CRASHED phase — players who cashed out see their success message rather than the crash panel.

**Note**: The `showCashoutScreen` branch and its template structure are already handled in B2c (it comes first in the template, before the CRASHED branch). B3's job is to ensure the RUNNING `{:else}` branch properly handles the non-cashout case:

```svelte
{:else}
  <!-- RUNNING, no cashout -->
  <div class="game-area">
    <div class="multiplier-section">
      <Multiplier />
      <ThreatMeter multiplier={$displayMultiplier} threatLevel={$threatLevel} />
    </div>
    <div class="terminal-wrapper">
      <TerminalDisplay lines={$terminalLines} maxHeight="280px" threatLevel={$threatLevel} />
    </div>
    <div class="action-area">
      {#if $isInRound}
        <CashoutButton />
      {:else if $phase === 'RUNNING'}
        <ObserverBanner threatLevel={$threatLevel} />
      {/if}
    </div>
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

## Implementation Status (as of second feedback pass)

**Fixes 1–12 are fully implemented** in the working copy. All Wave A–D steps are complete. The following waves cover only Fixes 13–20.

---

## Wave E — Simple Independent Fixes (Fixes 13–17, all parallel)

All five steps touch disjoint files. Can run as parallel agents or be done sequentially.

---

### Step E1 — Fix 13: Sidebar Width Consistency

**File**: `src/client/App.svelte`

Remove the `grid-template-columns` override from `.app-main.running` and standardize the base rule to `1fr 200px`:

```css
/* Change base rule */
.app-main {
  grid-template-columns: 1fr 200px; /* was 1fr 180px */
}

/* Remove this override entirely */
.app-main.running {
  grid-template-columns: 1fr 200px; /* DELETE this line — same as base now */
}
```

The `.running` class may remain on the element if used for other purposes; only the column-width line is removed.

**Tests**: None — visual regression.

---

### Step E2 — Fix 15: CRITICAL Cover "BLOWN" → "burning"

**File**: `src/client/lib/threat.ts`

```typescript
// Change:
case 'CRITICAL':
  return { proxies: '0/6 EXPOSED', ids: 'ACTIVE HUNT', cover: 'BLOWN' };
// To:
case 'CRITICAL':
  return { proxies: '0/6 EXPOSED', ids: 'ACTIVE HUNT', cover: 'burning' };
```

**Tests**: `src/client/lib/__tests__/threat.test.ts` — update the CRITICAL `cover` assertion from `'BLOWN'` to `'burning'`.

---

### Step E3 — Fix 16: Remove You-Marker from PlayerList

**File**: `src/client/components/PlayerList.svelte`

Remove the `{#if}` block and associated CSS:

```svelte
<!-- Remove this entire block from the handle span: -->
{#if player.playerId === $myPlayerId}
  <span class="you-marker">← YOU</span>
{/if}
```

```css
/* Remove these rules: */
.you-marker { ... }
```

**Tests**: If any test asserts `← YOU` text is present, remove that assertion.

---

### Step E4 — Fix 17: History Panel Label "Recent Ops"

**File**: `src/client/components/History.svelte`

```svelte
<!-- Change: -->
<div class="panel-label">最近 RECENT</div>
<!-- To: -->
<div class="panel-label">最近 RECENT OPS</div>
```

**Tests**: Update any test that asserts the panel label text.

---

### Step E5 — Fix 18: Initiate Breach Disabled After Join

**File**: `src/client/components/BetForm.svelte`

Add `players` and `myPlayerId` to imports, derive `hasJoined`, update button and add status line:

```svelte
<script lang="ts">
import { balance, countdown, lastError, phase, players, myPlayerId } from '../lib/stores';

const hasJoined = $derived($players[$myPlayerId] !== undefined);
</script>

<!-- Update button: -->
<button
  class="join-btn"
  onclick={handleJoin}
  disabled={!isValid || hasJoined}
>
  {hasJoined ? '[ BREACH INITIATED ]' : '[ INITIATE BREACH ]'}
</button>

{#if hasJoined}
  <div class="join-status">AWAITING ROUND START</div>
{/if}
```

```css
.join-status {
  margin-top: 0.25rem;
  text-align: center;
  font-size: 10px;
  color: var(--color-primary-dim);
  letter-spacing: 0.08em;
}
```

**Tests**: `BetForm.test.ts` (if it exists) — add test: when `$players[$myPlayerId]` is populated, button is disabled and shows `BREACH INITIATED`. When not populated, button is enabled and shows `INITIATE BREACH`.

---

## Wave F — Component Prop Additions (Fix 19 parts A+B, Fix 20; mostly parallel)

F1 and F2 are independent. F3 (CrashScreen) must follow F2 (crash-agency). F4 (ThreatPanel) is independent of all.

---

### Step F1 — Fix 20 part A: ThreatPanel `disconnected` Prop

**File**: `src/client/components/ThreatPanel.svelte`

Add `disconnected?: boolean` prop. When true, override all displayed values with a safe-state readout and apply green styling:

```svelte
<script lang="ts">
let {
  threatLevel,
  multiplier,
  disconnected = false,
}: {
  threatLevel: ThreatLevel;
  multiplier: number;
  disconnected?: boolean;
} = $props();

const isCritical = $derived(!disconnected && threatLevel === 'CRITICAL');
const isSevere = $derived(!disconnected && threatLevel === 'SEVERE');
const subIndicators = $derived(
  disconnected
    ? { proxies: 'scrubbed', ids: 'dark', cover: 'restored' }
    : getSubIndicators(threatLevel)
);
const displayStatus = $derived(disconnected ? 'OFFLINE' : threatLevel);
</script>

<div class="threat-panel"
  class:severe={isSevere}
  class:critical={isCritical}
  class:disconnected={disconnected}
>
  ...
  <span class="val" class:pulse-status={isCritical}>{displayStatus}</span>
  ...
</div>
```

```css
.threat-panel.disconnected {
  border-color: var(--color-success-dim);
}
.threat-panel.disconnected .val {
  color: var(--color-success);
  font-weight: 700;
}
```

**Tests**: `ThreatPanel.test.ts` (create if absent) — when `disconnected={true}` and `threatLevel="CRITICAL"`: renders `OFFLINE`, `scrubbed`, `dark`, `restored`; no `.critical` CSS class on the panel element.

---

### Step F2 — Fix 19 part A: Lockout Subtitles in crash-agency.ts

**File**: `src/client/lib/crash-agency.ts`

Add `LOCKOUT_SUBTITLES` array and `pickLockoutSubtitle()` export:

```typescript
const LOCKOUT_SUBTITLES = [
  'INTRUSION COUNTERMEASURES DEPLOYED — CONNECTION SEVERED',
  'TARGET HOST INITIATED EMERGENCY ISOLATION PROTOCOL',
  'REMOTE FAILSAFE ACTIVATED — UNABLE TO RECONNECT',
  'SECURITY PERIMETER RESTORED — FURTHER ACCESS BLOCKED',
  'NETWORK LOCKDOWN IN PROGRESS — ALL SESSIONS TERMINATED',
];

export function pickLockoutSubtitle(): string {
  return LOCKOUT_SUBTITLES[Math.floor(Math.random() * LOCKOUT_SUBTITLES.length)]!;
}
```

**Tests**: `src/client/lib/__tests__/crash-agency.test.ts` — add test: `pickLockoutSubtitle()` returns a non-empty string.

---

### Step F3 — Fix 14 + Fix 19 part B: CrashScreen `isEscaped` Prop + Pulse Animation

**File**: `src/client/components/CrashScreen.svelte`

Add `isEscaped?: boolean` prop. When true: use SYSTEM LOCKOUT heading, alternate JP accent, `pickLockoutSubtitle()` for subtitle, compact height, no `ALL FUNDS SEIZED`. Always add `crash-pulse` animation to `.main-content`.

```svelte
<script lang="ts">
import { pickAgency, pickLockoutSubtitle } from '../lib/crash-agency';

let {
  crashPoint,
  isSpectator = false,
  isEscaped = false,
}: {
  crashPoint: number;
  isSpectator?: boolean;
  isEscaped?: boolean;
} = $props();

onMount(() => {
  agency = pickAgency();
  lockoutSubtitle = pickLockoutSubtitle();
});
</script>

<div class="crash-screen" class:escaped={isEscaped}>
  <div class="vhs-band"></div>
  <div class="hazard-stripe top"></div>
  <div class="main-content">
    <div class="jp-accent">
      {isEscaped ? '接続不能 — システム停止' : '警告 — 追跡完了'}
    </div>
    <div class="traced">
      {isEscaped ? 'SYSTEM LOCKOUT' : 'TRACED'}
    </div>
    <div class="subtitle">
      {isEscaped ? lockoutSubtitle : agency.subtitle}
    </div>
    <div class="crash-multiplier">{crashPoint.toFixed(2)}x</div>
    <div class="agency-divider"></div>
    <div class="agency-name">{agency.name}</div>
    {#if agency.caseRef}
      <div class="case-ref">{agency.caseRef}</div>
    {/if}
    {#if !isSpectator && !isEscaped}
      <div class="funds-seized">ALL FUNDS SEIZED</div>
    {/if}
  </div>
  <div class="hazard-stripe bottom"></div>
</div>
```

CSS changes:

```css
/* Red pulse — applied to all crash states (alarm effect) */
@keyframes crash-pulse {
  0%, 100% { background: #0a0000 }
  50%      { background: #1e0000 }
}

.main-content {
  animation: crash-pulse 1s ease-in-out infinite;
  /* existing properties unchanged */
}

/* Compact height for escaped variant (leaves room for cashout card below) */
.crash-screen.escaped {
  min-height: 200px;
  max-height: 280px;
}

/* SYSTEM LOCKOUT heading size — slightly smaller than TRACED to fit longer text */
.crash-screen.escaped .traced {
  font-size: 2rem;
  letter-spacing: 0.2em;
}
```

**Tests**: `CrashScreen.test.ts` — add tests:
- `isEscaped={true}`: `SYSTEM LOCKOUT` text is present; `TRACED` is absent; `ALL FUNDS SEIZED` is absent.
- `isEscaped={false}` (default): `TRACED` is present; `SYSTEM LOCKOUT` is absent.
- `isEscaped={true}` with `isSpectator={true}`: `ALL FUNDS SEIZED` still absent.

---

## Wave G — App.svelte Wiring (depends on F1, F3)

Both Fix 19 and Fix 20 touch `App.svelte`. Do them in a single step to avoid conflicts.

---

### Step G1 — Fix 19 + Fix 20: App.svelte Final Wiring

**File**: `src/client/App.svelte`

**Fix 19**: In the `showCashoutScreen` branch, when `$phase === 'CRASHED'`, replace the multiplier section with `CrashScreen isEscaped=true` above `CashoutScreen`. When `$phase !== 'CRASHED'`, keep the existing multiplier section as-is.

```svelte
{:else if showCashoutScreen}
  <div class="game-area">
    {#if $phase === 'CRASHED'}
      <CrashScreen
        crashPoint={$gameState?.crashPoint ?? 0}
        isSpectator={true}
        isEscaped={true}
      />
    {:else}
      <div class="multiplier-section">
        <Multiplier />
        <ThreatMeter multiplier={$displayMultiplier} threatLevel={$threatLevel} />
      </div>
    {/if}
    <CashoutScreen
      payout={lastCashoutPayout}
      cashoutMultiplier={lastCashoutMultiplier}
      threatLevel={$cashoutThreatLevel ?? 'GHOST'}
    />
  </div>
  <aside class="sidebar">
    <PlayerList />
    <ThreatPanel
      threatLevel={$threatLevel}
      multiplier={$displayMultiplier}
      disconnected={true}
    />
    <History />
  </aside>
```

**Fix 20**: `disconnected={true}` is already included in the ThreatPanel call above — no additional change needed.

**Tests**: `App.test.ts` — add tests:
- During `showCashoutScreen + CRASHED`: `SYSTEM LOCKOUT` text is rendered; multiplier section is absent; cashout card is present.
- During `showCashoutScreen + RUNNING`: multiplier section is present; `SYSTEM LOCKOUT` is absent.
- During `showCashoutScreen` (any phase): ThreatPanel receives `disconnected={true}`.

---

## Updated Dependency Graph

```
Fixes 1–12 (Waves A–D) — ALREADY IMPLEMENTED
       ↓
Wave E (E1, E2, E3, E4, E5) — all independent, run concurrently
       ↓
Wave F:
  F1 (ThreatPanel disconnected) — independent
  F2 (crash-agency lockout subtitles) — independent
  F3 (CrashScreen isEscaped + pulse) — depends on F2 (imports pickLockoutSubtitle)
  NOTE: F1 and F2 can run concurrently; F3 follows F2
       ↓
Wave G (G1) — depends on F1 (ThreatPanel prop) and F3 (CrashScreen isEscaped)
```

Wave E is fully parallel. Wave F: F1 and F2 parallel, then F3. Wave G follows F.

---

## Updated Files Changed

| File | Fixes |
|------|-------|
| `src/client/App.svelte` | E1 (grid width), G1 (cashout+crash wiring, disconnected ThreatPanel) |
| `src/client/lib/threat.ts` | E2 (cover wording) |
| `src/client/components/PlayerList.svelte` | E3 (remove you-marker) |
| `src/client/components/History.svelte` | E4 (label text) |
| `src/client/components/BetForm.svelte` | E5 (hasJoined logic) |
| `src/client/components/ThreatPanel.svelte` | F1 (disconnected prop) |
| `src/client/lib/crash-agency.ts` | F2 (lockout subtitles) |
| `src/client/components/CrashScreen.svelte` | F3 (isEscaped prop + crash-pulse) |
| `src/client/lib/__tests__/threat.test.ts` | E2 (cover assertion) |
| `src/client/lib/__tests__/crash-agency.test.ts` | F2 (pickLockoutSubtitle test) |
| `src/client/components/__tests__/CrashScreen.test.ts` | F3 (isEscaped tests) |
| `src/client/components/__tests__/App.test.ts` | G1 (lockout+cashout layout, disconnected ThreatPanel) |

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

**Spec completeness**: All 20 issues have clear desired states and explicit solutions. Fixes 1–12 are already implemented. Fixes 13–20 are fully planned across Waves E–G. Approved mockups cover the two most complex new changes (Fix 19 escaped crash view: `docs/mockups/escaped-crash-mockup.html`; original crash/cashout views: existing mockups).

**Implementation risk (Waves E–G)**:
- **F3 (CrashScreen isEscaped + pulse)** is the highest-risk step in the new waves: the component must branch on `isEscaped` throughout its template while keeping all existing TRACED behavior intact. The `crash-pulse` animation is applied universally (affects both the escaped and traced variant). Tests must cover both branches explicitly.
- **G1 (App.svelte wiring)**: The `showCashoutScreen` branch currently renders the multiplier section unconditionally — the phase split (`CRASHED` → lockout panel, `RUNNING` → multiplier) is a meaningful structural change. The existing CRASHED + non-cashout branch is unchanged; only the `showCashoutScreen` + `CRASHED` sub-case changes.
- **F1 (ThreatPanel disconnected)**: The `isCritical` and `isSevere` derived values must be gated on `!disconnected` to prevent the red border/glow from overriding the green disconnected styling.
- **E5 (BetForm hasJoined)**: `$players[$myPlayerId]` is only populated during WAITING when the server confirms the join. If `$myPlayerId` is empty string on first render, the lookup returns `undefined` correctly — no edge-case guard needed.

**What's NOT in this plan**: Anything requiring server logic changes, new npm packages, or new WebSocket message types. ThreatPanel tests may require a new `ThreatPanel.test.ts` file if one doesn't already exist.
