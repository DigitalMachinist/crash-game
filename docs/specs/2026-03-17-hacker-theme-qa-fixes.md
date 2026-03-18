# Hacker Theme — Visual QA Fix Specification

**Date**: 2026-03-17
**Status**: Draft — Updated after second feedback pass (Fixes 13–20 added)
**Relates to**: `docs/specs/2026-03-17-hacker-theme.md` (addendum)
**Mockups**: `docs/mockups/crash-transition-mockup.html`, `docs/mockups/cashout-transition-mockup.html`, `docs/mockups/escaped-crash-mockup.html`

This spec covers issues identified during Step 10e Visual QA and subsequent feedback sessions. Fix 11 merged into Fix 6; Fix 12 added in first pass. Fixes 13–20 added in second feedback pass. All changes are client-side unless noted.

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

Currently `showCashoutScreen` is true during both RUNNING and CRASHED. It should remain true during both — when a player has cashed out and the round crashes, their cashout confirmation should persist rather than being replaced by the crash panel. The player already got their payout; showing them the crash screen is confusing and hides their success message.

Template priority: `showCashoutScreen` takes precedence over the CRASHED branch. If the player cashed out, they see their cashout card through the end of the round (including through the CRASHED phase).

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
   - **Max height**: `500px` with content centered vertically. Prevents the crash panel from stretching excessively on tall windows.

2. **No terminal** — the terminal is hidden during crash. The crash panel fills this space.

3. **No status readout** — the old CrashScreen's side-panel (PROXIES, COVER, IDS readout) is removed. This information is already displayed by the sidebar's ThreatPanel, which stays visible.

4. **Sidebar** — `PlayerList` (showing TRACED/DC status per player), `ThreatPanel` (frozen at last threat level, border shifted to crash red), `History` (now includes the completed round).

### Component changes

- **`CrashScreen.svelte`**: Remove the `.side-panel` (status readout, agency block). Move agency name + case reference into the main content area. The component becomes a single centered panel with hazard stripes.
- **`App.svelte`**: Remove `.full-span` wrapper. Render `CrashScreen` in the main column with sidebar alongside. `showCashoutScreen` keeps its current scope (RUNNING + CRASHED) — players who cashed out see their cashout card persist through the crash phase.
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

## Fix 12 — Waiting Phase Duration: 10s → 15s

**Problem**: The WAITING phase currently lasts 10 seconds (`WAITING_DURATION_MS = 10_000` in `src/config.ts`). This is too short for players to read the round info, set their wager, and join before the round starts.

**Desired behavior**: The waiting phase lasts **15 seconds**. This is a shared constant (`src/config.ts`) used by both the server game loop and the client. The change is a one-line edit to `WAITING_DURATION_MS`.

**Scope note**: Same scope as Fix 9 — `config.ts` is shared, this touches server timing (the alarm that advances from WAITING → STARTING). Safe, intentional tuning change.

---

---

## Fix 13 — Sidebar Width Consistency

**Problem**: `.app-main` uses `grid-template-columns: 1fr 180px` during WAITING/STARTING but switches to `1fr 200px` during RUNNING/CRASHED via the `.app-main.running` modifier. The narrower 180px sidebar during WAITING causes multiplier values in the History panel to get clipped.

**Desired behavior**: Sidebar width is 200px in all phases. The column proportions never change between game phases.

**Solution**: Remove the `grid-template-columns` override from `.app-main.running` in `App.svelte`. Change the base `.app-main` rule to `grid-template-columns: 1fr 200px`. The `.running` class may remain for any other purpose but no longer changes column widths.

---

## Fix 14 — Crash Screen: Red Background Pulse

**Problem**: The crash screen has a static dark-red background (`#0a0000`). The CRITICAL threat level already has a `bg-crisis` body animation, but the crash state has no analogous alarm effect.

**Desired behavior**: The main content area of the crash screen (between the two hazard stripes) pulses at approximately 1Hz with a sinusoidal red background — creating an alarm/siren effect. The hazard stripes themselves remain visually stable.

