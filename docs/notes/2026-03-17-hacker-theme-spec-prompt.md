# Hacker Theme — Specification Writing Prompt

Use this prompt to begin a new session for writing the formal specification.

---

## Prompt

We've completed the design exploration phase for a major theming overhaul of this crash game into a hacking-themed experience. All design decisions are confirmed and documented. Your job now is to write the formal specification.

**Read these files first (in this order):**

1. `docs/notes/2026-03-17-hacker-theme-design-process.md` — Complete design process notes with all confirmed decisions. This is your primary source of truth.
2. `docs/plans/2026-03-16-hacker-theme-design-exploration.md` — The original exploration plan. Phase 5 describes what the spec should contain.
3. `docs/project-architecture.md` — Current project architecture to understand what exists.
4. `docs/game-state-machine.md` — Current game state machine.
5. `src/types.ts` — Shared TypeScript types.
6. `src/config.ts` — Game configuration constants.
7. `src/client/App.svelte` — Root component.
8. `src/client/lib/stores.ts` — Svelte stores.

**Then review the visual concepts** (open in a browser to see the live CSS effects):
- `docs/mockups/hacker-concepts-v3.html` — The near-final concepts
- `docs/mockups/hacker-concepts-v4.html` — Spectator mode + final tweaks

**Write the specification to `docs/specs/2026-03-17-hacker-theme.md`.**

The spec should cover:

1. **Overview** — What this feature is, the core metaphor mapping (bet→resource allocation, multiplier→hack, cashout→disconnect, crash→traced)

2. **Palette System** — Complete color definitions for all 6 threat levels, background transitions, border treatments, text colors. Define CSS custom properties.

3. **Typography** — Font pairings (Fira Code + Space Mono), sizing scale, where each font is used, Japanese accent text catalog with translations.

4. **CRT Effects** — Scanlines, phosphor glow, flicker (two tiers), VHS bands. Exact CSS definitions. What activates at each threat level.

5. **Component Inventory** — Map every existing Svelte component to its hacker-themed transformation. Define new components needed (TerminalDisplay, ThreatMeter, CRTOverlay, TargetInfo). For each component, describe what changes.

6. **Game Phase Mapping** — Detailed description of each phase:
   - WAITING → "Target Acquired" (lobby with brief + resources panels)
   - STARTING → "Breaching" (transition animation)
   - RUNNING → "Live Hack" (terminal + multiplier + threat + disconnect)
   - CRASHED → "Traced" (Eva-style crash screen with side panel)
   - Plus: Cashout screen, Spectator mode for each phase

7. **Terminal Content System** — Architecture for the procedural narrative engine: content tiers, line templates, variable pools, pacing model, emission rates by multiplier. Reference the terminal content brainstorm from the initial research (it was thorough).

8. **Threat System** — GHOST→LOW→ELEVATED→HIGH→SEVERE→CRITICAL level definitions, what changes at each level (colors, effects, indicators), qualitative indicators (proxies, IDS, cover), compact bar vs Eva panel formats.

9. **Multiplier Display** — How the multiplier looks at each danger level, the critical glitch effect definition, color and glow transitions.

10. **Disconnect Button** — Three visual states (green/orange/red "BAIL OUT"), when each appears.

11. **Cashout Text Pools** — The three tiers of rotating disconnect messages (low, high, critical).

12. **Crash Screen** — Full storyboard: hazard stripes, TRACED text, JP accents, side status panel, rotating agency system, timing.

13. **New Store Requirements** — What new Svelte stores are needed (terminalLines, threatLevel, dangerHue, roundTarget, etc.)

14. **Header Bar** — Layout, what information is shown, how it changes with threat level.

15. **Sidebar** — Operators list format (hacker handles), Eva threat panel, recent ops.

16. **Deferred Items** — Sound design, mobile optimization, CRT barrel distortion (WebGL investigation).

Do NOT plan implementation steps or write code. This is a design specification only — it describes WHAT to build, not HOW to build it. Keep it precise enough that an implementer can work from it without ambiguity.
