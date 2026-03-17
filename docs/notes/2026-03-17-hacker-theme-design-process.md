# Hacker Theme — Design Process Notes

## Overview

This document captures the full design exploration process for re-theming the crash game as a hacking experience. The process ran across a single session with 4 iterative rounds of visual concepts, progressively narrowing from broad exploration to confirmed decisions.

## Artifacts

All design artifacts are preserved in `docs/mockups/`:

| File | Stage | Purpose |
|------|-------|---------|
| `hacker-concepts.html` | v1 — Broad exploration | 12 sections: palettes, typography, CRT effects lab, multiplier, threat meter, escalation, running phase, 3 crash styles, cashout, lobby |
| `hacker-concepts-v2.html` | v2 — Narrowed options | 10 sections: palette systems (amber vs green), Fira Code + Space Mono pairings, refined CRT, improved critical glitch, vague threat indicators, escalation paths, crash (08C direction), cashout, lobby, full running |
| `hacker-concepts-v3.html` | v3 — Final refinement | 7 sections: crash final options, cashout tweaked, lobby layouts, critical state, full running at 3 danger levels (elevated/severe/critical) |
| `hacker-concepts-v4.html` | v4 — Spectator + tweaks | 6 sections: spectator waiting/running/danger/crash, header HOST tweak, cashout text variety pools |

## Moodboard

Reference images collected in `docs/moodboard/` across 5 categories:

