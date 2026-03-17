# Hacker Theme — Implementation Plan

**Spec**: `docs/specs/2026-03-17-hacker-theme.md`
**Design process**: `docs/notes/2026-03-17-hacker-theme-design-process.md`
**Mockups**: `docs/mockups/hacker-concepts{,-v2,-v3,-v4}.html`

---

## Overview

This plan covers a complete visual and experiential overhaul of the crash game client into a hacking-themed experience. The server, types protocol, and WebSocket API are **not touched**. All changes are client-side only (`src/client/`, `src/types.ts` for new client types only, `index.html`).

**Total waves**: 12 (Wave 0 through Wave 10, with Wave 7 split into 7A and 7B)
**Approach**: Each wave produces a PR that leaves the app in a working state. Waves are broken into agent-parallelizable steps. TDD applied where logic is testable; CSS-only changes skip unit tests.

---

## Architectural Notes (Read Before Planning Assignments)

### How `roundTarget` is generated
`RoundTarget` is generated client-side in `message-handler.ts` when a `state{phase:'WAITING'}` message arrives. Use `roundId` as a seed for a simple deterministic PRNG (Mulberry32 or similar) so all clients see the same target org/hostname/IP for a given round. The `roundId` is already in every `GameStateSnapshot`.

### How `cashoutThreatLevel` is captured
`CashoutButton.svelte` reads `$threatLevel` and calls `cashoutThreatLevel.set($threatLevel)` immediately before `sendCashout()`. This captures the threat level at the exact moment of cashout and survives until `App.svelte` clears it at the next WAITING state.

### How CSS custom properties are driven
`App.svelte` contains a `$effect(() => { /* update --threat-* CSS vars on document.documentElement */ })` that runs on `$threatLevel` changes. This single effect drives the entire color system.

### `threatLevel` during non-RUNNING phases
- `WAITING`: always `'GHOST'` (multiplier sits at 1.0)
- `STARTING`: always `'GHOST'`
- `RUNNING`: derived from `$displayMultiplier`
- `CRASHED`: freeze at last RUNNING value — the crash screen is always full-red regardless, so this doesn't matter visually, but the store should not reset to GHOST during the crash display window

Safest implementation: `threatLevel` is derived from `displayMultiplier` (always using the stored formula), and the crash screen always applies its own full-red styling independent of `threatLevel`.

### Where `generateRoundTarget` lives
`generateRoundTarget(roundId, rng)` is defined in `src/client/lib/prng.ts` alongside `mulberry32` and `seededPick`. It draws from pools of org names, hostnames, and IP prefixes to produce a `RoundTarget`. It is imported by `message-handler.ts` in Wave 2e.

### Shared CSS keyframes strategy
All shared animation keyframes (`flk-lo`, `flk-hi`, `vhs`, `gjit`, `g1`, `g2`, `bg-crisis`, `pulse`, `pulse-fast`) are defined in `App.svelte`'s `:global` style block (Wave 1b). This avoids Svelte's scoped style isolation from blocking cross-component animation references (e.g., `.glitch` on Multiplier.svelte using keyframes defined in CRTOverlay). Individual components reference these keyframes by name without redefining them. `CRTOverlay.svelte` applies the class-based toggles (`.flk-lo`, `.flk-hi`) but the `@keyframes` themselves live globally.

### CSS custom properties reference
All `--threat-*` custom properties are **set** in a single `$effect` in `App.svelte` (Wave 10a) from the `$dangerColors` derived store. Components **consume** them via `var(--threat-color)` etc. Components should prefer using CSS custom properties over hardcoded color values wherever the color depends on threat level. Static colors (e.g., `--color-success` for wallet) can be referenced directly.

| Property | Set by | Consumed by |
|---|---|---|
| `--threat-color` | App.svelte `$effect` | Header left section, multiplier (via inline style override), ThreatMeter, ThreatPanel, ObserverBanner |
| `--threat-dim` | App.svelte `$effect` | JP accent text, sub-indicators, dim labels |
| `--threat-bg` | App.svelte `$effect` | Root background transition |
| `--threat-border` | App.svelte `$effect` | Sidebar border, panel borders, header bottom border |
| `--threat-glow-alpha` | App.svelte `$effect` | ThreatPanel box-shadow, CRTOverlay ambient glow |

Note: Multiplier `text-shadow` and color use inline styles derived from `$dangerColors` directly (spec §9.2 table), not CSS custom properties, because the glow values are specific per-component and don't map 1:1 to `--threat-glow-alpha`.

### Terminal line cap
The `terminalLines` store is capped at 200 lines. The `onLine` handler in Wave 6c drops the oldest lines when appending would exceed the cap. This prevents unbounded memory growth during long rounds at high multiplier (which can emit 5-10 lines/second).

### Phase label mapping (replaces GameStatus.svelte)
`GameStatus.svelte` is removed from the render tree in Wave 4. Its phase text is distributed:

| Phase | Text | New Location |
|---|---|---|
| WAITING | "TARGET ACQUIRED" | Not displayed as standalone text; phase context comes from TargetInfo panel and prep terminal |
| STARTING | "BREACHING..." | Multiplier.svelte (dim amber, replaces "STARTING...") |
| RUNNING | "LIVE HACK" | JP accent label above Multiplier (`侵入中 LIVE HACK`) |
| CRASHED | "TRACED" | CrashScreen.svelte main panel |

The `GameStatus.svelte` file is kept until Wave 10 cleanup confirms removal is safe.

### Cashout screen display guard
The cashout screen must only appear for successful cashouts, not when the round crashes. Track `hasCashedOutThisRound` as a separate boolean in App.svelte:
- Set `true` when `playerCashedOut` message arrives for `$myPlayerId`
- Set `false` when phase transitions to `WAITING`
- `showCashoutScreen` is derived from `hasCashedOutThisRound && ($phase === 'RUNNING' || $phase === 'CRASHED')`

Do **not** derive from `$isInRound` transitioning false, as that also fires on crash.

### Component test runner
```
~/.nvm/versions/node/v24.14.0/bin/node ./node_modules/.bin/vitest run --config vitest.svelte.config.ts
```
Must be run from the main repo, not a worktree.

### Performance rollback criteria
If any wave introduces a performance regression:
- Terminal emission causing >16ms frame times at CRITICAL: reduce max emission rate to 100ms minimum interval
- `text-shadow` on multiplier causing paint thrash: switch to `filter: drop-shadow()` which can be compositor-accelerated
- Terminal list append causing full list re-render: add virtual scrolling or limit visible lines to last 50

---

## Wave 0: Audit & Baseline Snapshot

**Goal**: Establish a clean baseline before any changes. Run the full test suite, capture current state, and document any pre-existing failures.

**Dependencies**: None

**Steps**:

**Step 0a** — Run full test suite
```bash
npm run test
npm run test:workers
npm run typecheck
npm run lint
~/.nvm/versions/node/v24.14.0/bin/node ./node_modules/.bin/vitest run --config vitest.svelte.config.ts
```

Document pass/fail counts for each runner. Any pre-existing failures must be noted so they aren't attributed to theme work.

**Step 0b** — Screenshot baseline

Start the dev server (`npm run dev:client` + `npm run dev:server`) and capture screenshots of:
- WAITING phase (with and without a placed bet)
- RUNNING phase at LOW multiplier
- RUNNING phase at HIGH multiplier
- CRASHED phase
- Cashout screen
- All three modals (Name, Fairness, Verify)

Save to `docs/notes/baseline-screenshots/` for comparison during Wave 10 visual QA.

**PR scope**: No code changes. Baseline notes saved to `docs/notes/2026-03-17-hacker-theme-baseline.md`.

---

## Wave 1: Foundation — Palette, Fonts, Global Styles

**Goal**: Establish the visual DNA. The app becomes amber/dark with monospace fonts. All existing functionality continues to work. No layout changes, no new components, no new stores.