**Solution**: Add a `@keyframes crash-pulse` animation in `CrashScreen.svelte` cycling the `.main-content` background between `#0a0000` (base) and `#1e0000` (warm red). Duration 1s, `ease-in-out` timing (approximates sinusoidal). Applied directly to `.main-content`.

```css
@keyframes crash-pulse {
  0%, 100% { background: #0a0000 }
  50%      { background: #1e0000 }
}

.main-content {
  animation: crash-pulse 1s ease-in-out infinite;
}
```

**Reference**: `bg-crisis` in `App.svelte` uses the same pattern at 2s duration on `body`. The crash pulse is faster (1s) and scoped to the panel.

---

## Fix 15 — CRITICAL Threat: Cover "BLOWN" Wording

**Problem**: `getSubIndicators('CRITICAL')` in `threat.ts` returns `cover: 'BLOWN'`. "Blown" implies cover is already fully compromised and the operator is caught. At CRITICAL threat the player is *close* to being detected but can still disconnect safely — their cover is not yet gone.

**Desired behavior**: CRITICAL cover reads `'burning'`, continuing the escalation ladder: `intact → degrading → compromised → burning`. This conveys imminent danger without implying capture has occurred.

**Solution**: Change line in `threat.ts`:
```typescript
case 'CRITICAL':
  return { proxies: '0/6 EXPOSED', ids: 'ACTIVE HUNT', cover: 'burning' };
```

**Tests**: Update the `threat.test.ts` CRITICAL cover assertion from `'BLOWN'` to `'burning'`.

---

## Fix 16 — Player List: Remove You-Marker Artifact

**Problem**: In `PlayerList.svelte`, the local player's row includes a `← YOU` text marker inside the handle span. At 9px in `Fira Code`, the `←` character renders ambiguously (resembling `+`). Combined with the handle's `text-overflow: ellipsis`, this produces a `+...` artifact immediately before the wager amount, which communicates nothing useful.

**Desired behavior**: No text marker appears before the wager amount. The local player's row is already distinguished by the existing `.operator-row.me` background highlight.

**Solution**: Remove the `{#if player.playerId === $myPlayerId}<span class="you-marker">← YOU</span>{/if}` block and its associated `.you-marker` CSS rules from `PlayerList.svelte`.

---

## Fix 17 — History Panel: "Recent Ops" Label

**Problem**: The History panel label reads `最近 RECENT`, which is generic and doesn't match the operational framing used elsewhere in the UI.

**Desired behavior**: Label reads `最近 RECENT OPS`.

**Solution**: Change `.panel-label` text in `History.svelte` from `最近 RECENT` to `最近 RECENT OPS`.

**Tests**: Update any test asserting the exact panel label text.

---

## Fix 18 — Initiate Breach: Disable After Player Joins

**Problem**: The `[ INITIATE BREACH ]` button in `BetForm.svelte` is disabled only for invalid wager input. After the player successfully joins the round, `$players[$myPlayerId]` is populated but the button remains visually active with no indication it cannot be used again.

**Desired behavior**:
- After joining, the button is disabled.
- The button text changes to `[ BREACH INITIATED ]`.
- A small status line appears below: `AWAITING ROUND START`.
- The existing `disabled` CSS style (opacity 0.35, cursor not-allowed) applies to the joined state.

**Solution**:
- Add `players` and `myPlayerId` to `BetForm.svelte`'s store imports.
- Derive `const hasJoined = $derived($players[$myPlayerId] !== undefined)`.
- Button: `disabled={!isValid || hasJoined}`.
- Button text: `{hasJoined ? '[ BREACH INITIATED ]' : '[ INITIATE BREACH ]'}`.
- Add `{#if hasJoined}<div class="join-status">AWAITING ROUND START</div>{/if}` below the button.
- Style `.join-status`: `font-size: 10px; color: var(--color-primary-dim); text-align: center; margin-top: 0.25rem; letter-spacing: 0.08em`.

---

## Fix 19 — Escaped Player: System Lockout View on Crash

**Problem**: When a player has cashed out and the round subsequently crashes, the `showCashoutScreen` branch shows only the cashout card — there is no indication that the crash occurred.