- **ascii art/** — BBS/ANSI art from the demoscene (crew logos, gradient text, character portraits)
- **crt effects/** — CRT monitor treatments, Matrix-through-CRT aesthetic, scanlines
- **glitch effects/** — Aggressive digital corruption: horizontal tearing, VHS tracking, chromatic aberration, databending
- **hackers/** — Dark room/server room hooded figure imagery, blue/cyan/green screen glow
- **tui interfaces/** — Evangelion NERV UIs (breach simulation, CENTRAL DOGMA), btop, MS-DOS Manager, sci-fi monitoring dashboards

### Key Moodboard Insights

The moodboard revealed a **progression aesthetic** rather than a single look:
- Calm state → MS-DOS green/amber CRT terminal (clean, retro)
- Danger state → Evangelion NERV red/black institutional warnings
- Crisis state → Aggressive VHS/digital glitch destruction
- Cultural identity → BBS demoscene ANSI art for branding

## Decision Log

### Round 1 (v1 → v2): Broad to Narrowed

**Palette**: Amber CRT strongest aesthetic. Green phosphor is classic but typical. Undecided whether to start amber or green.

**Typography**: Fira Code and Space Mono selected. Others eliminated.

**CRT Effects**: Scanlines YES, phosphor glow YES, flicker YES (wanted more erratic but less color impact), VHS band YES (reduced opacity). Vignette NO, chromatic aberration NO.

**Multiplier**: Low/medium/high danger styles confirmed. Critical glitch too static — needed more horizontal displacement and erratic timing.

**Threat Meter**: Compact bar good for inline. Eva status panel good for sidebar detail. No exact percentages — danger must feel unpredictable (the game is about not knowing when the crash happens).

**Crash Screen**: LOVED variant 08C (Japanese text + status readout side panel). Evangelion direction confirmed. Glitch destruction style (09) rejected. Pure terminal style (10) deferred in favor of 08C.

**Cashout**: Concept B (centered payout display) strongest. Disconnect button progression confirmed: green → orange → red "BAIL OUT".

**Lobby**: No quotes. Security meter might telegraph crash point — removed. Random target pool briefing kept.

**Chat**: Not needed (confirmed from initial brainstorm).
**Sound**: Deferred to later phase.
**Mobile**: Deferred to later phase.

### Round 2 (v2 → v3): Refined Options

**Palette**: System C (amber base + green for success indicators) and System D (amber world mock) confirmed as the direction. Amber is the world, green means "you're OK / success".

**Typography**: Space Mono for labels/headings, Fira Code for data/terminal confirmed. But WARNING text should use Fira Code, not Space Mono.

**Escalation**: Amber-first confirmed. Full arc: amber → orange → red → crisis red pulse.

**Crash**: Variant A (full panel + side readout) confirmed with rotating agencies. Low/extreme crash variants explored.

**Cashout**: Escape should always be relief — no "partially compromised" messaging.

**Lobby**: Equal width columns for brief and resources preferred. Sidebar for operators/recent.

**Header**: Add HOST text next to target name.

### Round 3 (v3 → v4): Final Decisions

**Crash**: Low crash and extreme crash variants dropped. Standard crash with rotating agencies confirmed.

**Cashout**: Confirmed great. Add text variety pool under the heading for freshness.

**Lobby**: Equal width columns confirmed.

**Critical multiplier**: Threat meter underneath (not agency text) confirmed.

**Spectator mode**: New question raised — what does the UI look like for non-participants?

### Round 4 (v4): Spectator + Final

**Spectator waiting**: Resources panel stays during WAITING (they can still join). During RUNNING, replaced with "OBSERVING" status. No countdown shown for spectators during RUNNING (they can't know when the round ends).

**Spectator running**: Disconnect area becomes quiet "OBSERVING — NOT IN THIS OP" line. Terminal gets full space. Full visual escalation applies.

**Spectator crash**: Same crash screen as participants, minus "ALL FUNDS SEIZED" line.

**Cashout text variety**: Three pools designed (low/mid, high/severe, critical) with 4-6 options each.

## Confirmed Design Decisions

### Palette System
- **Base**: Amber (`#ffb000`) on near-black (`#0a0800`)
- **Success indicators**: Green (`#00cc66`)
- **Dim/secondary**: `#805800`, `#cc8800`
- **Warning (elevated)**: Orange (`#ff8c00`)
- **Danger (high/severe)**: Orange-red (`#ff6600`, `#ff4400`)
- **Critical**: Red (`#ff0040`, `#ff0000`)
- **Background shifts**: `#0a0800` → `#0f0800` → `#120600` → `#140500` → `#1a0000` (pulsing)
- **Disconnect button / wallet**: Green (`#00cc66`) — always visible, always "safe"

### Typography
- **Terminal text / data / multiplier**: Fira Code (400, 700)
- **Labels / section headings**: Space Mono (400, 700)
- **Japanese accent text**: Fira Code at 0.65rem, 0.2em letter-spacing, 50% opacity
- **WARNING / TRACED text**: Fira Code Bold, 0.3em letter-spacing

### CRT Effects
- **Scanlines**: Always on, repeating-linear-gradient, 12% opacity
- **Phosphor glow**: text-shadow with palette color, intensity scales with danger
- **Flicker**: Two tiers — subtle (3s cycle) for low threat, erratic (1.5s cycle) for high threat
- **VHS bands**: 3% opacity, 3s sweep. Second band at 2.5% opacity, 4.7s sweep for high threat
- **No vignette, no chromatic aberration**

### Threat System
- Levels: GHOST → LOW → ELEVATED → HIGH → SEVERE → CRITICAL
- No exact percentages or ETAs
- Qualitative indicators: proxy count (X/6), IDS alert count, cover status (intact/degrading/compromised/blown)
- Compact bar for main area, Eva-style status panel for sidebar

### Crash Screen
- Evangelion 08C direction: hazard stripes, "TRACED" in Fira Code Bold with 0.3em spacing, JP accent text (警告 — 追跡完了), side status panel with readout
- Rotating agencies: FBI Cyber Division, NSA TAO, INTERPOL, Corporate Security, Rival Hacker
- No low-crash or extreme-crash variants

### Cashout Screen
- Centered payout display
- Always clean/positive — escape is relief regardless of threat level
- Green color scheme (contrasts with red crash)
- Three text pools (low, high, critical) with 4-6 rotating options each
- JP accent text (切断完了 for calm, 緊急切断 for dramatic, 神業 for legendary)

### Disconnect Button
- LOW/ELEVATED: Green border `[ DISCONNECT ]`
- HIGH/SEVERE: Orange border `[ DISCONNECT ]`
- CRITICAL: Red fill, pulsing `!! BAIL OUT !!`

### Spectator Mode
- WAITING: Resources panel stays (can still join). Or shows "OBSERVING" if round is RUNNING.
- RUNNING: No disconnect button. "OBSERVING — NOT IN THIS OP" at bottom. Terminal gets full vertical space. Full visual escalation still applies.
- CRASH: Same screen as participants, minus "ALL FUNDS SEIZED".

### Layout
- Header: [crashOS] RND# TGT: name HOST: hostname | ● latency WALLET: amount
- Main area: Multiplier + threat bar + terminal + disconnect/observing
- Sidebar: Operators list + Eva threat panel + recent ops
- Lobby: Brief and Resources side-by-side (equal width) above prep terminal

### Japanese Accent Text
Used as small decorative flourishes on section labels:
- 作戦概要 (OPERATION BRIEF)
- 資源配分 (RESOURCES)
- 作戦員 (OPERATORS)
- 脅威評価 (THREAT ASSESSMENT)
- 最近 (RECENT)
- 侵入中 (LIVE HACK)
- 監視中 (OBSERVING)
- 警告 — 追跡完了 (WARNING — TRACE COMPLETE)
- 状態報告 (STATUS READOUT)
- 切断完了 (DISCONNECT COMPLETE)
- 緊急切断 (EMERGENCY DISCONNECT)
- 神業 (MASTERFUL)
- 危険 — 追跡中 (DANGER — TRACING)
- 検出 (DETECTED)
