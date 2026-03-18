# Prompt: Crash & Cashout Transition Mockup Session

## Purpose

This session produces two HTML mockups to resolve a design inconsistency in the implementation plan before writing a final spec and implementing. Specifically:

The QA fixes plan at `docs/plans/2026-03-17-hacker-theme-qa-fixes.md` currently has two overlapping fixes that address the crash state layout in incompatible ways:

- **Fix 6 (Wave B2)**: Preserve the sidebar during crash by removing the `full-span` wrapper from `CrashScreen.svelte`, keeping the existing component but constraining it to the main column only.
- **Fix 11 (Wave E)**: Retire `CrashScreen.svelte` entirely and augment the existing RUNNING layout with crash visual elements (hazard stripes, TRACED label) in-place, so the multiplier never moves.

These cannot both be implemented — B2 keeps CrashScreen, E removes it. The right approach needs to be decided by seeing a mockup. The same unresolved question exists for **Fix 4** (cashout screen layout), which currently also uses a full-span takeover.

The underlying UX problem driving both fixes: when the game transitions from RUNNING → CRASHED or RUNNING → CASHOUT, the entire main layout is replaced by a structurally different component. The multiplier disappears, the terminal disappears, the sidebar disappears. Users must re-parse the whole screen. The goal is for the multiplier to stay anchored in the same physical position and for the layout skeleton to never change shape — only the content within the main column's lower portion should change.

**Once mockups are approved**, the plan will be updated to replace B2 and Fix 11 with a single unified fix, and Fix 4 will be updated to match the same pattern for cashout. Implementation follows after that.

---

## Project Context

This is a crash game (think Bustabit) with a hacker/cyberpunk visual theme. The client is a Svelte 5 app. We are mid-way through a QA polish pass.

All visual reference lives in `docs/mockups/hacker-concepts-v4.html` — open it and use it as the authoritative style guide. Key design decisions:

- **Palette**: Amber base `#ffb000`, dim `#805800`, mid `#cc8800`. Background `#0a0800`. Success `#00cc66`. Threat escalation: ELEVATED `#ff8c00` → HIGH `#ff6600` → SEVERE `#ff4400` → CRITICAL `#ff0040`.
- **Fonts**: `Fira Code` (monospace, body/terminal), `Space Mono` (labels/headings). Load from Google Fonts.
- **CRT aesthetic**: Scanlines via `::before` pseudo-element, subtle phosphor glow on key text.
- **Hazard stripes**: `repeating-linear-gradient(-45deg, #ffb000, #ffb000 8px, #000 8px, #000 16px)` at 14px height.
- **Terminal lines**: Left-aligned monospace, colored by type (success `#00cc66`, warning `#cc8800`, danger `#ff4400`/`#ff0040`, normal `#805800`, command `#805800`).
- No border-radius anywhere — everything is sharp corners.

---

## Unified Layout Contract (the invariant these mockups must prove out)

The two-column grid and the position of the multiplier section must be identical across RUNNING, CRASHED, and CASHOUT states. Only the content-area and action-area change.

```
┌─────────────────────────────────┬─────────────────┐
│  multiplier-section             │                 │
│  (always at top of main col)    │    sidebar      │
├─────────────────────────────────┤  (always there, │
│  content-area                   │   PlayerList +  │
│  (swaps content per state)      │   ThreatPanel + │
├─────────────────────────────────┤   History)      │
│  action-area                    │                 │
│  (small strip at bottom)        │                 │
└─────────────────────────────────┴─────────────────┘
```

Approximate proportions: main col ~70% width, sidebar ~30% width. Main col total height ~500–600px. Multiplier section ~160px, content-area ~280px, action-area ~60px.

---

## What to Produce

Two self-contained HTML mockup files saved to `docs/mockups/`. Each shows the same layout skeleton in a different state. The visual comparison between them (and against the RUNNING state in hacker-concepts-v4.html) must make clear that the layout skeleton did NOT shift — only content changed.

Static HTML/CSS only. No JavaScript required (the multiplier can be a static value).

---

## Mockup 1: CRASHED State

**Save to**: `docs/mockups/crash-transition-mockup.html`

### Multiplier-section (top, ~160px)
- **Top hazard stripe**: 14px amber diagonal bar (`repeating-linear-gradient(-45deg, #ffb000 8px, #000 8px, #000 16px)`).
- **Label** above multiplier: `警告  TRACED` — Japanese in `font-family: system-ui, sans-serif`, Latin `TRACED` in Space Mono 9px, color `#cc0000`, letter-spacing 0.15em.
- **Multiplier value**: `4.73x` in `#cc0000`, 3.5rem Fira Code bold. No glow. Frozen/dead.
- **Bottom hazard stripe**: Same 14px amber bar, replacing where ThreatMeter would be.
- **Background**: `#0a0000` (very dark red-black).
- **Border**: `1px solid #cc0000` around the whole multiplier-section.

### Content-area (middle, ~280px) — crash status panel

Replaces the terminal. Feels like a locked-down system status readout. Lay this out as a two-column grid within the content-area: status readout on the left, agency block on the right. Or single column if it looks better — use your judgment at this width.

**Status readout (left or top)**:
```
状態報告  ← system-ui, 9px, #cc0000
STATUS READOUT  ← Space Mono, 9px, #cc0000, letter-spacing 0.1em
─────────────────
PROXIES    0 / 6       ← key: #ff6a00, value: #ff0000 bold
COVER      BLOWN       ← same
IDS        ACTIVE HUNT ← same
─────────────────
```

