# Hacker Theme — Design Specification

## 1. Overview

This specification defines a complete visual and experiential overhaul of the crash game into a hacking-themed experience. The multiplier climb becomes a live intrusion unfolding in real time, with escalating tension expressed through color, effects, procedural terminal narrative, and threat indicators.

### Core Metaphor Mapping

| Game Concept | Hacker Equivalent | User Experience |
|---|---|---|
| Place bet | Allocate resources for an operation | Commit credits to fund the hack |
| Multiplier climbing | Hack progressing deeper into the target | Terminal narrative unfolds, data is exfiltrated |
| Cash out | Disconnect from the target | Emergency exit — clean your traces, keep your loot |
| Crash | Traced by authorities | Caught — all funds seized, operator compromised |
| Wager amount | Credits allocated | Resource commitment to the operation |
| Payout | Extracted value | Data/funds exfiltrated before disconnection |
| Other players | Fellow operators | Hacker handles visible in sidebar |
| Round history | Recent operations | Past ops with crash points |

### Aesthetic Direction

The visual language progresses through three distinct aesthetics as danger escalates:

1. **Calm** (GHOST–LOW): Amber CRT terminal — clean, retro, MS-DOS warmth
2. **Tension** (ELEVATED–HIGH): Orange warnings creeping in — Evangelion NERV monitoring feel
3. **Crisis** (SEVERE–CRITICAL): Aggressive red, VHS corruption, glitch effects — everything breaking down

### Constraints

- **No image or sound assets** — all effects via CSS, HTML, and browser APIs
- **No new npm dependencies** unless strongly justified
- **Fonts loaded via Google Fonts** — Fira Code and Space Mono only
- **Performance-conscious** — prefer compositor-only properties (transform, opacity) where possible; reserve paint-triggering properties (text-shadow, color) for elements that already repaint

---

## 2. Palette System

The palette uses amber as the base world color, with green reserved for success/safety indicators. Colors shift toward red as threat escalates.

### CSS Custom Properties

```css
:root {
  /* ─── Base palette (GHOST / LOW) ─── */
  --color-primary: #ffb000;          /* Amber — the world color */
  --color-primary-dim: #805800;      /* Dimmed amber for labels, secondary text */
  --color-primary-mid: #cc8800;      /* Mid amber for hostnames, secondary data */
  --color-bg: #0a0800;               /* Near-black with warm undertone */
  --color-bg-card: #080600;          /* Slightly darker for input fields */
  --color-border: #332800;           /* Amber-tinted border */
  --color-success: #00cc66;          /* Green — disconnect, wallet, safety */
  --color-success-dim: #006633;      /* Dimmed green for secondary success text */

  /* ─── Threat level colors ─── */
  --color-elevated: #ff8c00;         /* Orange — ELEVATED */
  --color-high: #ff6600;             /* Orange-red — HIGH */
  --color-severe: #ff4400;           /* Red-orange — SEVERE */
  --color-critical: #ff0040;         /* Hot red — CRITICAL */
  --color-critical-pure: #ff0000;    /* Pure red — CRITICAL accents */
  --color-critical-dark: #cc0000;    /* Dark red — crash screen, panel borders */

  /* ─── Dim variants per threat level ─── */
  --color-elevated-dim: #803000;
  --color-severe-dim: #800020;
  --color-critical-dim: #400000;

  /* ─── Dynamic properties (updated by JS per threat level) ─── */
  --threat-color: var(--color-primary);
  --threat-dim: var(--color-primary-dim);
  --threat-bg: var(--color-bg);
  --threat-border: var(--color-border);
  --threat-glow-alpha: 0.3;
}
```

### Background Transitions by Threat Level

| Level | Background | Border Color |
|---|---|---|
| GHOST | `#0a0800` | `#332800` |
| LOW | `#0a0800` | `#332800` |
| ELEVATED | `#0f0800` | `#332800` |
| HIGH | `#100700` | `#331800` |
| SEVERE | `#120600` | `#331800` |
| CRITICAL | `#1a0000` (pulsing to `#250000` on 1.2s cycle) | `#400000` |

### Color Assignment Rules

- **Wallet / balance display**: Always `--color-success` (`#00cc66`), regardless of threat level. The player's money is always visible and "safe"-colored.
- **Latency indicator**: Always `--color-success` (green dot + ms value).
- **Disconnect button**: Green at LOW/ELEVATED, orange at HIGH/SEVERE, red at CRITICAL. See §10.
- **Multiplier text**: Follows threat level color. See §9.
- **Terminal text**: Primary amber at calm, shifts to warning/danger colors as appropriate lines appear. See §7.
- **Japanese accent text**: Uses the current threat level's dim color at 50% opacity.
- **Crash screen**: `#cc0000` (dark red) dominant, `#ff6a00` for secondary text, `#ff0040` for multiplier. See §12.
- **Cashout screen**: Always green (`#00cc66` primary, `#006633` secondary). See §6 (CASHOUT phase).

---

## 3. Typography

### Font Pairings

Two monospace fonts serve distinct roles:

| Font | Weights | Role |
|---|---|---|
| **Fira Code** | 400, 700 | Terminal text, data values, multiplier display, WARNING/TRACED text, Japanese accents |
| **Space Mono** | 400, 700 | Section labels, headings, status labels (e.g., "OPERATORS", "THREAT", "LIVE HACK") |

Both loaded via Google Fonts:
```
https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;700&family=Space+Mono:wght@400;700&display=swap
```

### Size Scale

| Element | Font | Size | Weight | Letter-spacing |
|---|---|---|---|---|
| Multiplier display | Fira Code | 3.5rem | 700 | — |
| Payout amount (cashout) | Fira Code | 3rem (3.5rem at critical) | 700 | — |
| TRACED text (crash) | Fira Code | 2.8rem | 700 | 0.3em |
| Crash multiplier | Fira Code | 2rem | 700 | — |
| Terminal output | Fira Code | 12px (running), 11px (lobby prep) | 400 | — |
| Section labels | Space Mono | 9px | 400 or 700 | 0.12em |
| Phase indicator (e.g., "LIVE HACK") | Space Mono | 9px | 400 | 0.15em |
| Header bar text | Fira Code | 11px | 400 (700 for wallet amount) | — |
| Button text | Fira Code | 0.85rem | 700 | 0.08em |
| Sidebar data | Fira Code | 10px | 400 | — |
| Threat sub-indicators | Fira Code | 10px | 400 | — |

