# Hacker Theme — Design Exploration Plan

## Overview

Transform the crash game into a hacking-themed experience where the multiplier climb is a live terminal hack unfolding in real time. This plan covers the **design exploration phase** — the output is a finalized specification for implementation, not implementation itself.

### Scope Decisions

| Area | Status | Notes |
|------|--------|-------|
| Terminal content system | **IN SCOPE** | Core visual, lean into it |
| CRT/visual effects | **EXPLORE** | Investigate options, build comparison demos |
| Moodboard | **IN SCOPE** | Build first to direct aesthetic |
| Sound design | **DEFERRED** | Interesting but not this phase |
| Chat/IRC styling | **NOT NEEDED** | No chat feature |
| Mobile optimization | **DEFERRED** | Will be a later phase |

### Constraints

- **No image or sound asset generation** — all effects via CSS, WebGL, and built-in browser APIs
- **Prefer built-in browser APIs** over third-party libraries where possible
- **No new npm dependencies** unless strongly justified
- Keep the exploration focused on producing actionable spec artifacts, not implementation code

---

## Phase 1: Moodboard & Aesthetic Direction

**Goal**: Establish a shared visual language before designing anything.

### 1.1 Reference Collection

Build an HTML moodboard page (`docs/mockups/hacker-moodboard.html`) that organizes visual references into categories. For each category, describe the specific aesthetic quality we're drawing from and include CSS demos of key visual treatments.

**Categories to explore:**

| Category | References | What to capture |
|----------|-----------|-----------------|
| **Terminal green** | Classic VT220, htop, cmatrix | Phosphor glow warmth, character density, scan feel |
| **Hacker cinema** | Hackers (1995), Swordfish, Blackhat | Neon + darkness, high contrast, frenetic energy |
| **Anime danger UI** | Evangelion NERV warnings, GitS UI | Bold typography, hazard stripes, red/black WARNING overlays |
| **Realistic TUI** | Mr. Robot terminals, actual pentesting tools (nmap, metasploit output) | Authentic command output formatting, prompt styles |
| **Retro CRT** | Old DOS prompts, amber/green monochrome monitors | Scanlines, curvature, phosphor persistence, flicker |
| **Modern hacker aesthetic** | Watch Dogs UI, Hacknet (game), Uplink (game) | Data visualization, network graphs, clean-but-techy |
| **Glitch art** | Databending, signal corruption, VHS tracking errors | Chromatic aberration, horizontal tearing, character corruption |

### 1.2 CSS Effect Sampler

Within the moodboard, build a **live CSS effect sampler** showing the same block of terminal text rendered with different treatments side-by-side:

1. **Clean terminal** — monospace on black, no effects (baseline)
2. **Phosphor green** — green text + multi-layer text-shadow glow
3. **Amber CRT** — amber palette + scanline overlay + vignette
4. **Cyberpunk neon** — cyan/magenta accents, high contrast, no retro effects
5. **Evangelion warning** — red/black, bold block typography, hazard stripe borders
6. **Glitch corruption** — clip-path text slicing, RGB channel split, scramble animation
7. **Hybrid** — green terminal base with glitch and danger overlays that activate on hover/toggle

Each variant should be a self-contained CSS class so they can be toggled and compared.

### 1.3 Color Palette Exploration

Define 3-4 candidate palettes as CSS custom property sets, viewable in the moodboard:

**Palette A: "Classic Green"**
- Primary: `#00FF41` (phosphor green)
- Warning: `#FFB000` (amber)
- Danger: `#FF0040` (hot red)
- Background: `#0A0A0A`
- Dim: `#00802A`

**Palette B: "Amber Terminal"**
- Primary: `#FFB000` (amber)
- Warning: `#FF6600` (orange)
- Danger: `#FF0000` (red)
- Background: `#0A0800`
- Dim: `#806000`

**Palette C: "Cyan Cyberpunk"**
- Primary: `#00F0FF` (cyan)
- Warning: `#FF00FF` (magenta)
- Danger: `#FF0040`
- Background: `#0A0A1A`
- Dim: `#007088`