**Dependencies**: None

**Steps**:

> Steps 1a and 1b can run **concurrently**.

**Step 1a** — Font loading (`index.html`)
Add Google Fonts `<link>` tags to `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
```

**Step 1b** — Global styles and CSS custom properties (`App.svelte` `<style>`)

Replace the `:global(body)` block with:
```css
:global(body) {
  margin: 0;
  background: #0a0800;
  color: #ffb000;
  font-family: 'Fira Code', monospace;
  min-height: 100vh;
}
```

Add a `:root` block with the full CSS custom property palette from spec §2:
```css
:root {
  --color-primary: #ffb000;
  --color-primary-dim: #805800;
  --color-primary-mid: #cc8800;
  --color-bg: #0a0800;
  --color-bg-card: #080600;
  --color-border: #332800;
  --color-success: #00cc66;
  --color-success-dim: #006633;
  --color-elevated: #ff8c00;
  --color-high: #ff6600;
  --color-severe: #ff4400;
  --color-critical: #ff0040;
  --color-critical-pure: #ff0000;
  --color-critical-dark: #cc0000;
  --color-elevated-dim: #803000;
  --color-severe-dim: #800020;
  --color-critical-dim: #400000;
  /* Dynamic threat-level properties — updated via JS */
  --threat-color: var(--color-primary);
  --threat-dim: var(--color-primary-dim);
  --threat-bg: var(--color-bg);
  --threat-border: var(--color-border);
  --threat-glow-alpha: 0.3;
}
```

Also update `.app`, `header`, and `.sidebar` in App.svelte to use the new palette (dark backgrounds, amber borders, remove purple/blue colors). The header should still display the current content (name button, fairness button, status, balance) but with amber/dark styling as an interim state.

Also add all shared animation keyframes to App.svelte's `:global` style block (see "Shared CSS keyframes strategy" in Architectural Notes):
- `@keyframes flk-lo`, `@keyframes flk-hi` (spec §4.3 — flicker)
- `@keyframes vhs` (spec §4.4 — VHS band sweep)
- `@keyframes gjit`, `@keyframes g1`, `@keyframes g2` (spec §4.5 — glitch tearing, port verbatim from v3/v4 mockups)
- `@keyframes bg-crisis` (spec §4.6 — CRITICAL background pulse)
- `@keyframes pulse` (0.8s infinite, for CRITICAL disconnect button)
- `@keyframes pulse-fast` (0.4s infinite, for tier 6 terminal danger lines)

These are `:global` because they are consumed by multiple components (CRTOverlay, Multiplier, TerminalDisplay, CashoutButton, App root).

**Test plan**: None — pure visual CSS. Manual verification: background is dark amber, text is amber, fonts are monospace.

**PR scope**: `index.html`, `App.svelte` (style block only)

---

## Wave 2: Stores, Types & Threat Logic

**Goal**: Add the data layer — new types, new stores, and threat-level utility functions — that all subsequent waves depend on. Nothing visible changes; this is infrastructure.

**Dependencies**: None (can run concurrently with Wave 1)

**Steps**:

> Steps 2a → 2b → (2c + 2d + 2e concurrently) → 2f

**Step 2a** — New types in `src/types.ts`

Add to the bottom of `src/types.ts` (client-side types only, does not affect server):
```typescript
// ─── Hacker theme client types ────────────────────────────────────────────────

export type ThreatLevel = 'GHOST' | 'LOW' | 'ELEVATED' | 'HIGH' | 'SEVERE' | 'CRITICAL';

export interface TerminalLine {
  id: number;           // Monotonic ID for keying
  text: string;
  color: string;        // CSS color value
  type: 'normal' | 'success' | 'warning' | 'danger' | 'progress' | 'command';
  timestamp: number;    // Emission time (ms) — used for debugging/dev-tools only, not rendered
}

export interface RoundTarget {
  org: string;
  ip: string;           // Partially masked, e.g. "198.51.100.██"
  hostname: string;
  roundId: number;
}

export interface DangerColors {
  color: string;        // Primary threat color
  dim: string;          // Dimmed variant
  bg: string;           // Background color for this level
  border: string;       // Border color
  glowAlpha: number;    // Box-shadow alpha for ThreatPanel/ambient glow (NOT multiplier text-shadow — see spec §9.2 for those per-level values)
}
```

**Step 2b** — Threat utility module: `src/client/lib/threat.ts`

Create a new file with pure functions:
```typescript
import type { DangerColors, ThreatLevel } from '../../../types';

export function getThreatLevel(multiplier: number): ThreatLevel {
  if (multiplier >= 25) return 'CRITICAL';
  if (multiplier >= 10) return 'SEVERE';
  if (multiplier >= 5) return 'HIGH';
  if (multiplier >= 2.5) return 'ELEVATED';
  if (multiplier >= 1.2) return 'LOW';
  return 'GHOST';
}

export function getDangerColors(level: ThreatLevel): DangerColors {
  // Returns the color/dim/bg/border/glowAlpha for each level
  // (exact values from spec §2)
}

export function getThreatFillCount(multiplier: number): number {
  // Returns 0–20, continuously scaled.
  // Map: 1x→0, 1.2x→2, 2.5x→6, 5x→10, 10x→14, 25x→20
  // Use linear interpolation within each band.
}

export function getSubIndicators(level: ThreatLevel): {
  proxies: string;
  ids: string;
  cover: string;
} {
  // Returns the PROXIES / IDS / COVER text per level from spec §8.3
  // Values can include small random variance within tier bounds
  // using a stable seed (call with roundId + level for determinism)
}
```

**Step 2c** — Update `src/client/lib/stores.ts`

Add new stores:
```typescript
import { getThreatLevel, getDangerColors } from './threat';
import type { DangerColors, RoundTarget, TerminalLine, ThreatLevel } from '../../../types';

export const terminalLines = writable<TerminalLine[]>([]);
export const roundTarget = writable<RoundTarget | null>(null);
export const cashoutThreatLevel = writable<ThreatLevel | null>(null);

export const threatLevel = derived<typeof displayMultiplier, ThreatLevel>(
  displayMultiplier,
  ($m) => getThreatLevel($m),
);

export const dangerColors = derived<typeof threatLevel, DangerColors>(
  threatLevel,
  ($level) => getDangerColors($level),
);
```

**Step 2d** — Simple deterministic PRNG utility: `src/client/lib/prng.ts`

```typescript
import type { RoundTarget } from '../../../types';

// Mulberry32 — simple fast seeded PRNG returning floats in [0, 1)
export function mulberry32(seed: number): () => number { ... }

// Seeded random pick from array
export function seededPick<T>(arr: T[], seed: number): T { ... }

// Generate a deterministic RoundTarget from round ID
// Draws org name, hostname, and partially-masked IP from internal pools
export function generateRoundTarget(roundId: number, rng: () => number): RoundTarget { ... }
```

Used by terminal content engine and roundTarget generation. The `generateRoundTarget` function lives here (not in message-handler.ts) to keep message-handler free of pool data.

**Step 2e** — Update `src/client/lib/message-handler.ts`

Import `roundTarget` store and `mulberry32`. In the `case 'state'` handler, when `snapshot.phase === 'WAITING'`:
```typescript
// Generate deterministic target from roundId
const rng = mulberry32(snapshot.roundId);
roundTarget.set(generateRoundTarget(snapshot.roundId, rng));
```

Also: when `snapshot.phase === 'WAITING'` (new round starting), clear `cashoutThreatLevel` and `terminalLines`.

**Step 2f** — Unit tests: `src/client/__tests__/threat.test.ts`