### Japanese Accent Text

Small decorative kanji/kana labels placed above or beside English section headers. These are not functional — they add atmospheric texture.

**Styling**: `font-family: 'Fira Code'; font-size: 0.65rem; letter-spacing: 0.2em; opacity: 0.5;`

Color follows the current threat level's dim variant.

**Complete Catalog**:

| Japanese | English | Context |
|---|---|---|
| 作戦概要 | OPERATION BRIEF | Lobby briefing panel |
| 資源配分 | RESOURCES | Lobby wager panel |
| 作戦員 | OPERATORS | Sidebar player list |
| 脅威評価 | THREAT ASSESSMENT | Sidebar threat panel |
| 最近 | RECENT | Sidebar recent ops |
| 侵入中 | LIVE HACK | Running phase label |
| 監視中 | OBSERVING | Spectator mode label |
| 警告 — 追跡完了 | WARNING — TRACE COMPLETE | Crash screen |
| 状態報告 | STATUS READOUT | Crash side panel |
| 切断完了 | DISCONNECT COMPLETE | Cashout (low threat) |
| 緊急切断 | EMERGENCY DISCONNECT | Cashout (high threat) |
| 神業 | MASTERFUL | Cashout (critical escape) |
| 危険 — 追跡中 | DANGER — TRACING | Critical multiplier label |
| 検出 | DETECTED | (Reserved, not currently used) |

---

## 4. CRT Effects

All CRT effects are implemented in CSS and applied via class-based composition. Effects are layered on the CRT container element.

### 4.1 Scanlines

Always on. Applied via `::after` pseudo-element on any `.crt` container.

```css
.crt::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.12),
    rgba(0, 0, 0, 0.12) 1px,
    transparent 1px,
    transparent 2px
  );
  pointer-events: none;
  z-index: 10;
}
```

Opacity is fixed at 12%. No intensity ramp — scanlines provide consistent texture.

### 4.2 Phosphor Glow

Applied via `text-shadow` on terminal text elements. Intensity scales with threat level.

| Level | text-shadow |
|---|---|
| GHOST / LOW | `0 0 3px rgba(255, 176, 0, 0.15)` |
| ELEVATED | `0 0 5px rgba(255, 140, 0, 0.3)` |
| HIGH | `0 0 6px rgba(255, 100, 0, 0.3)` |
| SEVERE | `0 0 8px rgba(255, 68, 0, 0.4)` |
| CRITICAL | `0 0 15px rgba(255, 0, 64, 0.6)` |

The multiplier display has its own glow independent of terminal text, using similar scaling but stronger intensity.

### 4.3 Flicker

Two tiers of screen flicker, applied as CSS `opacity` animations on the CRT container.

**Tier 1 — Subtle** (GHOST through HIGH):
```css
@keyframes flk-lo {
  0%   { opacity: 1 }
  7%   { opacity: .97 }
  12%  { opacity: 1 }
  27%  { opacity: .98 }
  32%  { opacity: 1 }
  58%  { opacity: .96 }
  59%  { opacity: 1 }
  73%  { opacity: .97 }
  74%  { opacity: 1 }
  89%  { opacity: .95 }
  91%  { opacity: 1 }
}
.flk-lo { animation: flk-lo 3s infinite; }
```

**Tier 2 — Erratic** (SEVERE and CRITICAL):
```css
@keyframes flk-hi {
  0%   { opacity: 1 }
  3%   { opacity: .94 }
  5%   { opacity: 1 }
  14%  { opacity: .96 }
  15%  { opacity: 1 }
  31%  { opacity: .93 }
  33%  { opacity: 1 }
  47%  { opacity: .95 }
  48%  { opacity: 1 }
  62%  { opacity: .91 }
  64%  { opacity: 1 }
  78%  { opacity: .94 }
  79%  { opacity: 1 }
  93%  { opacity: .92 }
  95%  { opacity: 1 }
}
.flk-hi { animation: flk-hi 1.5s infinite; }
```

Key difference: Tier 2 has deeper opacity drops (down to 0.91), faster cycle (1.5s vs 3s), and more frequent fluctuations. The effect should feel erratic without introducing noticeable color shift.

### 4.4 VHS Bands

Horizontal translucent bands that sweep vertically across the screen. Two bands used at high threat.

**Primary band** (all threat levels):
```css
@keyframes vhs { 0% { top: -5% } 100% { top: 105% } }
.vhs {
  position: absolute;
  left: 0; right: 0;
  height: 3px;
  background: rgba(255, 255, 255, 0.03);
  z-index: 15;
  animation: vhs 3s linear infinite;
  pointer-events: none;
}
```

**Secondary band** (SEVERE and CRITICAL only):
```css
.vhs2 {
  position: absolute;
  left: 0; right: 0;
  height: 2px;
  background: rgba(255, 255, 255, 0.025);
  z-index: 15;
  animation: vhs 4.7s linear infinite;
  animation-delay: -1.3s;
  pointer-events: none;
}
```

### 4.5 Critical Glitch Effect

Applied to the multiplier display at CRITICAL threat level only. Uses `clip-path` slicing with color-offset pseudo-elements for a horizontal tearing effect.

The multiplier element receives class `.glitch` and `data-text` attribute matching its displayed value.

```css
@keyframes gjit {
  0%, 100% { transform: translate(0) }
  10%  { transform: translate(-2px, 0) }
  20%  { transform: translate(1px, 0) }
  40%  { transform: translate(-1px, 0) }
  60%  { transform: translate(3px, 0) }
  80%  { transform: translate(-1px, 0) }
}
.glitch {
  position: relative;
  animation: gjit 0.15s infinite;
}
.glitch::before,
.glitch::after {
  content: attr(data-text);
  position: absolute;
  left: 0; top: 0;
  width: 100%; height: 100%;
  background: inherit;
}
.glitch::before {
  color: #ff0040;
  animation: g1 0.8s infinite;
  text-shadow: -2px 0 #ff0040;
}
.glitch::after {
  color: #ff6600;
  animation: g2 0.65s infinite;
  text-shadow: 2px 0 #ff6600;
}
```