**Palette D: "Matrix Green + Evangelion Red"** (hybrid)
- Primary: `#00FF41` (green, calm phases)
- Transition: `#FFB000` (amber, mid-tension)
- Danger: `#FF0040` (red, high tension)
- Alert: `#FF0000` on `#000000` with `#FFD700` hazard stripes (crash)
- Background: shifts `#0A0A0A` → `#1A0000` with multiplier

### 1.4 Typography Exploration

Test candidate monospace fonts in the moodboard at various sizes and weights:

| Font | Character | Best for |
|------|-----------|----------|
| **JetBrains Mono** | Modern, clean, ligatures | Main terminal text |
| **Fira Code** | Slightly condensed, great ligatures | Dense output |
| **VT323** | Authentic CRT look, pixelated | Retro decorative elements |
| **IBM Plex Mono** | Corporate clean, Mr. Robot feel | UI chrome |
| **Space Mono** | Quirky, slightly futuristic | Headings/labels |
| **Share Tech Mono** | Techy, good at small sizes | Status bars |

Test each at: 12px (dense terminal), 14px (readable terminal), 18px (UI labels), 48px+ (multiplier display). Evaluate glow effect compatibility — some fonts look better with text-shadow bloom than others.

### 1.5 Deliverable

An interactive HTML page where we can toggle between palettes, fonts, and effect treatments on the same content. This becomes the aesthetic north star for all subsequent design work.

---

## Phase 2: Game Flow Redesign

**Goal**: Map every game state to its hacker-themed equivalent with specific UI descriptions.

### 2.1 State-by-State Design Document

Write a detailed design document (`docs/specs/2026-03-16-hacker-theme.md`) covering each game phase:

**WAITING → "TARGET ACQUIRED"**
- What replaces the countdown display?
- How is betting re-framed as "resource allocation for a hack"?
- What preparatory terminal content plays during the countdown?
- What does the target info panel look like? (random org name, IP, security level)
- Layout sketch (ASCII or HTML mockup)

**STARTING → "BREACHING"**
- The transition animation from lobby to hack
- What text/visual sequence plays? (explored variants: "ACCESS GRANTED", Matrix rain, WOPR quote, etc.)
- Duration and pacing

**RUNNING → "THE HACK"**
- Layout: multiplier display + terminal scroll area + threat meter
- How multiplier and terminal relate visually (multiplier is the focal number, terminal is the narrative)
- Threat level meter design
- How the "DISCONNECT" button replaces "CASH OUT"
- How PlayerList adapts (operators list with hacker handles)
- How History adapts ("Recent Operations" with crash points)

**CRASHED → "TRACED"**
- The full crash sequence storyboard (timed, frame-by-frame)
- WARNING overlay design (Evangelion-inspired)
- Crash variant system (different agencies, severity-based messages)
- Duration and pacing

**CASHOUT → "CLEAN EXIT"**
- The disconnect sequence storyboard
- CRT power-down effect concept
- Payout display
- Threat-level-dependent messaging (calm vs. frantic)

### 2.2 Layout Mockups

Build HTML mockups (`docs/mockups/hacker-*.html`) for each game phase using the chosen aesthetic from Phase 1. These are static snapshots showing the exact layout, colors, typography, and content for:

1. `hacker-lobby.html` — WAITING phase with target info + bet form
2. `hacker-running.html` — RUNNING phase with terminal + multiplier + threat meter
3. `hacker-crashed.html` — CRASHED phase with WARNING overlay
4. `hacker-cashout.html` — Successful disconnect screen

These mockups use the actual CSS effects from the moodboard to give a true preview of the final feel.

---

## Phase 3: Terminal Content System Design

**Goal**: Design the procedural narrative engine that generates the scrolling terminal content.

### 3.1 Content Architecture Document

Design document covering:

**Narrative arc structure:**
- 6 tiers mapping multiplier ranges to hack phases (Initial Access → Recon → PrivEsc → Exfiltration → Deep Access → Danger Zone)
- How lines are selected and sequenced within each tier
- Transition logic between tiers (what triggers moving to the next phase of the narrative)