```typescript
describe('getThreatLevel', () => {
  it('returns GHOST at 1.00x', ...)
  it('returns LOW at 1.2x', ...)
  it('returns ELEVATED at 2.5x', ...)
  it('returns HIGH at 5x', ...)
  it('returns SEVERE at 10x', ...)
  it('returns CRITICAL at 25x', ...)
  it('returns CRITICAL above 25x', ...)
  it('boundaries: 2.499x is LOW, 2.5x is ELEVATED', ...)
})

describe('getThreatFillCount', () => {
  it('returns 0 at 1.0x', ...)
  it('returns 20 at 25x+', ...)
  it('interpolates within bands', ...)
})
```

Unit tests for `getDangerColors` (correct color values per level).

**Test runner**: `npm run test` (vitest unit tests, not component tests)

**PR scope**: `src/types.ts`, `src/client/lib/threat.ts`, `src/client/lib/prng.ts`, `src/client/lib/stores.ts`, `src/client/lib/message-handler.ts`, `src/client/__tests__/threat.test.ts`

---

## Wave 3: CRTOverlay + TerminalDisplay (Structural)

**Goal**: Build the two new structural components. They are not yet integrated into the app — this wave creates them as standalone units that can be tested independently and imported in later waves.

**Dependencies**: Wave 2 (threatLevel store, TerminalLine type)

**Steps**:

> Steps 3a and 3b can run **concurrently**. Tests (3c, 3d) run after their respective components.

**Step 3a** — Create `src/client/components/CRTOverlay.svelte`

Props:
```typescript
let {
  threatLevel = 'GHOST',
  children,
}: { threatLevel?: ThreatLevel; children?: Snippet } = $props();
```

CSS classes applied based on `threatLevel`:
- `.flk-lo` for GHOST–HIGH (subtle flicker)
- `.flk-hi` for SEVERE–CRITICAL (erratic flicker)
- `.vhs2` present for SEVERE–CRITICAL (second VHS band)

**Note on keyframes**: All shared `@keyframes` are defined in App.svelte's `:global` block (Wave 1b). This component references them by name (e.g., `animation: flk-lo 3s infinite`) without redefining them. This avoids Svelte's scoped style isolation blocking cross-component animation references.

Structure:
```svelte
<div class="crt" class:flk-lo={isLowFlicker} class:flk-hi={isHighFlicker}>
  {@render children?.()}
  <div class="vhs"></div>
  {#if showVhs2}<div class="vhs2"></div>{/if}
</div>
```

The `.crt::after` scanline pseudo-element is defined in this component's style block.

**Step 3b** — Create `src/client/components/TerminalDisplay.svelte`

Props:
```typescript
let {
  lines = [],
  dim = false,       // true for prep terminal (WAITING phase, dimmed amber)
  maxHeight = '300px',
  threatLevel = 'GHOST',
}: {
  lines: TerminalLine[];
  dim?: boolean;
  maxHeight?: string;
  threatLevel?: ThreatLevel;
} = $props();
```

Structure:
- Outer wrapper: `CRTOverlay` with `{threatLevel}`
- Inner scroll container: `overflow-y: auto`, `max-height: {maxHeight}`, auto-scrolls to bottom on `lines` change
- Line list: `{#each lines as line (line.id)}`
- Each line: a `<div>` with `style:color={line.color}` and class based on `line.type`
- The `action:scrollIntoView` pattern or a `$effect` that calls `container.scrollTop = container.scrollHeight` when lines update

When `dim` is true, apply a `filter: brightness(0.6)` or use `#805800` base color for all lines.

**Step 3c** — Component tests: `src/client/__tests__/CRTOverlay.test.ts`

```typescript
it('applies flk-lo class for GHOST through HIGH', ...)
it('applies flk-hi class for SEVERE and CRITICAL', ...)
it('renders vhs2 div only at SEVERE and CRITICAL', ...)
it('renders children via slot', ...)
```

**Step 3d** — Component tests: `src/client/__tests__/TerminalDisplay.test.ts`

```typescript
it('renders each line with its color', ...)
it('renders empty state without error', ...)
it('applies dim styling when dim=true', ...)
```

**Test runner**: `~/.nvm/versions/node/v24.14.0/bin/node ./node_modules/.bin/vitest run --config vitest.svelte.config.ts`

**PR scope**: `src/client/components/CRTOverlay.svelte`, `src/client/components/TerminalDisplay.svelte`, `src/client/__tests__/CRTOverlay.test.ts`, `src/client/__tests__/TerminalDisplay.test.ts`

---

## Wave 4: Header Bar + TargetInfo + Layout Scaffold

**Goal**: Overhaul `App.svelte` header to the `[crashOS] RND# TGT: HOST: | ●ms WALLET:` format. Create `TargetInfo.svelte`. Restructure the main grid to support the new two-panel WAITING layout and running-phase layout (leaving placeholders for components not yet built).

**Dependencies**: Wave 1 (CSS vars), Wave 2 (`roundTarget` store, `myPlayerName` already exists)

**Steps**:

> Steps 4a and 4b can run **concurrently**. Step 4c comes after both.

**Step 4a** — Create `src/client/components/TargetInfo.svelte`

Props: `{ target: RoundTarget | null }`

Renders a bordered box with floating label `作戦概要 OPERATION BRIEF` (Space Mono, 9px, dim).

Key-value grid:
```
TARGET: [org name, bold amber]
ADDR:   [ip, mid-amber]
HOST:   [hostname, mid-amber]
ROUND:  [#roundId, dim]
```

Labels: `--color-primary-dim`. Values: `--color-primary` or `--color-primary-mid`.

When `target` is null, show placeholder skeleton text (dimmed).

**Step 4b** — Overhaul `App.svelte` header section

Replace `<header>` HTML. New structure:
```svelte
<header class="header-bar">
  <div class="header-left">
    <span class="brand">[crashOS]</span>
    {#if $myPlayerName}
      <span class="sep">@</span>
      <button class="name-btn" onclick={() => nameModalOpen = true}>{$myPlayerName}</button>
    {/if}
    <span class="rnd">RND #{$gameState?.roundId ?? '—'}</span>
    {#if $roundTarget}
      <span class="tgt-label">TGT:</span>
      <span class="tgt-value">{$roundTarget.org}</span>
      <span class="tgt-label">HOST:</span>
      <span class="tgt-value">{$roundTarget.hostname}</span>
    {/if}
  </div>
  <div class="header-right">
    <button class="fairness-btn" onclick={() => fairnessModalOpen = true}>⊕ PROVABLY FAIR</button>
    <ConnectionStatus />
    <span class="wallet-label">WALLET:</span>
    <span class="wallet-value">{$balance.toFixed(2)} CR</span>
  </div>
</header>
```

Apply styling from spec §14 (Fira Code 11px, amber left section, green right section). The left section uses `--threat-color` for `[crashOS]`, `--threat-dim` for labels, and `--threat-color` / a mid-variant for values. The right section (wallet, latency) is **always green** regardless of threat level — use `--color-success` directly.

The header's dynamic threat color progression (spec §14.3) will activate automatically once Wave 10a wires the CSS custom property updates. No extra JS is needed here — just use `var(--threat-color)` etc. in the CSS and the `$effect` in Wave 10a drives the values.

**Step 4c** — Restructure `App.svelte` main layout

The main grid becomes phase-dependent. WAITING layout: two equal-width panels (`TargetInfo` + `BetForm`) above a prep terminal, with sidebar. RUNNING layout: single-column main area (multiplier placeholder + terminal placeholder + disconnect placeholder) with sidebar.

Use Svelte conditional rendering to switch layouts:
```svelte
<main class="app-main">
  {#if $phase === 'WAITING' || $phase === 'STARTING'}
    <div class="lobby-area">
      <div class="lobby-panels">
        <TargetInfo target={$roundTarget} />
        <BetForm />
      </div>
      <!-- Prep terminal will be added in Wave 5 -->
    </div>
  {:else}
    <div class="game-area">
      <!-- Multiplier + ThreatMeter (Wave 7) -->
      <!-- TerminalDisplay (Wave 6) -->
      <!-- CashoutButton/ObserverBanner (Wave 7) -->
    </div>
  {/if}

  <aside class="sidebar">
    <PlayerList />
    <!-- ThreatPanel shown during RUNNING (Wave 7/8) -->
    <History />
  </aside>
</main>
```