The `g1` and `g2` keyframes use `clip-path: inset()` to reveal horizontal slices at random positions with horizontal `transform: translate()` offsets ranging from -20px to +22px. Each keyframe has ~8 slice events spread across the animation cycle, with most of the time showing `clip-path: inset(0 0 95% 0)` (invisible). The two layers use different timing (0.8s and 0.65s) and different slice positions to create an irregular tearing pattern.

Full keyframe definitions are in the v3/v4 mockups and should be ported verbatim.

### 4.6 Background Pulse (CRITICAL only)

```css
@keyframes bg-crisis {
  0%, 100% { background: #1a0000 }
  50%      { background: #250000 }
}
```

Applied to the root game container at CRITICAL threat level. Duration: 1.2s infinite.

### 4.7 Effect Activation by Threat Level

| Effect | GHOST | LOW | ELEVATED | HIGH | SEVERE | CRITICAL |
|---|---|---|---|---|---|---|
| Scanlines | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Phosphor glow | dim | dim | medium | medium | bright | intense |
| Flicker (subtle) | ✓ | ✓ | ✓ | ✓ | — | — |
| Flicker (erratic) | — | — | — | — | ✓ | ✓ |
| VHS band 1 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| VHS band 2 | — | — | — | — | ✓ | ✓ |
| Background pulse | — | — | — | — | — | ✓ |
| Multiplier glitch | — | — | — | — | — | ✓ |

### 4.8 Excluded Effects

The following were investigated and rejected:

- **Vignette** (radial-gradient edge darkening) — adds visual weight without payoff
- **Chromatic aberration** (RGB offset shadows) — too noisy when combined with scanlines
- **CRT barrel distortion** — not achievable in CSS; WebGL investigation deferred (see §16)

---

## 5. Component Inventory

### Existing Components — Transformations

| Current Component | Hacker Name | Changes |
|---|---|---|
| `App.svelte` | Root (CRT wrapper) | Wrap game in CRT overlay container. Replace system-ui font stack with Fira Code/Space Mono. Replace purple/dark blue palette with amber/dark. Add threat-level CSS custom property management. |
| `Multiplier.svelte` | Multiplier display | Fira Code 3.5rem bold. Color follows threat level. Phosphor glow text-shadow scales with threat. Apply `.glitch` class + `data-text` at CRITICAL. Label above: JP accent + "LIVE HACK" in Space Mono. |
| `GameStatus.svelte` | Phase indicator | Display phase-appropriate text: "TARGET ACQUIRED" (WAITING), "BREACHING" (STARTING), "LIVE HACK" (RUNNING), "TRACED" (CRASHED). Styled in current threat color. |
| `BetForm.svelte` | Resource Allocation panel | Terminal-styled inputs: amber text on dark bg, `#332800` borders. Preset buttons as bordered `[ 10 ]` `[ 25 ]` etc. Submit button: `[ INITIATE BREACH ]`. Auto-cashout input restyled. Section label: 資源配分 RESOURCES. |
| `CashoutButton.svelte` | Disconnect button | Three visual states (green/orange/red). Text changes from "DISCONNECT" to "BAIL OUT". Shows "Cash out: X CR" below. See §10. |
| `PlayerList.svelte` | Operators panel | IRC-style list with hacker handles. Show: `name wager status`. Status: "RDY" (waiting), "DC X.XXx" (cashed out, green), wager only (still in). Cashed-out operators shown with strikethrough at high threat. ← YOU marker for current player. Section label: 作戦員 OPERATORS. |
| `History.svelte` | Recent Operations | Format: `#NNNN X.XXx`. Crash point colored by existing rarity tier system. Section label: 最近 RECENT. |
| `ConnectionStatus.svelte` | Link status indicator | Green dot + latency in ms. Always green regardless of threat. Placed in header bar. |
| `NameModal.svelte` | Choose Your Handle | Terminal-styled dialog with amber border. Input with blinking cursor. "Enter your handle:" prompt. |
| `FairnessModal.svelte` | Provably Fair | Restyle with terminal aesthetics. Keep all existing functionality. Amber/dark palette. |
| `VerifyModal.svelte` | Operation Verification | Terminal-styled. Round seed, drand data displayed in monospace grid. |

### New Components

| Component | Purpose |
|---|---|
| **TerminalDisplay** | Scrolling hack terminal. Receives lines from the terminal content system. Auto-scrolls to bottom. Applies CRT effects (scanlines, flicker, VHS). Fixed height with overflow-y scroll during RUNNING. Used during WAITING (prep terminal, dimmed) and RUNNING (active hack). |
| **ThreatMeter** | Compact inline threat bar below multiplier. Format: `THREAT: ▓▓▓▓▓▓▓▓░░░░░░░░░░░░ ELEVATED`. Uses block characters (▓ for filled, ░ for empty). 20 characters total. Color follows threat level. Below the bar: sub-indicators (PROXIES, IDS, COVER). |
| **ThreatPanel** | Evangelion-style sidebar threat detail. Bordered panel showing STATUS, PROXIES, IDS, COVER in a key-value grid. Border color escalates with threat. At CRITICAL: 2px border, box-shadow glow, pulsing status text. |
| **CRTOverlay** | Wrapper component providing scanline `::after`, VHS band elements, and flicker animation class. Wraps terminal and optionally the full game area. Accepts threat level to toggle flicker tier and VHS band count. |
| **TargetInfo** | Operation briefing panel shown during WAITING. Displays randomly generated target: org name, IP address (partially masked), hostname, round number. Format: key-value grid with `#805800` labels and `#ffb000` values. Section label: 作戦概要 OPERATION BRIEF. |
| **CashoutScreen** | Full-area display shown when player cashes out. Centered layout: JP accent → heading → subtitle → divider → payout amount → "ESCAPED @ X.XXx" line. Always green. Three intensity tiers based on threat at cashout. See §6 (CASHOUT phase). |
| **CrashScreen** | Full-area crash display. Hazard stripes, TRACED text, side panel. See §12. |
| **ObserverBanner** | Simple bar shown in place of disconnect button for spectators. Text: "OBSERVING — NOT IN THIS OP". Dimmed color matching current threat level. |