**Desired behavior**: When `showCashoutScreen && $phase === 'CRASHED'`, the main column shows a compact "SYSTEM LOCKOUT" panel stacked above the cashout card. The lockout panel:
- Uses the same visual structure as `CrashScreen` (hazard stripes, VHS band, red pulse background, agency name + case ref).
- Replaces `TRACED` with `SYSTEM LOCKOUT` — the system crashed, but the player was not caught.
- Uses a separate pool of mitigation-framed subtitles rather than agency arrest subtitles (e.g. `REMOTE FAILSAFE ACTIVATED — UNABLE TO RECONNECT`, `INTRUSION COUNTERMEASURES DEPLOYED — CONNECTION SEVERED`, `TARGET HOST INITIATED EMERGENCY ISOLATION PROTOCOL`).
- Still shows the crash multiplier and agency name + case ref.
- Does **not** show `ALL FUNDS SEIZED`.
- Is compact (`min-height: ~200px`) so the cashout card is visible beneath it without scrolling.
- JP accent: `接続不能 — システム停止` ("Unable to connect — System stopped").

**Reference mockup**: `docs/mockups/escaped-crash-mockup.html` — Sections A and B.

**Layout in `showCashoutScreen + CRASHED` branch** (replaces multiplier section):
```
[ CrashScreen isEscaped=true ]   ← compact SYSTEM LOCKOUT panel
[ CashoutScreen ]                ← cashout card below
```
No multiplier display, no ThreatMeter — the round is over.

**Component changes**:
- `CrashScreen.svelte`: add `isEscaped?: boolean` prop. When true: use `SYSTEM LOCKOUT` heading, `接続不能 — システム停止` JP accent, pick subtitle from a separate lockout pool, reduce `min-height` to `200px`, omit `ALL FUNDS SEIZED`.
- `crash-agency.ts`: add `LOCKOUT_SUBTITLES` string array and exported `pickLockoutSubtitle(): string` function.
- `App.svelte`: in the `showCashoutScreen + CRASHED` case, replace the multiplier section with `<CrashScreen isEscaped={true} crashPoint={$gameState?.crashPoint ?? 0} />` above `<CashoutScreen />`.

**Tests**: `CrashScreen.test.ts` — add tests for `isEscaped` prop: SYSTEM LOCKOUT text is visible; TRACED text is absent; ALL FUNDS SEIZED is absent.

---

## Fix 20 — Disconnected Player: Threat Assessment Frozen to Safe State

**Problem**: After a player cashes out, the `ThreatPanel` in the sidebar continues to update with the live round threat level. The threat escalates as the round continues, suggesting the player is still at risk when they are not.

**Desired behavior**: When the local player has disconnected (cashed out), the `ThreatPanel` shows a frozen safe-state readout that no longer responds to the live multiplier. The values indicate the player's connection is dark and their tracks are covered:

| Key | Value |
|-----|-------|
| STATUS | OFFLINE |
| PROXIES | scrubbed |
| IDS | dark |
| COVER | restored |

The panel border changes to `var(--color-success-dim)` (`#006633`) and the value text color changes to `var(--color-success)` (`#00cc66`). The `severe` and `critical` border overrides do not apply. No pulse animation.

**Solution**:
- `ThreatPanel.svelte`: add `disconnected?: boolean` prop. When true, render the fixed safe-state values and apply a `.disconnected` CSS class (green border, green value text, no threat-level classes).
- `App.svelte`: in the `showCashoutScreen` branch, pass `disconnected={true}` to `<ThreatPanel>`.

```svelte
<!-- in showCashoutScreen branch -->
<ThreatPanel threatLevel={$threatLevel} multiplier={$displayMultiplier} disconnected={true} />
```

```css
/* ThreatPanel.svelte */
.threat-panel.disconnected {
  border-color: var(--color-success-dim);
}
.threat-panel.disconnected .val {
  color: var(--color-success);
}
```

**Tests**: Add a `ThreatPanel.test.ts` (or extend existing) test: when `disconnected={true}`, renders `OFFLINE`, `scrubbed`, `dark`, `restored` regardless of `threatLevel` prop value.

---

## Out of Scope

- Sound, mobile layout, multiplayer chat — deferred as per original hacker theme spec.
- The full-screen cashout/crash display decisions for mobile — deferred.