Update grid CSS: `grid-template-columns: 1fr 200px` during RUNNING/CRASHED, `1fr 180px` during WAITING (spec §15 — sidebar is narrower during WAITING to accommodate wider main panels). Use a class toggle or phase-dependent style.

**GameStatus.svelte**: Remove from the render tree in this wave. Phase text is now distributed to other components (see "Phase label mapping" in Architectural Notes). Keep the file on disk until Wave 10 cleanup.

**Step 4d** — Component tests: `src/client/__tests__/TargetInfo.test.ts`

```typescript
it('renders all four fields with correct values', ...)
it('renders placeholder state when target is null', ...)
it('displays section label in Space Mono style', ...)
it('uses correct color for labels vs values', ...)
```

**Test runner**: Component tests (vitest.svelte.config.ts)

**PR scope**: `src/client/components/TargetInfo.svelte`, `App.svelte` (header + layout), `src/client/__tests__/TargetInfo.test.ts`

---

## Wave 5: Lobby Complete — BetForm Restyle + Prep Terminal

**Goal**: Complete the WAITING phase experience. `BetForm.svelte` gets full terminal aesthetics. The prep terminal displays countdown-synced preparation lines.

**Dependencies**: Wave 3 (`TerminalDisplay.svelte` exists), Wave 4 (lobby layout scaffold)

**Steps**:

> Steps 5a and 5b can run **concurrently**. Step 5c integrates them.

**Step 5a** — Restyle `BetForm.svelte` completely

Changes from spec §5 (Resource Allocation panel) and §6.1:
- Floating label: `資源配分 RESOURCES` (Space Mono 9px, `--color-primary-dim`)
- Input label: `ALLOCATE CREDITS:`
- Input: amber text on `#080600` background, `#332800` border, block cursor via `caret-color: #ffb000`
- Preset buttons: bordered `[ 1 ] [ 5 ] [ 10 ] [ 50 ] [ 100 ]` (using WAGER_PRESETS from config)
  - Active/selected preset: amber border (`--color-primary`), others: dim border
- Submit button: `[ INITIATE BREACH ]` — amber border, transparent background, amber text
- Auto-cashout input: same terminal styling but smaller
- Error messages: red-tinted box with amber-dim text
- Countdown display: `WINDOW: Xs` below submit button (use `$countdown` derived store)
- Remove RTP notice (replaced by phase theming) — keep as comment if needed for regulatory

**Step 5b** — Prep terminal content (WAITING phase)

Create `src/client/lib/prep-terminal.ts`:
```typescript
import type { RoundTarget, TerminalLine } from '../../../types';

// Returns countdown-synced prep lines for a given secondsRemaining value.
// Called by App.svelte when phase === 'WAITING' to populate terminalLines.
// Requires the current roundTarget to inject the target IP into the nmap line.
export function getPrepLines(secondsRemaining: number, target: RoundTarget | null): TerminalLine[]
```

Lines from spec §7.7:
```
[00:08] Initializing proxy chain...
[00:07] > route add via tor-exit-DE
[00:06] > route add via tor-exit-BR
[00:05] > route add via tor-exit-JP
[00:04] Proxy chain: 6 bounces active.
[00:03] Loading exploit kit... [████████████████████] 100%
[00:02] $ nmap -sS {ip}...
[00:01] Payload staged. Awaiting operator.
```

Colors: route-add lines in `#00cc66` (success), others in `#805800` (dim amber).

In `App.svelte`: add a `$effect` that watches `$phase === 'WAITING'` and `$countdown`, calls `getPrepLines($countdown, $roundTarget)`, and updates `terminalLines` store accordingly. Emit lines one at a time (one per second of countdown, matching the server COUNTDOWN_TICK_MS).

**Step 5c** — Integrate `TerminalDisplay` into WAITING layout

In `App.svelte` lobby area, below the two panels:
```svelte
<div class="prep-terminal">
  <TerminalDisplay lines={$terminalLines} dim={true} maxHeight="120px" threatLevel="GHOST" />
</div>
```

**Step 5d** — Accessibility test: `src/client/__tests__/BetForm.test.ts` (update existing tests if any, or create)

```typescript
it('submit button is disabled when wager is empty', ...)
it('submit button is disabled when wager is below MIN_WAGER', ...)
it('submit button is enabled with valid wager', ...)
it('preset button fills wager input', ...)
it('error message is shown when lastError store has a value', ...)
```

**Test runner**: Component tests (vitest.svelte.config.ts)

**PR scope**: `src/client/components/BetForm.svelte`, `src/client/lib/prep-terminal.ts`, `App.svelte` (WAITING terminal integration), `src/client/__tests__/BetForm.test.ts`

---

## Wave 6: Terminal Content Engine

**Goal**: Build the procedural hack narrative system. During RUNNING phase, `terminalLines` fills with tier-appropriate content driven by the current multiplier, creating the live intrusion narrative.

**Dependencies**: Wave 2 (`terminalLines` store, `displayMultiplier` store, `prng.ts`), Wave 3 (`TerminalDisplay` exists)

**Steps**:

> Steps 6a and 6b can run **concurrently** (pools vs engine logic). Step 6c wires them together.

**Step 6a** — Content pools: `src/client/lib/terminal-content-pools.ts`

Define all static data:
- Variable pools: `HOSTNAMES`, `IPS`, `USERS`, `OS_VERSIONS`, `SENSITIVE_FILES`, `FILENAMES`, `NEXT_HOSTS`, `AGENCIES`, `TICKETS`, `INTERFACES`, `PORTS`, `UPTIMES` (from spec §7.4)
- Line templates organized by tier (1–6) with `text`, `color`, `type` fields (from spec §7.3)
- Progress bar template pool
- Corrupted text variants (tier 5–6)

**Step 6b** — Terminal content engine: `src/client/lib/terminal-content.ts`

```typescript
export interface TerminalSession {
  stop(): void;
}

export function startTerminalSession(
  roundId: number,
  getMultiplier: () => number,
  onLine: (line: TerminalLine) => void,
  onProgressUpdate: (id: number, newText: string) => void,
): TerminalSession
```

Logic:
1. On init: derive round-stable variables (`{hostname}`, `{ip}`) using `mulberry32(roundId)`. These persist throughout the session.
2. Pacing loop: maintain its own `setInterval` timer. Each iteration:
   - Read current multiplier via `getMultiplier()`
   - Determine current tier (spec §7.2)
   - Pick emission interval from pacing table (spec §7.5) with jitter (±20%)
   - Draw template from current tier, fill variables
   - Emit line via `onLine()`
3. Progress bars: when a progress template is drawn, start a progress update loop that replaces the last line over 3–8 seconds, then emits the "complete" line
4. Multi-line blocks: when a directory listing template is drawn, emit all lines with ~50ms delay between each
5. Corrupted text: inject Unicode block chars into tier 5–6 danger lines
6. Flashing danger lines (tier 6): set line `type: 'danger'` — TerminalDisplay will apply `pulse-fast` animation class to these

The engine uses a client-side salt per session (random, not seeded) for variety within tier templates.

**Step 6c** — Wire engine to App.svelte

In `App.svelte`:
- `$effect`: when `$phase === 'RUNNING'`, start terminal session; when phase changes away from RUNNING, call `session.stop()` and clear lines
- Pass `() => get(displayMultiplier)` as `getMultiplier`
- On `onLine`: `terminalLines.update(lines => { const next = [...lines, line]; return next.length > 200 ? next.slice(next.length - 200) : next; })` (append with 200-line cap — see "Terminal line cap" in Architectural Notes)
- On `onProgressUpdate`: `terminalLines.update(lines => lines.map(l => l.id === id ? {...l, text: newText} : l))` (replace in place)