---

## 6. Game Phase Mapping

### 6.1 WAITING → "Target Acquired"

**Duration**: `WAITING_DURATION_MS` (10s countdown)

**Layout**: Header bar + main area (two equal-width panels + prep terminal below) + sidebar.

**Main area — left panel (Operation Brief)**:
- Bordered box with floating label: `作戦概要 OPERATION BRIEF`
- Key-value grid displaying:
  - TARGET: randomly generated organization name (bold amber)
  - ADDR: partially masked IP address (e.g., `198.51.100.██`)
  - HOST: server hostname (mid-amber)
  - ROUND: current round number
- All labels in `#805800`, values in `#ffb000` or `#cc8800`

**Main area — right panel (Resources)**:
- Bordered box with floating label: `資源配分 RESOURCES`
- "ALLOCATE CREDITS:" label
- Input field: amber text on `#080600` background, `#332800` border, blinking block cursor
- Quick-bet preset row: bordered buttons `[ 10 ] [ 25 ] [ 100 ] [ 500 ] [ MAX ]`
- Active preset has `#ffb000` border, others have `#332800` border
- Submit: `[ INITIATE BREACH ]` button, amber border
- Below button: `WINDOW: Xs` countdown in dim amber

**Main area — prep terminal** (below both panels):
- Dimmed terminal (`#805800` text, subtle glow) with countdown-synced preparation lines
- Examples: proxy chain initialization, exploit kit loading, nmap scan, payload staging
- Slower emission rate than RUNNING — one line per second of countdown
- CRT effects: scanlines on, subtle flicker, single VHS band

**Spectator variant during WAITING**:
- If the player has not joined and the round is still in WAITING: Resources panel stays visible — they can still join until the countdown expires. The panel functions identically to the participant version.