**Agency block (right or bottom)**:
```
─────────────────────────────
FBI CYBER DIVISION  ← #ff6a00 bold
CASE #2026-CF-84729  ← #cc3300, 9px
─────────────────────────────
OPERATOR COMPROMISED — ALL SESSIONS TERMINATED  ← #ff6a00, small
```

### Action-area (bottom strip, ~60px)
`ALL FUNDS SEIZED` centered, `#ff0040`, Space Mono bold, letter-spacing 0.1em. Optional thin `1px solid #cc0000` border around it.

### Sidebar
- PlayerList: 3–4 players, a couple crossed out (cashed out earlier), one or two showing as crashed at `4.73x`.
- History: the just-completed round at top (crash point `4.73x` in ELEVATED color `#ff8c00`).
- ThreatPanel: frozen at ELEVATED level (the crash was at 4.73x → ELEVATED tier).

---

## Mockup 2: CASHOUT State (player cashed out, round still running)

**Save to**: `docs/mockups/cashout-transition-mockup.html`

Player voluntarily disconnected at 3.50x. The round is still in progress — other players are still in, and the live multiplier is still climbing (currently at ~7.84x).

### Multiplier-section (top, ~160px) — LIVE, still climbing

This is almost identical to the RUNNING state. The round continues.

- **Label** above multiplier: `侵入中  LIVE HACK` — same as RUNNING. Japanese in system-ui, `LIVE HACK` in Space Mono 9px, `#805800` (dim).
- **Multiplier value**: `7.84x` colored in HIGH threat color `#ff6600`, 3.5rem Fira Code bold. Feels live.
- **Below multiplier**: ThreatMeter bar — same as RUNNING state (filled ~60% in HIGH color).
- **Cashout badge**: A small secondary line below the ThreatMeter, subtle — e.g. `CASHED OUT @ 3.50x` in `#805800` (dim amber), 9px. This is the player's own exit point. Keep it clearly secondary to the live multiplier.

### Content-area (middle, ~280px) — cashout confirmation panel

Replaces the terminal. Show two tier variants stacked in the same file, each labeled, so the tiers can be compared. Both occupy the same physical slot.

**Tier 1 — GHOST/LOW/ELEVATED/HIGH** (label: `// TIER 1 — standard cashout`):
```
切断完了           ← system-ui, 9px, #805800
CONNECTION TERMINATED  ← Space Mono, letter-spacing 0.2em, #ffb000

+350.00 CR         ← 2.5rem Fira Code bold, #00cc66 (payout)

DISCONNECTED @ 3.50x  ← 10px, #805800
```
Minimal styling. No glows, no borders beyond the outer content-area border.

**Tier 2 — SEVERE** (label: `// TIER 2 — close call`):
```
緊急切断           ← system-ui, 9px, #805800
EMERGENCY DISCONNECT  ← Space Mono, letter-spacing 0.2em, #ff4400

+4,200.00 CR       ← 2.8rem Fira Code bold, #00cc66

DISCONNECTED @ 12.00x  —  CLOSE CALL  ← 10px, #ff4400
```
Border: `2px solid #ff4400`, subtle red glow `box-shadow: 0 0 12px rgba(255,68,0,0.2)`.

### Action-area (bottom strip, ~60px)
Dim status line: `MONITORING ACTIVE ROUND` in `#805800`, 10px, centered. No buttons.

### Sidebar
- PlayerList: local player marked as `DC 3.50x` (cashed out), 2–3 others still active showing `RDY` status.
- ThreatPanel: ELEVATED/HIGH (round is at ~7.84x).
- History: previous rounds (current round not yet completed, not in history).

---

## Design Notes

1. **The key test**: Place mockup 1, mockup 2, and the RUNNING state from hacker-concepts-v4.html side by side. The multiplier value should be at the exact same Y coordinate in all three. If it shifts, the mockup fails its purpose.

2. **Content-area is the point of variation**: The transition from RUNNING → either state should feel like the terminal pane transformed in place, not like a page navigation.

3. **No hazard stripes on cashout** — hazard stripes are reserved for the crash failure state. Cashout is a success event.

4. **Sidebar is intentionally simplified** — spend most effort on the main column. The sidebar can be rough placeholder content.

5. **Fidelity target**: Close enough to approve or iterate on. Not pixel-perfect production. The mockups need to answer: does the layout stability feel right? Does the content hierarchy read correctly?

6. **Refer to hacker-concepts-v4.html** for exact spacing, CRT overlay, font sizes, and panel border conventions.

---

## After Mockups Are Approved

1. Update `docs/specs/2026-03-17-hacker-theme-qa-fixes.md`: merge Fix 6 and Fix 11 into a single unified fix for crash state; update Fix 4 for cashout state.
2. Update `docs/plans/2026-03-17-hacker-theme-qa-fixes.md`: replace B2 and Wave E with a single unified wave; update B3 to match cashout pattern.
3. Implement Wave A fixes in parallel (no mockup dependency):
   - A1: `[ verify ]` button — `white-space: nowrap`
   - A2: Crash duration `5s → 10s` in `config.ts`
   - A3: Hostname FQDNs in `prng.ts` and `terminal-content.ts`
   - A4: Terminal corruption chars — replace mid-word `██` with `??`
   - A5: Japanese font fallback via `system-ui` CSS on `.jp-*` classes
   - A6: History multiplier colors — Borderlands → threat palette