**Content pools:**
- Line templates with variable slots (hostnames, IPs, filenames, CVEs)
- Variable pools (server names, organization names, project codenames, file paths)
- Rules for pool selection (no repeats within a round, coherent hostname persistence)

**Pacing model:**
- Line emission rate curve (lines/second as a function of multiplier)
- Line length variation by tier
- When and how progress bars appear
- When and how warning/alert lines intersperse with normal content

**Special content types:**
- Multi-line blocks (directory listings, nmap output, config files) — how are these emitted?
- Progress bars — generation and animation
- Corrupted/glitched text lines at high multipliers
- Trace progress counter behavior

### 3.2 Content Sample Validation

Write out 3 complete sample "runs" (full rounds from 1.00x to crash) at different crash points:
1. A short round crashing at ~1.8x (barely gets past Initial Access)
2. A medium round crashing at ~5.5x (through Exfiltration)
3. A long round crashing at ~30x (deep into Danger Zone)

Review each for: narrative coherence, authentic feel, variety, pacing, tension escalation. Adjust the content architecture based on findings.

### 3.3 Data Structure Design

Define the TypeScript interfaces for:
- `TerminalLine` — a single line of terminal output (text, color class, timestamp, type)
- `ContentPool` — a collection of line templates for a given tier
- `RoundNarrative` — the selected content plan for a specific round
- `TerminalState` — the reactive store shape for the terminal display

This is architecture design, not implementation — but the interfaces inform the spec.

---

## Phase 4: CRT & Visual Effects Investigation

**Goal**: Build a comparison page of achievable visual effects to determine which to include.

### 4.1 Effect Prototype Page

Build `docs/mockups/hacker-effects-lab.html` — an interactive page where each effect can be toggled on/off independently over the same terminal content. Effects to prototype:

**CRT Effects:**
- Scanlines (CSS repeating-linear-gradient, adjustable opacity)
- Phosphor glow (text-shadow, adjustable intensity)
- Vignette (radial-gradient edge darkening)
- Screen flicker (CSS opacity animation, adjustable frequency)
- Chromatic aberration (RGB offset text-shadows)

**Terminal Effects:**
- Typewriter text reveal (CSS width animation for single lines)
- Fast-scroll simulation (JS appending lines at variable rates)
- Cursor blink (CSS animation on a pseudo-element)

**Impact Effects:**
- Screen shake (CSS transform translate on a container)
- Red flash overlay (CSS opacity animation on a fixed div)
- Glitch text (clip-path slicing with color-offset pseudo-elements)
- CRT power-down (CSS scaleY compression to a line)
- Horizontal tearing (clip-path + transform offset on pseudo-elements)

**Danger Escalation:**
- Background color shift (CSS custom property transition from black → dark red)
- Text color shift (green → amber → red via CSS custom property)
- Scanline intensity ramp
- Glow intensity ramp
- Border pulse (red glow on container edges)

Each effect should have a toggle checkbox and an intensity slider where applicable. The page should also have a "performance impact" note based on whether the effect uses compositor-only properties (transform/opacity) or triggers paint (text-shadow, filter, color).

### 4.2 Effect Combinations

Test and document which effects compose well together and which conflict (e.g., heavy scanlines + chromatic aberration might be too noisy). Identify 2-3 "effect presets":

- **Subtle**: Vignette + light scanlines + phosphor glow — enhances without overwhelming
- **Immersive**: All CRT effects at moderate intensity — full retro terminal feel
- **Cinematic**: Selective effects that ramp with game state — clean at low multiplier, chaotic at high

### 4.3 WebGL Investigation (Optional Enhancement)

Research whether any effects would benefit significantly from WebGL vs CSS:
- CRT barrel distortion (not achievable in CSS)
- Real-time scanline rendering (vs CSS pseudo-element)
- Post-processing pipeline (bloom, noise, color grading)
- Matrix-style character rain overlay

Document findings with recommendations. The bar for WebGL is high — it must provide a clearly superior result that CSS cannot approximate.

---

## Phase 5: Component Mapping & Specification