**Spectator variant during RUNNING** (player didn't join before countdown ended):
- Resources panel is replaced with an "OBSERVING" status panel: centered text showing "OBSERVING", "You did not join this operation", and a countdown to the next window.

### 6.2 STARTING → "Breaching"

**Duration**: Until drand fetch resolves (typically < 2s)

**Visual**: Brief transition overlay or text. The terminal shows a final "ACCESS GRANTED" or "BREACH INITIATED" line. The multiplier area transitions from the lobby to show `1.00x`. No special animation beyond the layout swap — the round starts fast.

If drand fetch fails (void round), transition back to WAITING with a "CONNECTION FAILED — RETRYING" terminal line.

### 6.3 RUNNING → "Live Hack"

**Duration**: Until crash

**Layout**: Header bar + main area (multiplier + threat bar + terminal + disconnect) + sidebar.

**Main area — top section**:
- JP accent label: `侵入中 LIVE HACK` (Space Mono, 9px, dimmed)
- Multiplier: Fira Code 3.5rem bold, centered. Color and glow follow threat level.
- Compact threat bar: `THREAT: ▓▓▓▓▓▓▓▓░░░░░░░░░░░░ ELEVATED` (below multiplier)
- Sub-indicators: `PROXIES: X/6  IDS: N alert(s)  COVER: status` (10px, dimmed)

**Main area — terminal** (flex: 1, fills remaining space):
- Active scrolling terminal with CRT overlay
- Content generated by terminal content system (§7)
- Auto-scrolls to bottom as new lines appear
- Text color: amber at calm, shifts as warning/danger lines appear

**Main area — bottom**:
- Disconnect button area (see §10)
- "Cash out: X.XX CR" value below button

**Sidebar** (see §15):
- Operators list
- Threat detail panel (Eva-style)
- Recent operations

**Spectator variant**:
- No disconnect button. Bottom area shows: `監視中 OBSERVING — NOT IN THIS OP` in dimmed text.
- Terminal takes full vertical space (no disconnect button area to share with).
- All visual escalation effects (color shift, flicker, VHS, background pulse) still apply — spectators experience the full drama.

### 6.4 CRASHED → "Traced"

**Duration**: `CRASHED_DISPLAY_MS` (5s)

Full crash screen replaces the main game area. See §12 for complete storyboard.

**Key elements**:
- Hazard stripes (top and bottom)
- `警告 — 追跡完了` JP accent
- `TRACED` in Fira Code Bold, 2.8rem, 0.3em letter-spacing, red glow
- Subtitle: "OPERATOR COMPROMISED — ALL SESSIONS TERMINATED" (or variant)
- Crash multiplier below
- Side status panel with threat readout and rotating agency

**Spectator variant**: Identical crash screen, minus the "ALL FUNDS SEIZED" line in the side panel (since no funds were at stake).

### 6.5 Cashout → "Clean Exit"

Shown to the cashing-out player only (replaces their main game area). Not a game phase — triggered by successful cashout during RUNNING.

**Layout**: Centered display, always green. Three intensity tiers:

**Tier 1 — Low/Mid threat cashout** (GHOST through HIGH):
- JP accent: `切断完了`
- Heading: `CONNECTION TERMINATED` (Fira Code, 12px bold, 0.12em spacing, subtle green glow)
- Subtitle: Random from low-threat text pool (see §11)
- Divider: 40% width green line with soft glow
- Payout: `+X,XXX.XX CR` (3rem, bold, green glow)
- Footer: `DISCONNECTED @ X.XXx`

**Tier 2 — High threat cashout** (SEVERE):
- JP accent: `緊急切断`
- Heading: `EMERGENCY DISCONNECT` (stronger glow)
- Subtitle: Random from high-threat text pool
- Green border on card, outer box-shadow glow
- Payout and footer same structure, slightly brighter glow
- Footer: `ESCAPED @ X.XXx — CLOSE CALL`

**Tier 3 — Critical threat cashout** (CRITICAL):
- JP accent: `神業`
- Heading: `EMERGENCY DISCONNECT` (intense glow)
- Subtitle: Random from critical text pool (brighter text, green text-shadow)
- 2px green border, stronger box-shadow
- Payout: 3.5rem (larger), intense glow
- Footer: `ESCAPED @ X.XXx — LEGENDARY`

---

## 7. Terminal Content System

The terminal is the core atmospheric element. It generates procedural narrative text that makes each round feel like a live hacking operation.

### 7.1 Architecture

The terminal content system runs entirely client-side. It is driven by the current multiplier value and emits lines at a rate that scales with tension.

**Key design principle**: The terminal content is decorative narrative, not gameplay-relevant data. Players should not be able to derive the crash point from terminal content. Content generation uses seeded randomness per round (round ID + client-side salt) for variety without predictability.

### 7.2 Content Tiers

Six tiers map to multiplier ranges, each representing a phase of the hack narrative:

| Tier | Multiplier Range | Hack Phase | Emotional Tone |
|---|---|---|---|
| 1 — Initial Access | 1.00x – 1.50x | Connection, authentication, initial breach | Procedural, calm |
| 2 — Reconnaissance | 1.50x – 3.00x | Network scanning, enumeration, mapping | Methodical, building |
| 3 — Privilege Escalation | 3.00x – 6.00x | Exploiting vulnerabilities, gaining root | Excitement, momentum |
| 4 — Exfiltration | 6.00x – 15.00x | Data extraction, lateral movement | Tension rising |
| 5 — Deep Access | 15.00x – 30.00x | Crown jewels, core systems, secrets | High stakes |
| 6 — Danger Zone | 30.00x+ | Active countermeasures, trace in progress | Panic, urgency |

### 7.3 Line Templates

Each tier has a pool of line templates with variable slots. Variables are filled from pools (see §7.4).

**Template format**: Lines are plain text strings with `{variable}` slots. Each template has:
- `text`: The template string
- `color`: CSS color value (or class name) for the line
- `type`: `normal` | `success` | `warning` | `danger` | `progress` | `command`

**Example templates by tier**:

**Tier 1 — Initial Access**:
```
[command]  $ ssh -i exploit.key {user}@{ip}
[normal]   Connecting to {hostname}:{port}...
[success]  [+] Authentication successful
[normal]   {hostname} — {os} — uptime {uptime}
[command]  $ nmap -sS {ip} -p 1-1024
[normal]   PORT    STATE    SERVICE
[normal]   22/tcp  open     ssh
[normal]   443/tcp open     https
```

**Tier 3 — Privilege Escalation**:
```
[success]  [+] ROOT ACCESS GRANTED
[command]  root@{hostname}:~# ls /opt/.secrets/
[normal]   master.key  vpn-gateway.ovpn  credentials.kdbx
[command]  root@{hostname}:~# cat {sensitive_file}
[warning]  [*] Pivoting to {next_host}...
[success]  [+] SSH key accepted
```

**Tier 5 — Deep Access**:
```
[danger]   [!] SOC ALERT: Ticket #{ticket} — Priority CRITICAL
[warning]  [*] Counter-intrusion payload detected on {interface}
[danger]   [!] Proxy node {n} compromised — rerouting
[progress] [EXFIL] {filename} [████████████░░░░] {pct}%
```

**Tier 6 — Danger Zone**:
```
[danger]   [!] ██ {agency} — TRACKING ██
[danger]   [!] ██ DIRECT EXPOSURE IMMINENT ██
[danger]   [!] P4CKET L0SS: {pct1}%... {pct2}%...
[danger]   [ERR] {interface}: li██ is not re░dy
[danger]   [!] ██ DISCONNECT NOW ██
```

### 7.4 Variable Pools

Variables are drawn from pools and remain consistent within a round (e.g., the same hostname persists throughout).

| Variable | Pool Examples |
|---|---|
| `{hostname}` | srv-prod-web-03, db-primary-01, mail-gw-02, api-node-07 |
| `{ip}` | 198.51.100.XX, 203.0.113.XX, 10.0.{N}.{N} (partially masked with ██) |
| `{user}` | admin, deploy, root, svc-account, jenkins |
| `{os}` | Linux 5.15, Linux 6.1 (Ubuntu 24.04), FreeBSD 14.0, CentOS 9 |
| `{sensitive_file}` | api_keys.json, credentials.kdbx, .env.production, master.key |
| `{filename}` | credentials.kdbx, model_weights.bin, OMEGA_PROTOCOL.enc, customer_db.sql |
| `{next_host}` | db-primary-01, backup-nas-02, core-router-01 |
| `{agency}` | FBI CYBER DIVISION, NSA TAO, INTERPOL, FIVE EYES COALITION |
| `{ticket}` | INC-0847, INC-1293, SEC-0441 |
| `{interface}` | tun0, eth0, wg0 |
| `{port}` | 22, 443, 5432, 3306, 8080 |
| `{uptime}` | 847 days, 23 days, 412 days |

**Consistency rules**:
- `{hostname}` is chosen once per round and reused in all templates
- `{ip}` is chosen once per round (matches the target in the briefing panel)
- Other variables may vary per line

### 7.5 Pacing Model

| Multiplier Range | Emission Rate | Line Character |
|---|---|---|
| 1.00x – 1.50x | 1 line per 1.5–2s | Short, procedural |
| 1.50x – 3.00x | 1 line per 1–1.5s | Medium, methodical |
| 3.00x – 6.00x | 1 line per 0.5–1s | Varied, building momentum |
| 6.00x – 15.00x | 1 line per 0.3–0.5s | Mixed normal + warnings |
| 15.00x – 30.00x | 1 line per 0.2–0.3s | Mostly warnings/danger |
| 30.00x+ | 1 line per 0.1–0.2s | Rapid-fire danger, panic |

Lines should not emit on every tick (100ms). The terminal content system maintains its own timer, adjusted by multiplier. Some variance in timing prevents robotic regularity.

### 7.6 Special Content Types

**Progress bars**: Emitted as a single line that updates in-place (replace last line). Format: `[EXFIL] filename [████████████░░░░] 72% 44.2MB/s`. Progress bars span multiple updates over 3–8 seconds.

**Multi-line blocks**: Directory listings and JSON snippets are emitted as a burst (all lines at once with ~50ms delay between each). Example: `ls` output, JSON config dump.

**Corrupted text** (Tier 5–6 only): Lines with Unicode block characters replacing parts of text: `[ERR] tun0: li██ is not re░dy`. Frequency increases with multiplier.

**Flashing danger lines** (Tier 6 only): Some lines in the terminal receive a pulsing animation class: `animation: pulse-fast 0.4s infinite`. Used sparingly for lines like `[!] ██ DISCONNECT NOW ██`.

### 7.7 Prep Terminal (WAITING phase)

During the WAITING countdown, a dimmed terminal shows preparation activity synchronized to the countdown:

```
[00:08] Initializing proxy chain...
[00:07] > route add via tor-exit-DE
[00:06] > route add via tor-exit-BR
[00:05] > route add via tor-exit-JP
[00:04] Proxy chain: 6 bounces active.
[00:03] Loading exploit kit... [████████████████████] 100%
[00:02] $ nmap -sS 198.51.100.██
[00:01] Payload staged. Awaiting operator.
```

Text color: `#805800` (dimmed amber) with very subtle glow. Green for route-add commands. Amber for progress bars.

---

## 8. Threat System

The threat system provides qualitative danger feedback. It explicitly avoids revealing exact timing or crash proximity.

### 8.1 Threat Levels

| Level | Multiplier Range | Color | Indicator Fill (of 20) |
|---|---|---|---|
| GHOST | 1.00x – 1.20x | `#ffb000` (amber) | 0–1 |
| LOW | 1.20x – 2.50x | `#ffb000` (amber) | 2–5 |
| ELEVATED | 2.50x – 5.00x | `#ff8c00` (orange) | 6–10 |
| HIGH | 5.00x – 10.00x | `#ff6600` (orange-red) | 10–13 |
| SEVERE | 10.00x – 25.00x | `#ff4400` (red-orange) | 14–17 |
| CRITICAL | 25.00x+ | `#ff0040` (hot red) | 18–20 (full, pulsing) |

**Important**: The threat level is derived purely from the current multiplier, NOT from proximity to the crash point. The threat system does not know when the crash will happen. This preserves the core tension of the game — players can never know when the crash comes.

### 8.2 Compact Threat Bar (Main Area)

Displayed directly below the multiplier. Single line format:

```
THREAT: ▓▓▓▓▓▓▓▓░░░░░░░░░░░░ ELEVATED
```

- Uses Unicode block characters: `▓` (filled, U+2593) and `░` (empty, U+2591)
- Total width: 20 characters
- Fill count: based on a continuous function of multiplier (not strictly per-level)
- Color: matches current threat level color
- At CRITICAL: all 20 filled, pulsing animation, `!! CRITICAL` suffix

### 8.3 Qualitative Sub-Indicators

Displayed below the compact bar in 10px dimmed text:

| Indicator | Low Value | High Value |
|---|---|---|
| PROXIES | `6/6` (amber) | `0/6 EXPOSED` (red, at CRITICAL) |
| IDS | `silent` or `1 alert` | `5+ ALERTS` or `ACTIVE HUNT` |
| COVER | `intact` | `degrading` → `compromised` → `BLOWN` |

Transition mapping:

| Level | PROXIES | IDS | COVER |
|---|---|---|---|
| GHOST | 6/6 | silent | intact |
| LOW | 6/6 | silent | intact |
| ELEVATED | 6/6 | 1 alert | intact |
| HIGH | 5/6 or 4/6 | 2-3 alerts | degrading |
| SEVERE | 2/6 or 3/6 | 5+ alerts | compromised |
| CRITICAL | 0/6 EXPOSED | ACTIVE HUNT | BLOWN |

Proxy counts and IDS alert counts can have slight random variance within their tier to avoid feeling mechanical.

### 8.4 Eva Threat Panel (Sidebar)

A bordered panel in the sidebar showing the same information in a more detailed key-value grid format:

```
┌─────────────────────┐
│ 脅威評価 THREAT      │
│ ─────────────────── │
│ STATUS   ELEVATED   │
│ PROXIES  6 / 6      │
│ IDS      1 alert    │
│ COVER    intact     │
└─────────────────────┘
```

Visual escalation:
- GHOST–HIGH: `#332800` border (amber-tinted), labels in `#805800`
- SEVERE: `#cc0000` border, labels in `#cc0000`
- CRITICAL: 2px `#ff0000` border, `box-shadow: 0 0 10px rgba(255, 0, 0, 0.15)`, STATUS text pulsing

---

## 9. Multiplier Display

The multiplier is the focal point of the RUNNING phase. It sits centered above the terminal.

### 9.1 Base Styling

```css
.multiplier {
  font-family: 'Fira Code', monospace;
  font-size: 3.5rem;
  font-weight: 700;
  text-align: center;
}
```

### 9.2 Color and Glow by Threat Level

| Level | Color | text-shadow |
|---|---|---|
| GHOST | `#ffb000` | `0 0 8px rgba(255, 176, 0, 0.3)` |
| LOW | `#ffb000` | `0 0 8px rgba(255, 176, 0, 0.3)` |
| ELEVATED | `#ff8c00` | `0 0 10px rgba(255, 140, 0, 0.4)` |
| HIGH | `#ff6600` | `0 0 10px rgba(255, 102, 0, 0.4)` |
| SEVERE | `#ff4400` | `0 0 12px rgba(255, 68, 0, 0.5)` |
| CRITICAL | `#ff0040` | `0 0 15px rgba(255, 0, 64, 0.6)` |

### 9.3 Critical Glitch

At CRITICAL threat level (25x+), the multiplier element receives:
1. The `.glitch` CSS class (horizontal jitter + clip-path pseudo-elements)
2. A `data-text` attribute matching the displayed value (for pseudo-element content)
3. A `background` matching the current background color (so pseudo-element backgrounds don't show seams)

The glitch effect layers two colored pseudo-elements (red `#ff0040` and orange `#ff6600`) that slice and offset horizontally at different timings.

### 9.4 Animation

The multiplier value still updates via CSS transition matching `TICK_INTERVAL_MS` (100ms linear), same as current implementation. The color transition between threat levels should be smooth: `transition: color 1s, text-shadow 1s`.

---

## 10. Disconnect Button

The disconnect (cashout) button has three visual states tied to threat level.

### 10.1 States

**State 1 — LOW / ELEVATED** (1x–5x):
```css
.disconnect-btn-low {
  color: #00cc66;
  border: 2px solid #00cc66;
  background: transparent;
}
```
Text: `[ DISCONNECT ]`

**State 2 — HIGH / SEVERE** (5x–25x):
```css
.disconnect-btn-mid {
  color: #ff6600;
  border: 2px solid #ff6600;
  background: transparent;
}
```
Text: `[ DISCONNECT ]`

**State 3 — CRITICAL** (25x+):
```css
.disconnect-btn-crit {
  color: #ff0040;
  border: 2px solid #ff0040;
  background: rgba(255, 0, 64, 0.1);
  box-shadow: 0 0 15px rgba(255, 0, 64, 0.2);
  animation: pulse 0.8s infinite;
}
```
Text: `!! BAIL OUT !!`

### 10.2 Layout

- Centered below the terminal area
- Separated by a `1px solid` border-top in the current threat border color
- Below the button: `Cash out: X,XXX.XX CR` in dimmed color (green-dim for low, orange-dim for mid, red-dim for critical)

### 10.3 Spectator Replacement

When the player is not in the round, the disconnect button area is replaced with:
```
監視中  OBSERVING — NOT IN THIS OP
```
Color: current threat dim. Font-size: 11px. Letter-spacing: 0.08em. Centered.

---

## 11. Cashout Text Pools

Three pools of rotating subtitle text displayed under the heading on the cashout screen. One line is chosen randomly per cashout event.

### Pool 1 — Low / Mid Threat (GHOST through HIGH)

Heading: `CONNECTION TERMINATED`

| Subtitle |
|---|
| TRACES CLEARED — YOU WERE NEVER HERE |
| SESSION SCRUBBED — NO EVIDENCE REMAINS |
| CLEAN EXIT — LIKE A GHOST |
| LOGS PURGED — IDENTITY INTACT |
| ALL TUNNELS CLOSED — PROXY CHAIN BURNED |
| ZERO FOOTPRINT — TEXTBOOK EXTRACTION |

### Pool 2 — High Threat (SEVERE)

Heading: `EMERGENCY DISCONNECT`

| Subtitle |
|---|
| TRACES BURNED — THEY'LL NEVER FIND YOU |
| VANISHED — LIKE YOU WERE NEVER THERE |
| SLIPPED THROUGH THEIR FINGERS |
| EXTRACTED UNDER FIRE — CLEAN GETAWAY |
| OUT THE BACK DOOR — CLOSE ONE |
| GONE DARK — THEY'RE CHASING SHADOWS |

### Pool 3 — Critical Threat (CRITICAL)

Heading: `EMERGENCY DISCONNECT`

| Subtitle |
|---|
| GHOST PROTOCOL — ALL TRACES DESTROYED |
| IMPOSSIBLE EXTRACTION — THEY DIDN'T STAND A CHANCE |
| ABSOLUTE LEGEND — WALKED THROUGH FIRE |
| THEY SENT EVERYTHING — YOU SENT NOTHING BACK |

---

## 12. Crash Screen

The crash screen appears for `CRASHED_DISPLAY_MS` (5 seconds) and replaces the entire main game area.

### 12.1 Layout

Horizontal split: main panel (flex: 1) + side status panel (220px width).

### 12.2 Main Panel

Centered vertically and horizontally:

1. **JP accent**: `警告 — 追跡完了` in `#cc0000`, 0.65rem, 0.2em letter-spacing, 50% opacity
2. **TRACED**: Fira Code Bold, 2.8rem, `#cc0000`, `text-shadow: 0 0 25px rgba(204, 0, 0, 0.5)`, `letter-spacing: 0.3em`
3. **Subtitle**: `OPERATOR COMPROMISED — ALL SESSIONS TERMINATED` (or variant based on agency — see §12.4), Fira Code, 0.8rem, `#ff6a00`, `letter-spacing: 0.1em`
4. **Crash multiplier**: Fira Code Bold, 2rem, `#ff0040`, `text-shadow: 0 0 10px rgba(255, 0, 64, 0.4)`, 1.5rem margin-top

### 12.3 Side Status Panel

220px wide, left-bordered with `2px solid #cc0000`. Vertically centered content.

```
状態報告
STATUS READOUT

PROXIES: 0 / 6
COVER: BLOWN
IDS: ACTIVE HUNT

─────────────────
{AGENCY NAME}
{CASE/REF NUMBER}
─────────────────
ALL FUNDS SEIZED    ← omitted for spectators
```

- JP accent `状態報告` in `#cc0000`
- "STATUS READOUT" in Space Mono, 9px, `#cc0000`, 0.1em letter-spacing
- Readout values in `#ff6a00` with specific values in `#ff0000` or `#ff0040`
- Agency and case number separated by `1px solid #400000` borders

### 12.4 Rotating Agency System

Each crash screen randomly selects one agency from this pool:

| Agency | Subtitle Variant | Case Format |
|---|---|---|
| FBI CYBER DIVISION | OPERATOR COMPROMISED — ALL SESSIONS TERMINATED | CASE #2026-CF-{5 digits} |
| NSA TAILORED ACCESS OPS | SIGNAL INTERCEPTED — OPERATOR LOCATED | SIGINT REF: SIGMA-{4 chars} |
| INTERPOL CYBER CRIME | OPERATOR COMPROMISED — ALL SESSIONS TERMINATED | WARRANT: IC-2026-{region}-{4 digits} |
| CORPORATE SECURITY | UNAUTHORIZED ACCESS DETECTED — SOURCE IDENTIFIED | INCIDENT: CS-{6 digits} |
| RIVAL HACKER | YOUR BACKDOOR HAD A BACKDOOR | PWNED BY: {handle} |

Case numbers are randomly generated per round.

### 12.5 Decorative Elements

- **Hazard stripes**: Top and bottom bars, 14px height, `repeating-linear-gradient(-45deg, #ffb000, #ffb000 8px, #000 8px, #000 16px)`
- **VHS band**: Single sweeping band (same as §4.4)
- **Background**: `#0a0000` (very dark red)

### 12.6 Timing

The crash screen appears immediately when the CRASHED phase begins. All elements are visible at once — no staggered reveal animation. The screen holds for `CRASHED_DISPLAY_MS` (5s), then transitions back to WAITING.

---

## 13. New Store Requirements

### 13.1 New Stores

| Store | Type | Source | Purpose |
|---|---|---|---|
| `terminalLines` | `writable<TerminalLine[]>` | Terminal content engine | Lines currently displayed in the terminal. Reset on round start. |
| `threatLevel` | `derived` from `displayMultiplier` | Derived | Current threat level string. Computed from multiplier thresholds in §8.1. |
| `dangerColors` | `derived` from `threatLevel` | Derived | Object containing current color, dim, bg, border, glow values for the active threat level. |
| `roundTarget` | `writable<RoundTarget>` | Set on WAITING phase start | Randomly generated target info for the current round. |
| `cashoutThreatLevel` | `writable<ThreatLevel \| null>` | Set on cashout | Captures the threat level at the moment of cashout, used to determine cashout screen tier. Reset on round end. |

### 13.2 New Types

```typescript
type ThreatLevel = 'GHOST' | 'LOW' | 'ELEVATED' | 'HIGH' | 'SEVERE' | 'CRITICAL';

interface TerminalLine {
  id: number;           // Monotonic ID for keying
  text: string;         // Display text (may contain inline styling hints)
  color: string;        // CSS color value
  type: 'normal' | 'success' | 'warning' | 'danger' | 'progress' | 'command';
  timestamp: number;    // When the line was emitted
}

interface RoundTarget {
  org: string;          // Organization name
  ip: string;           // Partially masked IP
  hostname: string;     // Server hostname
  roundId: number;      // Current round number
}
```

### 13.3 Threat Level Derivation

```typescript
function getThreatLevel(multiplier: number): ThreatLevel {
  if (multiplier >= 25) return 'CRITICAL';
  if (multiplier >= 10) return 'SEVERE';
  if (multiplier >= 5) return 'HIGH';
  if (multiplier >= 2.5) return 'ELEVATED';
  if (multiplier >= 1.2) return 'LOW';
  return 'GHOST';
}
```

---

## 14. Header Bar

The header bar spans the full width and persists across all phases.

### 14.1 Layout

```
[crashOS] RND #NNNN TGT: ORG_NAME HOST: hostname    ● NNms  X,XXX.XX CR
└─ left-aligned ──────────────────────────────────┘    └─ right-aligned ─┘
```

### 14.2 Styling

- Background: inherits from main background (shifts with threat level)
- Bottom border: `1px solid` in current `--threat-border` color
- Padding: `0.4rem 0.75rem`
- Font: Fira Code 11px

**Left section**:
- `[crashOS]` in current threat color
- `@` separator in dim (during WAITING with hostname format: `[crashOS@rogue-7xK9]`)
- `RND #NNNN` in dim
- `TGT:` label in dim, value in mid-amber/threat-mid
- `HOST:` label in dim, value in mid-amber/threat-mid

**Right section**:
- Green dot `●` + latency `NNms` in `#00cc66` (always green)
- Wallet amount in `#00cc66` bold (always green, always visible)

### 14.3 Threat Color Progression

The header text (left section only) shifts color with threat level:

| Level | [crashOS] color | Labels color | Values color |
|---|---|---|---|
| GHOST–LOW | `#ffb000` | `#805800` | `#cc8800` |
| ELEVATED | `#ffb000` | `#805800` | `#cc8800` |
| HIGH | `#ff8c00` | `#803000` | `#ff6600` |
| SEVERE | `#ff8c00` | `#803000` | `#ff6600` |
| CRITICAL | `#ff0040` | `#800020` | `#ff0040` |

The wallet and latency (right section) **never change color** — they remain green at all threat levels.

---

## 15. Sidebar

The sidebar occupies 200px on the right side of the layout (180px during WAITING to accommodate wider main panels).

### 15.1 Operators List

**Section label**: `作戦員 OPERATORS` (Space Mono, 9px, `#805800`, 0.12em letter-spacing)

**Format per operator**:
```
{handle} {wager} {status}
```

- **handle**: Player display name (hacker handle), in current threat color
- **wager**: Wager amount, in dim color
- **status during WAITING**: `RDY` in green (if joined)
- **status during RUNNING (not cashed out)**: no status text, just handle + wager
- **status after cashout**: `DC X.XXx` in green
- **status (not joined, spectating)**: `—` in dim

At HIGH+ threat: cashed-out operators shown with `text-decoration: line-through` in dim color. Active (uncashed) operators remain prominent.

Current player marker: `← YOU` appended in threat color after the player's own entry.

### 15.2 Threat Detail Panel

The Eva-style ThreatPanel (see §8.4). Shown during RUNNING phase.

### 15.3 Recent Operations

**Section label**: `最近 RECENT` (Space Mono, 9px, dim color, 0.12em letter-spacing)

**Format per entry**:
```
#NNNN X.XXx
```

- Round number in dim color
- Crash point colored using the existing `MULTIPLIER_RARITY_TIERS` system (these colors remain unchanged — they provide variety against the amber/red palette)

### 15.4 Phase-Dependent Content

| Phase | Sidebar Content |
|---|---|
| WAITING | Operators (with RDY status) + Recent |
| RUNNING | Operators (with live status) + Threat Panel + Recent |
| CRASHED | Sidebar may be partially occluded by crash screen overlay |
| CASHOUT | Sidebar remains visible alongside cashout display |

---

## 16. Deferred Items

The following items are explicitly out of scope for this implementation phase:

### Sound Design
- CRT hum, key clicks, alert tones, disconnect/crash sound effects
- Audio should be a separate spec after the visual theme is complete
- Consider: Web Audio API for synthesized sounds vs. audio file assets

### Mobile Optimization
- The current design targets desktop (1100px max-width layout with sidebar)
- Mobile layout will need significant rework: sidebar collapses, terminal shrinks, touch targets resize
- Separate spec needed for responsive breakpoints and touch interactions

### CRT Barrel Distortion
- True CRT curvature is not achievable in CSS
- WebGL post-processing pipeline could provide barrel distortion, bloom, and noise
- Investigation needed: performance impact, canvas overlay approach, interaction with existing CSS effects
- Low priority — the CSS CRT effects provide sufficient atmosphere

### Matrix Rain Overlay
- Falling character rain effect as a decorative element
- Could use canvas or WebGL
- Considered too distracting for active gameplay; may revisit as a transition effect

### ASCII Art Branding
- BBS/ANSI-style ASCII art logo for the loading screen or header
- Deferred pending design of any loading/splash screen