Wire `TerminalDisplay` into RUNNING layout (placeholder was left in Wave 4):
```svelte
<TerminalDisplay
  lines={$terminalLines}
  maxHeight="flex"
  threatLevel={$threatLevel}
/>
```

**Step 6d** — Unit tests: `src/client/__tests__/terminal-content.test.ts`

```typescript
describe('getTierForMultiplier', () => {
  it('returns tier 1 at 1.0x', ...)
  it('returns tier 2 at 1.5x', ...)
  it('returns tier 6 at 30x+', ...)
})

describe('variable substitution', () => {
  it('fills {hostname} from pool', ...)
  it('reuses same hostname within session', ...)
  it('fills {agency} independently per line', ...)
})

describe('pacing', () => {
  it('emission interval decreases as multiplier increases', ...)
  it('applies jitter within ±20% of base interval', ...)
})

describe('session lifecycle', () => {
  // Use vi.useFakeTimers() to control timing
  it('emits lines at expected intervals for tier 1 multiplier', ...)
  it('emits lines at faster rate when multiplier increases', ...)
  it('stops emitting after session.stop() is called', ...)
  it('cleans up all intervals on stop', ...)
})

describe('progress bars', () => {
  it('emits initial progress line via onLine', ...)
  it('updates progress line in-place via onProgressUpdate', ...)
  it('emits completion line when progress reaches 100%', ...)
})
```

**Test runner**: `npm run test` (unit tests for pure logic in terminal-content.ts)

**PR scope**: `src/client/lib/terminal-content-pools.ts`, `src/client/lib/terminal-content.ts`, `App.svelte` (RUNNING terminal wiring), `src/client/__tests__/terminal-content.test.ts`

---

## Wave 7A: Running Phase — Display Components

**Goal**: Build the display-only components for the RUNNING phase: transformed Multiplier, ThreatMeter, ObserverBanner. These are pure display components with no state mutations. Splitting from 7B reduces blast radius of integration.

**Dependencies**: Wave 2 (threatLevel/dangerColors stores)

**Steps**:

> Steps 7Aa–7Ac run **fully concurrently**. Step 7Ad (tests) runs after.

**Step 7Aa** — Transform `Multiplier.svelte`

Changes:
- Font: Fira Code 3.5rem bold (replaces 4rem system-ui)
- Label above: `侵入中 LIVE HACK` (Space Mono, 9px, dim) — shown only during RUNNING
- Color: reads `$dangerColors.color`, applies inline `style:color`
- Glow: reads `$dangerColors` and applies `style:text-shadow` (from spec §9.2 table — note: these are per-level hardcoded values, NOT derived from `glowAlpha`)
- Smooth color transition: `transition: color 1s, text-shadow 1s`
- Critical glitch: at CRITICAL, add class `.glitch` and `data-text={value}` attribute. The `.glitch` and `gjit`/`g1`/`g2` keyframes are defined globally in App.svelte (Wave 1b) — this component just applies the class.
- STARTING phase: show `BREACHING...` in dim amber (replaces `STARTING...`)
- CRASHED phase: suppress — the CrashScreen (Wave 9) handles crash display
- The `CRASHED` label and shake animation are removed (replaced by full CrashScreen)
- Accessibility: sr-only aria-live unchanged

**Step 7Ab** — Create `src/client/components/ThreatMeter.svelte`

Props: `{ multiplier: number, threatLevel: ThreatLevel }`

Renders (from spec §8.2 and §8.3):
```
THREAT: ▓▓▓▓▓▓▓▓░░░░░░░░░░░░ ELEVATED
PROXIES: 6/6   IDS: silent   COVER: intact
```

- Bar uses `getThreatFillCount(multiplier)` from `threat.ts` for fill count
- 20 total chars: `▓` filled, `░` empty
- At CRITICAL: all 20 filled + pulsing animation + `!! CRITICAL` suffix
- Sub-indicators: `getSubIndicators(threatLevel)` from `threat.ts`
- Color: `--threat-color` for bar and label text
- Sub-indicator text: `--threat-dim` at 10px Fira Code

**Step 7Ac** — Create `src/client/components/ObserverBanner.svelte`

Props: `{ threatLevel: ThreatLevel }`

Renders (from spec §10.3):
```
監視中  OBSERVING — NOT IN THIS OP
```

Centered, 11px Fira Code, color: `--threat-dim`. No border, no button.

This component is used in **two** locations:
1. **Disconnect button area** (bottom of game-area) — when spectator during RUNNING
2. **Main area** during RUNNING — when a player missed the WAITING window and is spectating (spec §6.3 spectator variant), ObserverBanner replaces the bet form area. For this use, add an optional `expanded` prop that centers the text vertically and adds secondary text: "You did not join this operation" and a countdown to the next window.

**Step 7Ad** — Tests

`src/client/__tests__/ThreatMeter.test.ts`:
```typescript
it('renders 20-char bar', ...)
it('fills N chars at each threat level boundary', ...)
it('renders sub-indicators for each level', ...)
it('shows CRITICAL suffix at CRITICAL', ...)
```

**Test runner**: Component tests (vitest.svelte.config.ts)

**PR scope**: `Multiplier.svelte`, new `ThreatMeter.svelte`, new `ObserverBanner.svelte`, `src/client/__tests__/ThreatMeter.test.ts`

---

## Wave 7B: Running Phase — Interactive Components + Layout Integration

**Goal**: Build the interactive components (CashoutButton transform, ThreatPanel) and wire the full RUNNING layout together in App.svelte. This wave touches App.svelte's render tree and state management.

**Dependencies**: Wave 7A (display components exist), Wave 6 (terminal wired into RUNNING)

**Steps**:

> Steps 7Ba and 7Bb run **concurrently**. Step 7Bc (layout wiring) comes after both.

**Step 7Ba** — Transform `CashoutButton.svelte`

Changes from spec §10:
- Read `$threatLevel` store
- Three CSS classes: `.btn-low` (green border), `.btn-mid` (orange border), `.btn-crit` (red fill + pulse)
- Class applied based on threat: LOW/ELEVATED → `.btn-low`, HIGH/SEVERE → `.btn-mid`, CRITICAL → `.btn-crit`
- Text: `[ DISCONNECT ]` at LOW/ELEVATED/HIGH/SEVERE, `!! BAIL OUT !!` at CRITICAL
- Below button: `Cash out: {$displayMultiplier.toFixed(2)}x → {estimatedPayout} CR` line
  - `estimatedPayout` = `$players[$myPlayerId]?.wager * $displayMultiplier` — this is the **gross** payout (total the player would receive), consistent with spec §10.2 ("Cash out: X,XXX.XX CR")
  - Color: green-dim at low, orange-dim at mid, red-dim at critical
- Loading state: show `[ ... ]` during pending
- On cashout initiation: `cashoutThreatLevel.set($threatLevel)` before `sendCashout()`
- Spectator path handled by `ObserverBanner` (see Wave 7A), not this component

**Step 7Bb** — Create `src/client/components/ThreatPanel.svelte`

Props: `{ threatLevel: ThreatLevel, multiplier: number }`

Renders the Eva-style panel from spec §8.4:
```
脅威評価 THREAT ASSESSMENT
─────────────────────
STATUS    ELEVATED
PROXIES   6 / 6
IDS       1 alert
COVER     intact
```

- Section label: `脅威評価 THREAT ASSESSMENT` (JP accent + English)
- Visual escalation per spec §8.4:
  - GHOST–HIGH: `#332800` border
  - SEVERE: `#cc0000` border
  - CRITICAL: 2px `#ff0000` border + box-shadow glow, STATUS text pulsing
- Uses `getSubIndicators(threatLevel)` for values