**Goal**: Produce the final specification document that maps all design decisions to implementation work.

### 5.1 Component Inventory

Map every existing component to its hacker-themed transformation:

| Current Component | Hacker Equivalent | Changes Required |
|---|---|---|
| `Multiplier.svelte` | Multiplier display (stays, restyled) | New font, glow effect, color follows danger level |
| `GameStatus.svelte` | Phase indicator | "TARGET ACQUIRED" / "BREACHING" / "LIVE HACK" / "TRACED" |
| `BetForm.svelte` | "Resource Allocation" panel | Terminal-styled inputs, "INITIATE BREACH" button |
| `CashoutButton.svelte` | "DISCONNECT" button | Styled as emergency shutoff, threat-level-aware text |
| `PlayerList.svelte` | "Operators" panel | Hacker handles, IRC-style formatting |
| `History.svelte` | "Recent Operations" | "TRACED @ 4.72x" format, threat-colored |
| `ConnectionStatus.svelte` | Proxy/tunnel status | "6 PROXIES" / "TUNNEL ACTIVE" / "LINK DOWN" |
| `NameModal.svelte` | "Choose Your Handle" | Terminal-styled dialog |
| `FairnessModal.svelte` | "Provably Fair" (keep, restyle) | Terminal-styled modal |
| `VerifyModal.svelte` | "Operation Verification" | Terminal-styled |
| **NEW: TerminalDisplay** | Scrolling hack terminal | The core new component |
| **NEW: ThreatMeter** | Threat level bar | GHOST → LOW → ELEVATED → HIGH → SEVERE → CRITICAL |
| **NEW: CRTOverlay** | Visual effects layer | Scanlines, vignette, flicker — wraps entire app |
| **NEW: TargetInfo** | Round target panel | Org name, IP, security level, shown during WAITING |

### 5.2 New Store Requirements

| Store | Type | Purpose |
|---|---|---|
| `terminalLines` | `TerminalLine[]` | Lines currently displayed in the terminal |
| `threatLevel` | `'GHOST' \| 'LOW' \| ... \| 'CRITICAL'` | Derived from multiplier |
| `dangerHue` | `number` | CSS hue value (120→0) for color shifting |
| `roundTarget` | `{ org, ip, hostname, securityLevel }` | Randomly generated per round |

### 5.3 Final Specification

Compile all design decisions, mockups, content architecture, and component mapping into a formal specification (`docs/specs/2026-03-16-hacker-theme.md`) following the project's spec format. This spec becomes the input for implementation planning.

---

## Phase Sequence & Dependencies

```
Phase 1 (Moodboard)
  ↓ aesthetic direction chosen
Phase 2 (Game Flow) ←──────────────────┐
  ↓ layouts designed                    │
Phase 3 (Terminal Content) ────────────→│ (informed by Phase 1 palette/typography)
  ↓ content system designed             │
Phase 4 (Effects Investigation) ───────→│ (uses Phase 1 as baseline)
  ↓ effects chosen
Phase 5 (Specification)
  ↓ spec complete → ready for implementation planning
```

Phases 2, 3, and 4 can proceed partially in parallel after Phase 1 establishes the aesthetic direction. Phase 5 synthesizes all prior phases.

---

## Estimated Artifacts

| Artifact | Location | Type |
|----------|----------|------|
| Moodboard + effect sampler | `docs/mockups/hacker-moodboard.html` | Interactive HTML |
| Lobby mockup | `docs/mockups/hacker-lobby.html` | Static HTML |
| Running mockup | `docs/mockups/hacker-running.html` | Static HTML |
| Crashed mockup | `docs/mockups/hacker-crashed.html` | Static HTML |
| Cashout mockup | `docs/mockups/hacker-cashout.html` | Static HTML |
| Effects lab | `docs/mockups/hacker-effects-lab.html` | Interactive HTML |
| Game flow design document | (within spec) | Markdown |
| Terminal content architecture | (within spec) | Markdown |
| Content sample runs | (within spec or appendix) | Markdown |
| Final specification | `docs/specs/2026-03-16-hacker-theme.md` | Markdown |
