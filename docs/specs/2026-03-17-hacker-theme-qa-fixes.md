# Hacker Theme — Visual QA Fix Specification

**Date**: 2026-03-17
**Status**: Draft — Updated after mockup session (Fix 4/6/11 consolidated)
**Relates to**: `docs/specs/2026-03-17-hacker-theme.md` (addendum)
**Mockups**: `docs/mockups/crash-transition-mockup.html`, `docs/mockups/cashout-transition-mockup.html`

This spec covers 10 issues identified during Step 10e Visual QA (Fix 11 merged into Fix 6). All changes are client-side unless noted.

---

## Fix 1 — `[ verify ]` Button Wraps at Large Multipliers

**Problem**: The `[ verify ]` button text breaks onto two lines in the sidebar history panel when crash-point values are large (e.g. `100.00x`), because the row tries to fit round ID + multiplier + button in a narrow sidebar.

**Desired behavior**: `[ verify ]` never wraps. The button text is always single-line. The crash-point value may truncate or the row may overflow rather than wrapping the button.

**Solution**: Add `white-space: nowrap` to `.verify-btn`. Ensure `.crash-point` has `overflow: hidden; text-overflow: ellipsis` and a reasonable `max-width` so it absorbs overflow before the button does.

---

## Fix 2 — Disconnect Button Jank (Position Changes as Terminal Grows)

**Problem**: During the RUNNING phase the action area (`CashoutButton` / `ObserverBanner`) sits below `TerminalDisplay`. As terminal lines accumulate the display grows from 0 → 280px, shifting the button downward. This makes it a moving target that is hard to click.

**Desired behavior**: The button is anchored at a fixed vertical position from the start of the RUNNING phase. It does not move as terminal content grows.

**Solution**: Apply `min-height: 280px` to the `TerminalDisplay` container in App.svelte (matching the existing `maxHeight="280px"` prop), so the terminal occupies a fixed-height slot from the first line onward. The button position remains stable throughout the round.

---

## Fix 3 — BetForm Visual Prominence and Column Order

**Problem**: The BetForm ("Resources" panel) is the primary interactive element during the WAITING phase but is visually under-stated relative to the TargetInfo brief and appears on the right (secondary) side of the two-column lobby layout.

**Desired behavior**:
- BetForm appears in the **left column** (primary visual position in LTR reading order).
- TargetInfo appears in the **right column** (reference material, read after the form).
- BetForm has a visually brighter border — `1px solid var(--color-primary-mid)` instead of `var(--color-border)` — making it stand out as the primary affordance.
- The panel label (`リソース RESOURCES`) is also rendered in `--color-primary-mid` (amber mid) rather than the current dim.

---

## Fix 4 — Cashout Screen: Live Multiplier + Cashout Card + Sidebar