**Step 7Bc** — Update `App.svelte` RUNNING layout

Wire all RUNNING components into the placeholder left in Wave 4:
```svelte
<!-- RUNNING phase layout -->
<div class="game-area">
  <div class="multiplier-section">
    <Multiplier />
    <ThreatMeter multiplier={$displayMultiplier} threatLevel={$threatLevel} />
  </div>
  <TerminalDisplay lines={$terminalLines} threatLevel={$threatLevel} />
  <div class="action-area">
    {#if $isInRound || hasCashedOutThisRound}
      <CashoutButton />
    {:else if $phase === 'RUNNING'}
      <ObserverBanner threatLevel={$threatLevel} />
    {/if}
  </div>
</div>
```

Note: `hasCashedOutThisRound` is tracked here (see "Cashout screen display guard" in Architectural Notes) and will be fully utilized in Wave 9 for cashout screen routing. For now it just keeps the CashoutButton visible after cashout confirmation until the cashout screen (Wave 9) replaces it.

Add `ThreatPanel` to sidebar (shown only during RUNNING):
```svelte
<aside class="sidebar">
  <PlayerList />
  {#if $phase === 'RUNNING'}
    <ThreatPanel threatLevel={$threatLevel} multiplier={$displayMultiplier} />
  {/if}
  <History />
</aside>
```

**Step 7Bd** — Tests

`src/client/__tests__/ThreatPanel.test.ts`:
```typescript
it('renders STATUS row matching threatLevel', ...)
it('applies SEVERE border class at SEVERE', ...)
it('applies CRITICAL border+shadow at CRITICAL', ...)
```

`src/client/__tests__/CashoutButton.test.ts` (update existing):
```typescript
it('shows DISCONNECT text at LOW threat', ...)
it('shows DISCONNECT text at HIGH threat', ...)
it('shows BAIL OUT text at CRITICAL threat', ...)
it('applies btn-crit class at CRITICAL', ...)
it('shows estimated payout below button', ...)
```

**Test runner**: Component tests (vitest.svelte.config.ts)

**PR scope**: `CashoutButton.svelte`, new `ThreatPanel.svelte`, `App.svelte` (RUNNING layout wiring + `hasCashedOutThisRound` state), `src/client/__tests__/ThreatPanel.test.ts`, `src/client/__tests__/CashoutButton.test.ts`

---

## Wave 8: Sidebar Transform — Operators + Recent Ops

**Goal**: Transform `PlayerList.svelte` and `History.svelte` to match the hacker theme's OPERATORS and RECENT OPS format. Light touch — functionality preserved, format and styling changed.

**Dependencies**: Wave 2 (threatLevel store), Wave 7B (ThreatPanel exists, sidebar layout finalized)

**Steps**:

> Steps 8a and 8b run **concurrently**. Step 8c (layout adjustment) runs after.

**Step 8a** — Transform `PlayerList.svelte` → OPERATORS panel

Changes from spec §15.1:
- Section label: `作戦員 OPERATORS` (JP accent + English, Space Mono 9px dim)
- Replace table with list format, each row: `{handle} {wager} {status}`
  - Handle: current threat color
  - Wager: dim color
  - Status during WAITING: `RDY` in green
  - Status during RUNNING (active): empty
  - Status after cashout: `DC X.XXx` in green
  - Status for spectators: `—` in dim
- `← YOU` marker: appended after current player's row in threat color
- At HIGH+ threat: cashed-out rows get `text-decoration: line-through` in dim color
- Remove auto-cashout badge (not in hacker UI)
- Section fits in 200px sidebar column
- Keep empty state (`No operators`) with dim styling

**Step 8b** — Transform `History.svelte` → RECENT OPS panel

Changes from spec §15.3:
- Section label: `最近 RECENT` (JP accent + English, Space Mono 9px dim)
- Format per entry: `#NNNN X.XXx`
  - `#NNNN`: round ID in dim color
  - `X.XXx`: crash point colored by existing `MULTIPLIER_RARITY_TIERS` (unchanged)
- "Verify" button: restyle as `[V]` or `[ verify ]` — small amber-bordered, monospace
- Keep VerifyModal integration unchanged
- Format: compact list, no horizontal borders between items (or very dim lines)

**Step 8c** — Minor sidebar CSS update in `App.svelte`

Ensure sidebar has `border-left: 1px solid var(--threat-border)` (was `#222`). Sidebar width is 200px, matching spec §15.

**Test plan**:

`src/client/__tests__/PlayerList.test.ts` (update existing):
```typescript
it('renders handle, wager, and RDY status during WAITING', ...)
it('shows DC X.XXx status for cashed-out player', ...)
it('appends ← YOU for current player', ...)
it('applies strikethrough at HIGH threat for cashed-out players', ...)
```

`src/client/__tests__/History.test.ts` (update existing):
```typescript
it('renders entries in #NNNN X.XXx format', ...)
it('colors crash points using rarity tiers', ...)
it('renders verify button per entry', ...)
```

**Test runner**: Component tests (vitest.svelte.config.ts)

**PR scope**: `PlayerList.svelte`, `History.svelte`, `App.svelte` (sidebar border), `src/client/__tests__/PlayerList.test.ts`, `src/client/__tests__/History.test.ts`

---

## Wave 9: Phase Screens — CrashScreen + CashoutScreen

**Goal**: Build the two full-area phase screens. `CrashScreen` replaces the main game area during CRASHED. `CashoutScreen` overlays the player's game area when they cash out.

**Dependencies**: Wave 2 (`cashoutThreatLevel` store), Wave 1 (palette/CSS vars)

**Steps**:

> Steps 9a and 9b run **fully concurrently**.

**Step 9a** — Create `src/client/components/CrashScreen.svelte`

Props: `{ crashPoint: number, isSpectator: boolean }`

Structure from spec §12:
- Outer container: `background: #0a0000`, contains two children (main panel + side panel)
- Main panel (`flex: 1`):
  - Hazard stripe top bar (14px, repeating-linear-gradient, amber/black)
  - Centered content: JP accent → TRACED → subtitle → crash multiplier
  - Hazard stripe bottom bar
- Side panel (220px, `border-left: 2px solid #cc0000`):
  - 状態報告 STATUS READOUT
  - Readout values: PROXIES, COVER, IDS (all at critical/blown values)
  - Agency block (randomly selected on mount from spec §12.4 pool)
  - Case/ref number (randomly generated on mount)
  - "ALL FUNDS SEIZED" line — hidden when `isSpectator` is true

Random agency selection: use `Math.random()` on mount (not seeded — crash screen variety is acceptable without consistency). Generate case number format per agency.

VHS band: include a single sweeping band (same as CRTOverlay, duplicated here for self-containment, or use `CRTOverlay` component wrapper).

All text from spec §12.2–§12.4.

**Step 9b** — Create `src/client/components/CashoutScreen.svelte`

Props: `{ payout: number, cashoutMultiplier: number, threatLevel: ThreatLevel }`

Three intensity tiers from spec §6.5:
- Tier 1 (GHOST–HIGH): JP accent `切断完了`, heading `CONNECTION TERMINATED`, subtitle from low pool
- Tier 2 (SEVERE): JP accent `緊急切断`, heading `EMERGENCY DISCONNECT`, subtitle from high pool, green border
- Tier 3 (CRITICAL): JP accent `神業`, heading `EMERGENCY DISCONNECT`, subtitle from critical pool, 2px border, intense glow, 3.5rem payout

Subtitle selection: `Math.random()` pick from appropriate pool (spec §11) on component mount.

Structure (all green-themed, from spec §6.5):
```
[JP accent]
[heading]
[subtitle]
─────────── (40% width divider)
+X,XXX.XX CR
DISCONNECTED @ X.XXx [— CLOSE CALL or — LEGENDARY for tier 2/3]
```

**Step 9c** — Wire phase screens into `App.svelte`

Currently, the main game area shows based on `$phase`. Add:

```svelte
{#if showCashoutScreen}
  <!-- Overlay cashout screen (player just cashed out) -->
  <CashoutScreen
    payout={lastCashoutPayout}
    cashoutMultiplier={lastCashoutMultiplier}
    threatLevel={$cashoutThreatLevel ?? 'GHOST'}
  />
{:else if $phase === 'CRASHED'}
  <CrashScreen
    crashPoint={$gameState?.crashPoint ?? 0}
    isSpectator={!wasInRound}
  />
{:else}
  <!-- WAITING / RUNNING game area -->
{/if}
```

New `App.svelte` state (see "Cashout screen display guard" in Architectural Notes):
- `hasCashedOutThisRound`: set `true` when `playerCashedOut` message arrives for `$myPlayerId` (already introduced in Wave 7Bc); set `false` on phase transition to `WAITING`
- `showCashoutScreen`: derived: `hasCashedOutThisRound && ($phase === 'RUNNING' || $phase === 'CRASHED')`. Do **NOT** derive from `$isInRound` transitioning false — that fires on crash too.
- `lastCashoutPayout`: stored when `playerCashedOut` arrives for `$myPlayerId` — use the `payout` field from the server's `playerCashedOut` message
- `lastCashoutMultiplier`: stored from the `multiplier` field of the server's `playerCashedOut` message (this is the server-authoritative cashout multiplier, more accurate than reading `$displayMultiplier` at cashout time)
- `wasInRound`: track whether current player was in the round (to determine spectator status for crash screen). Set `true` when `playerJoined` for `$myPlayerId`, cleared on WAITING.
- All cashout/round state cleared when phase transitions to WAITING

Note: `lastCrashResult` accounting still happens in existing `$effect` — the CrashScreen is purely visual.

**Step 9d** — Component tests: `src/client/__tests__/CrashScreen.test.ts`

```typescript
it('renders TRACED text', ...)
it('renders crash multiplier value', ...)
it('renders agency and case number', ...)
it('hides ALL FUNDS SEIZED when isSpectator=true', ...)
it('renders hazard stripes', ...)
```

**Step 9e** — Component tests: `src/client/__tests__/CashoutScreen.test.ts`

```typescript
it('renders tier 1 content for LOW threatLevel', ...)
it('renders EMERGENCY DISCONNECT heading for SEVERE', ...)
it('renders EMERGENCY DISCONNECT heading for CRITICAL', ...)
it('applies larger payout size at CRITICAL', ...)
it('formats payout with CR suffix', ...)
```

**Test runner**: Component tests (vitest.svelte.config.ts)

**PR scope**: `src/client/components/CrashScreen.svelte`, `src/client/components/CashoutScreen.svelte`, `App.svelte` (phase routing), `src/client/__tests__/CrashScreen.test.ts`, `src/client/__tests__/CashoutScreen.test.ts`

---

## Wave 10: CRT Effects Integration + Modal Restyling + Review Passes

**Goal**: Wire the full threat-level-driven visual escalation system. Restyle the three modals. Final polish and review.

**Dependencies**: All previous waves (everything must be settled before wiring effects)

**Steps**:

> Steps 10a–10d run **concurrently** (all wiring/restyle). Steps 10e–10g are sequential review passes.

**Step 10a** — CSS custom property updates in `App.svelte`

Add a `$effect` that updates CSS custom properties on `document.documentElement` whenever `$threatLevel` or `$dangerColors` changes:

```typescript
$effect(() => {
  const colors = $dangerColors;
  const root = document.documentElement;
  root.style.setProperty('--threat-color', colors.color);
  root.style.setProperty('--threat-dim', colors.dim);
  root.style.setProperty('--threat-bg', colors.bg);
  root.style.setProperty('--threat-border', colors.border);
  root.style.setProperty('--threat-glow-alpha', String(colors.glowAlpha));
});
```

Also add background pulse at CRITICAL:
```typescript
$effect(() => {
  const el = document.documentElement;
  if ($threatLevel === 'CRITICAL') {
    el.classList.add('threat-critical');
  } else {
    el.classList.remove('threat-critical');
  }
});
```

CSS in App.svelte global:
```css
:global(.threat-critical) {
  animation: bg-crisis 1.2s infinite;
}
```
(`@keyframes bg-crisis` defined in CRTOverlay and imported, or duplicated here)

**Step 10b** — Wire CRTOverlay into terminal and app container

Wrap the `TerminalDisplay` container in `App.svelte` with `CRTOverlay threatLevel={$threatLevel}`.
Ensure `TerminalDisplay` passes `threatLevel` down to its own internal `CRTOverlay` wrapper (already designed in Wave 3).
Confirm the `CRTOverlay` flicker class and VHS band visibility are correctly driven by `$threatLevel`.

**Step 10c** — ConnectionStatus simplification

Per spec §14: the latency indicator is always green when connected. `ConnectionStatus.svelte` currently shows different colors for reconnecting/disconnected. Simplify:
- **Connected**: green `●` + `NNms` in `--color-success` — always green regardless of threat level
- **Reconnecting**: dim amber `○` + `RECONNECTING` in `--color-primary-dim` — brief, unobtrusive
- **Disconnected**: dim red `●` + `OFFLINE` in `--color-critical-dim` — visible but not alarming
- The key change is removing the multi-color connected states (was green/yellow/red based on latency) — it's now always green when connected.

**Step 10d** — Restyle modals (3 parallel sub-tasks)

**NameModal.svelte** → "Choose Your Handle":
- Title: `CHOOSE YOUR HANDLE`
- Hint: `Enter your handle:` (terminal prompt style)
- Input: amber text on `#080600`, `#332800` border, blinking block cursor
- Buttons: `[ CONFIRM ]` (amber border) and `[ SKIP ]` (dim)
- Dialog: `background: #080600`, `border: 1px solid #332800`
- Keep all existing functionality unchanged

**FairnessModal.svelte** → "Provably Fair":
- Title in Space Mono, amber
- Body text in Fira Code, amber
- Section dividers as dim horizontal rules
- Keep all existing content and scrollability

**VerifyModal.svelte** → "Operation Verification":
- Monospace grid for seed/hash values (already monospace, just recolor)
- Amber/dark palette
- Keep all functionality

**Step 10e** — Visual QA pass

Compare rendered app (dev server) against mockup files:
- `docs/mockups/hacker-concepts-v4.html` (most recent, final decisions)
- Check each phase: WAITING, RUNNING (GHOST/LOW), RUNNING (ELEVATED), RUNNING (HIGH/SEVERE), RUNNING (CRITICAL), CRASHED, CASHOUT
- Check sidebar at each phase
- Check header across phases
- Check modals

Document any discrepancies in a review note. Fix critical issues (wrong colors, missing elements). Minor deviations acceptable if intentional.

**Step 10f** — Performance audit

With browser DevTools open, check during RUNNING phase at high multiplier:
- Are there excessive `paint` events from text-shadow on the multiplier? (Expected: yes, but acceptable since multiplier already repaints every 100ms)
- Is the terminal list append causing full list re-render? (Should be mitigated by `key` on each line)
- Is the `$effect` CSS property update causing unnecessary reflows? (Should be minimal — only style property changes)
- Check that `transform`-based animations (glitch, VHS sweep) are compositor-only

Document findings. Fix any paint-thrash issues found.

**Step 10g** — Cross-browser check

Test in:
- Chrome (primary)
- Firefox (CSS clip-path + filter support for glitch effect)
- Safari (CRT pseudo-elements, CSS custom properties in animation keyframes)

Note any visual differences. Fix if easily addressable.

**Step 10h** — Tests for CSS property wiring

`src/client/__tests__/App.test.ts` (or add to existing):
```typescript
it('updates --threat-color CSS var when threatLevel changes', ...)
it('adds threat-critical class at CRITICAL', ...)
it('removes threat-critical class below CRITICAL', ...)
```