**Problem**: After cashing out, the entire viewport is replaced by the cashout confirmation screen (`full-span` grid class). The player can no longer see the sidebar (other players' cashouts, live multiplier progress via PlayerList), the live multiplier, or the terminal — they cannot follow the remainder of the round at all.

**Desired behavior**: The cashout state uses the RUNNING layout skeleton with the cashout card replacing the terminal and action area. The multiplier stays live.

**Reference mockup**: `docs/mockups/cashout-transition-mockup.html` — Option A (Tier 1 and Tier 2).

### Layout during cashout

The two-column grid is preserved (main column + sidebar). The main column contains:

1. **Multiplier section** — **live**, identical to RUNNING. The round is still going. `侵入中 LIVE HACK` label, live multiplier value, ThreatMeter bar with sub-indicators — all updating in real time. The player can watch the multiplier climb past their exit point (or crash).

2. **Cashout card** — replaces the terminal display and action area. Uses v3 green styling throughout (all tiers use `#00cc66` / `#006633` — no red/orange even for high-threat escapes):
   - **Tier 1** (GHOST through ELEVATED): `切断完了` / CONNECTION TERMINATED. Calm, professional. Green text, subtle glow. `+350.00 CR`. `DISCONNECTED @ 3.50x`.
   - **Tier 2** (HIGH / SEVERE): `緊急切断` / EMERGENCY DISCONNECT. More dramatic subtitle text. Green border + subtle green glow. `ESCAPED @ 14.72x — CLOSE CALL`.
   - **Tier 3** (CRITICAL): `神業` / EMERGENCY DISCONNECT. Maximum glow, larger payout text. `ESCAPED @ 47.21x — LEGENDARY`.
   - All tiers use green colors — the relief of escape is always green regardless of threat level.

3. **No terminal** — the terminal is hidden during cashout. The cashout card fills this space.

4. **No action area** — no buttons. The player is out.

5. **Sidebar** — unchanged from RUNNING: `PlayerList` (local player shows `DC 3.50x`, others still `LIVE`), `ThreatPanel` (still updating), `History`.

### `showCashoutScreen` scope change

Currently `showCashoutScreen` is true during both RUNNING and CRASHED. It should be scoped to RUNNING only — when the round crashes, the crash panel always takes over regardless of whether the player had cashed out.

---

## Fix 5 — Player Handle Not Obviously Clickable in Header

**Problem**: After the hacker theme restyle, the player's handle in the header is rendered as plain text with no visual affordance indicating it is clickable. Users cannot discover name-change functionality without already knowing it exists.

**Desired behavior**: The handle is visually distinguished as interactive. The handle text is wrapped in `[` `]` brackets: `[ handle-name ]`, where the brackets are rendered in `--color-primary-dim` and the name in `--color-primary`. This matches the bracket-button idiom used throughout the UI (`[ DISCONNECT ]`, `[ verify ]`, `[ CONFIRM ]`) and makes the affordance self-evident to the player.

When no name is set, the fallback reads `[ set handle ]` rather than bare `set handle`.

---

## Fix 6 — Crash Screen: Full Main-Column Takeover + Sidebar Preserved

> **Note**: This fix now incorporates Fix 11 (crash state augmentation). They have been merged into a single unified approach based on the mockup session of 2026-03-17.

**Problem**: During the CRASHED phase the CrashScreen component is wrapped in `.full-span`, which collapses the two-column grid to a single wide block. The sidebar disappears entirely and the overall layout changes shape, which is visually jarring. The multiplier, terminal, and sidebar all vanish simultaneously.

**Desired behavior**: The CRASHED phase takes over the **main column only** with a v3 Option A-style crash panel. The sidebar remains visible throughout. No terminal is shown during crash.

**Reference mockup**: `docs/mockups/crash-transition-mockup.html` — Option A (FBI and NSA variants).

### Layout during CRASHED phase

The two-column grid is preserved (main column + sidebar). The main column becomes a single crash panel:

1. **Crash panel** — fills the entire main column. Contains:
   - **Hazard stripes** at the top and bottom edges (14px amber diagonal bars, full width).
   - **`警告 — 追跡完了`** Japanese accent text (`#cc0000`, small).
   - **`TRACED`** in large text (2.8rem, `#cc0000`, letter-spacing 0.3em, red text-shadow glow).
   - **Agency subtitle** — rotating text from `pickAgency()`, e.g. `OPERATOR COMPROMISED — ALL SESSIONS TERMINATED` or `SIGNAL INTERCEPTED — OPERATOR LOCATED` (`#ff6a00`, 0.8rem).
   - **Crash multiplier** — the crash point value (2rem, `#ff0040`, red glow).
   - **Agency name + case reference** — e.g. `FBI CYBER DIVISION` / `CASE #2026-CF-84729`, separated by a thin divider line.
   - **`ALL FUNDS SEIZED`** — shown only if the player was in the round and did not cash out (`#ff0040`, Space Mono bold). Not shown for spectators or players who cashed out.
   - VHS scan line overlay for CRT feel.
   - Background `#0a0000`, no terminal output visible.

2. **No terminal** — the terminal is hidden during crash. The crash panel fills this space.

3. **No status readout** — the old CrashScreen's side-panel (PROXIES, COVER, IDS readout) is removed. This information is already displayed by the sidebar's ThreatPanel, which stays visible.

4. **Sidebar** — `PlayerList` (showing TRACED/DC status per player), `ThreatPanel` (frozen at last threat level, border shifted to crash red), `History` (now includes the completed round).

### Component changes

- **`CrashScreen.svelte`**: Remove the `.side-panel` (status readout, agency block). Move agency name + case reference into the main content area. The component becomes a single centered panel with hazard stripes.
- **`App.svelte`**: Remove `.full-span` wrapper. Render `CrashScreen` in the main column with sidebar alongside. Update `showCashoutScreen` to exclude CRASHED phase.
- **`pickAgency()`**: Extract to `src/client/lib/crash-agency.ts` shared module (CrashScreen imports from there).

---

## Fix 7 — Target Hostname Should Look Like a Domain

**Problem**: The `hostname` field in `RoundTarget` is generated from a pool of bare server names (`srv-prod-web-03`, `db-primary-01`, etc.) which look like internal DNS shortnames. The header displays this hostname next to the org name, but it does not look like a real internet-facing hostname. Users familiar with networking will find it implausible.

**Desired behavior**: Hostnames in the pool are **fully-qualified domain names** (FQDNs) in a plausible corporate format, e.g. `api.nexus-biotech.net`, `db-primary.ellingson.corp`, `mail.orca-capital.io`. The TLD and subdomain structure should vary to feel realistic. The header `HOST:` value and the TargetInfo panel should both show the FQDN.

Implementation: Update the `HOSTNAMES` array in `prng.ts` to contain FQDNs. The `RoundTarget.hostname` field is already a string so no type changes are needed.

---

## Fix 8 — CLI Output: Solid-Square Characters

**Problem**: A significant number of characters in the terminal (CLI) output render as solid squares (☐), suggesting the loaded web font (`Fira Code` via Google Fonts) does not include glyphs for those code points.

**Root cause**: Two issues:
1. **Mid-word `██` corruption** (TIER5 lines like `li██ integrity fa██ure`, `li██ is not re░dy`): The `█` character (U+2588 FULL BLOCK) is present in Fira Code, but the mid-word placement looks identical to a broken glyph rendering to the user. It is indistinguishable from a missing-glyph box.
2. **Japanese accent text** (component labels like `作戦員 OPERATORS`, `最近 RECENT`, `脅威評価 THREAT ASSESSMENT`, modal subtitles): `Fira Code` and `Space Mono` do not include CJK glyphs. On systems without a monospace CJK fallback the characters render as boxes.

**Desired behavior for Fix 8a (terminal corruption effect)**:
Replace mid-word `██` usage with `??` — e.g. `li?? integrity fa??ure`, `li?? is not re?dy`. `?` is universally supported and reads as "garbled/unknown" without looking like a rendering error. Standalone `██ TEXT ██` framing in TIER6 (e.g. `██ DISCONNECT NOW ██`) is intentional and should remain, but the surrounding spaces make it obvious it is a design choice rather than a broken glyph.

**Desired behavior for Fix 8b (Japanese text fallback)**:
Japanese text is purely decorative (tiny accent labels, never the primary content). The fix uses the **system-ui approach**: wrap Japanese text in a `font-family: system-ui, sans-serif` inline style or a shared utility class. This costs zero extra network requests. Monospace alignment of Japanese characters is not required — they are displayed at small sizes where the alignment difference is imperceptible. Do **not** add a new Google Fonts request for Noto Sans Mono.

---

## Fix 9 — Crash State Duration: 5s → 10s

**Problem**: The CRASHED phase currently lasts 5 seconds (`CRASHED_DISPLAY_MS = 5_000` in `src/config.ts`). This is too short for players to read the crash screen, see the agency that traced them, and mentally process the outcome before the next round begins.

**Desired behavior**: The crash phase lasts **10 seconds**. This is a shared constant (`src/config.ts`) used by both the server game loop and the client. The change is a one-line edit to `CRASHED_DISPLAY_MS`.

**Scope note**: `config.ts` is shared between server and client. This change touches server timing (the alarm that advances game state from CRASHED → WAITING). It is a safe, intentional tuning change.

---

## Fix 10 — History Recent Ops Multipliers: Borderlands Colors → Threat Colors

**Problem**: Crash-point values in the sidebar's RECENT OPS history panel are colored with the Borderlands rarity scheme (`getRarityColor`) — grey, green, blue, purple, orange, yellow — which is inconsistent with the rest of the hacker theme's threat-color palette.

**Desired behavior**: History crash-point values are colored using the same threat-level color scale used by the live multiplier, ThreatMeter, and the rest of the UI:

| Range | Level | Color |
|---|---|---|
| < 2x | GHOST / LOW | `#ffb000` (amber) |
| 2x – 4.99x | ELEVATED | `#ff8c00` |
| 5x – 9.99x | HIGH | `#ff6600` |
| 10x – 24.99x | SEVERE | `#ff4400` |
| ≥ 25x | CRITICAL | `#ff0040` |

Implementation: `History.svelte` replaces the `getRarityColor(entry.crashPoint)` call with a new helper `getThreatColor(multiplier: number): string` that maps the crash point to the threat palette. This helper can be defined in `threat.ts` (alongside `getThreatLevel` and `getDangerColors`) by composing the two existing functions: `getDangerColors(getThreatLevel(multiplier)).color`. `getRarityColor` and `rarity.ts` are otherwise unchanged (they may still be used elsewhere).

The `History.test.ts` color assertions must be updated to expect threat colors rather than Borderlands rarity colors.

---

## ~~Fix 11~~ — Merged into Fix 6

> **Consolidated**: The original Fix 11 ("augment multiplier section instead of replacing layout") has been merged into Fix 6 based on the mockup session of 2026-03-17. The approved approach is a full main-column takeover (v3 Option A style) rather than augmenting the multiplier section. See Fix 6 for the complete specification.

---

## Out of Scope

- Sound, mobile layout, multiplayer chat — deferred as per original hacker theme spec.
- The full-screen cashout/crash display decisions for mobile — deferred.