**Step 10i** — Integration test: full threat escalation flow

`src/client/__tests__/threat-integration.test.ts`:
```typescript
// Mount App with a mock socket, drive displayMultiplier through all 6 levels,
// and verify the full chain propagates correctly at each level.
describe('threat escalation integration', () => {
  for (const [multiplier, expectedLevel, expectedColor] of [
    [1.0, 'GHOST', '#ffb000'],
    [1.5, 'LOW', '#ffb000'],
    [3.0, 'ELEVATED', '#ff8c00'],
    [7.0, 'HIGH', '#ff6600'],
    [15.0, 'SEVERE', '#ff4400'],
    [30.0, 'CRITICAL', '#ff0040'],
  ]) {
    it(`at ${multiplier}x: threatLevel=${expectedLevel}, --threat-color=${expectedColor}`, ...)
  }
})
```

This catches wiring bugs between `displayMultiplier → threatLevel → dangerColors → CSS custom properties → component classes`. Individual unit tests verify each step, but only this integration test verifies the full chain.

**Test runner**: Component tests (vitest.svelte.config.ts)

**PR scope**: `App.svelte` (CSS effects wiring), `ConnectionStatus.svelte`, `NameModal.svelte`, `FairnessModal.svelte`, `VerifyModal.svelte`, `src/client/__tests__/App.test.ts`, `src/client/__tests__/threat-integration.test.ts`, review notes document

---

## Full Dependency Graph

```
Wave 0 (Baseline)
       ↓
Wave 1 (Palette+Keyframes)     Wave 2 (Stores/Types)
       ↓                              ↓
       └───────────── Wave 3 (CRTOverlay + TerminalDisplay)
                              ↓
       Wave 4 (Header + Layout) ←── Wave 2
                ↓
       Wave 5 (Lobby + BetForm) ←── Wave 3
                ↓
       Wave 6 (Terminal Engine)
                ↓
       Wave 7A (Display Components) ←── Wave 2
                ↓
       Wave 7B (Interactive + Layout) ←── Wave 7A, Wave 6
                ↓
       Wave 8 (Sidebar) ←──────────── Wave 2, Wave 7B
                ↓
       Wave 9 (Phase Screens) ←────── Wave 2, Wave 7B (hasCashedOutThisRound)
                ↓
       Wave 10 (CRT Wiring + Polish) ← All waves
```

Waves 0 is a prerequisite for all other waves. Waves 1 and 2 can start simultaneously after Wave 0. Waves 3 and 4 can overlap (Wave 3 doesn't need Wave 4 and vice versa). Wave 7A can start as soon as Wave 2 is done (doesn't need the CRT overlay). Wave 9 can run in parallel with Wave 8 (different components, different files).

---

## Test Summary

| Wave | Test Type | File(s) | Runner |
|---|---|---|---|
| 0 | Baseline | (all existing tests) | all runners |
| 2 | Unit | `threat.test.ts` | `npm run test` |
| 3 | Component | `CRTOverlay.test.ts`, `TerminalDisplay.test.ts` | vitest.svelte.config.ts |
| 4 | Component | `TargetInfo.test.ts` | vitest.svelte.config.ts |
| 5 | Component | `BetForm.test.ts` | vitest.svelte.config.ts |
| 6 | Unit | `terminal-content.test.ts` | `npm run test` |
| 7A | Component | `ThreatMeter.test.ts` | vitest.svelte.config.ts |
| 7B | Component | `ThreatPanel.test.ts`, `CashoutButton.test.ts` | vitest.svelte.config.ts |
| 8 | Component | `PlayerList.test.ts`, `History.test.ts` | vitest.svelte.config.ts |
| 9 | Component | `CrashScreen.test.ts`, `CashoutScreen.test.ts` | vitest.svelte.config.ts |
| 10 | Component + Integration | `App.test.ts`, `threat-integration.test.ts` | vitest.svelte.config.ts |

---

## File Change Inventory

### New Files
```
src/client/lib/threat.ts              — getThreatLevel, getDangerColors, getThreatFillCount, getSubIndicators
src/client/lib/prng.ts                — mulberry32, seededPick, generateRoundTarget
src/client/lib/prep-terminal.ts       — getPrepLines (countdown-synced WAITING content)
src/client/lib/terminal-content-pools.ts — line templates, variable pools
src/client/lib/terminal-content.ts    — startTerminalSession engine
src/client/components/CRTOverlay.svelte
src/client/components/TerminalDisplay.svelte
src/client/components/TargetInfo.svelte
src/client/components/ThreatMeter.svelte
src/client/components/ThreatPanel.svelte
src/client/components/ObserverBanner.svelte
src/client/components/CrashScreen.svelte
src/client/components/CashoutScreen.svelte
src/client/__tests__/threat.test.ts
src/client/__tests__/CRTOverlay.test.ts
src/client/__tests__/TerminalDisplay.test.ts
src/client/__tests__/TargetInfo.test.ts
src/client/__tests__/BetForm.test.ts       (new or updated)
src/client/__tests__/terminal-content.test.ts
src/client/__tests__/ThreatMeter.test.ts
src/client/__tests__/ThreatPanel.test.ts
src/client/__tests__/CashoutButton.test.ts (updated)
src/client/__tests__/PlayerList.test.ts    (updated)
src/client/__tests__/History.test.ts       (updated)
src/client/__tests__/CrashScreen.test.ts
src/client/__tests__/CashoutScreen.test.ts
src/client/__tests__/App.test.ts           (new or updated)
src/client/__tests__/threat-integration.test.ts
```

### Modified Files
```
index.html                             — font links (Wave 1)
src/types.ts                           — ThreatLevel, TerminalLine, RoundTarget, DangerColors (Wave 2)
src/client/lib/stores.ts               — threatLevel, dangerColors, terminalLines, roundTarget, cashoutThreatLevel (Wave 2)
src/client/lib/message-handler.ts      — roundTarget generation, terminalLines reset on WAITING (Wave 2)
src/client/App.svelte                  — header, layout, CSS vars, phase routing (Waves 1/4/5/6/9/10)
src/client/components/Multiplier.svelte     — font, threat colors, glitch (Wave 7)
src/client/components/BetForm.svelte        — full terminal restyle (Wave 5)
src/client/components/CashoutButton.svelte  — three states, threat-level (Wave 7)
src/client/components/PlayerList.svelte     — operators format (Wave 8)
src/client/components/History.svelte        — recent ops format (Wave 8)
src/client/components/ConnectionStatus.svelte — always-green simplification (Wave 10)
src/client/components/NameModal.svelte      — terminal restyle (Wave 10)
src/client/components/FairnessModal.svelte  — terminal restyle (Wave 10)
src/client/components/VerifyModal.svelte    — terminal restyle (Wave 10)
```

### Unchanged
```
src/server/**                          — never touched
src/config.ts                          — never touched (MULTIPLIER_RARITY_TIERS preserved)
src/client/lib/balance.ts              — never touched
src/client/lib/commands.ts             — never touched
src/client/lib/socket.ts               — never touched
src/client/lib/verify.ts               — never touched
src/client/lib/rarity.ts               — never touched (used by History + PlayerList)
src/client/components/GameStatus.svelte — removed from render tree in Wave 4 (see "Phase label mapping" in Architectural Notes); file kept on disk until Wave 10 cleanup
```

---

## Critical Path

The minimum path to a reviewable RUNNING phase experience:

**Wave 0 → Wave 1 → Wave 2 → Wave 7A → Wave 7B → Wave 10**

This delivers: baseline snapshot, amber palette + shared keyframes, threat-level stores, transformed multiplier with threat colors and glitch, ThreatMeter, three-state cashout button, CRT effects wiring.

Everything else (terminal content, lobby, sidebar, phase screens) is additive layering on top of this critical path.
