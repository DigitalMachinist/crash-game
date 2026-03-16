# Implementation Plan: Rarity Multiplier Colors

**Date:** 2026-03-16
**Spec:** `docs/specs/2026-03-16-rarity-multiplier-colors.md`

## Steps (TDD approach)

### Step 1: Add rarity tier config to `src/config.ts`

Add `MULTIPLIER_RARITY_TIERS` — an array of `{ name, minMultiplier, color }` objects sorted ascending by threshold. This is the single source of truth for tier definitions.

### Step 2: Create `src/client/lib/rarity.ts`

Pure utility module that imports `MULTIPLIER_RARITY_TIERS` from config and exposes:
- `getRarityColor(multiplier: number): string` — walks tiers descending to find first match

### Step 3: Unit tests for rarity utilities

File: `src/client/__tests__/rarity.test.ts`

Test cases:
- Each tier boundary (lower bound inclusive): 1.00, 2.00, 5.00, 10.00, 25.00, 100.00
- Just below each boundary: 1.99, 4.99, 9.99, 24.99, 99.99
- Edge cases: exactly 1.00 (common), very large (1000.00 = mythic)
- Returns correct hex color for each tier

### Step 4: Update `Multiplier.svelte`

- Import `getRarityColor`
- Derive rarity color from `$displayMultiplier`
- RUNNING phase: apply rarity color via inline `style:color` (replaces static `.live` green)
- CRASHED phase: apply rarity color (replaces static `.crashed` red); keep "CRASHED!" label red
- Remove `.live` color rule from CSS (keep the class for other styling if needed)
- Remove `.crashed` color rule from CSS (keep animation)

### Step 5: Update `History.svelte`

- Import `getRarityColor`
- Apply rarity color to each crash point via inline `style:color`
- Remove `.crash-point.low` CSS rule (no longer needed)

### Step 6: Update `PlayerList.svelte`

- Import `getRarityColor`
- Apply rarity color to cashout multiplier text via inline `style:color`
- Remove `.cashed-out` color rule from CSS
- Keep `.lost` red as-is

### Step 7: Update existing component tests

- `History` tests: update any assertions that check for `.low` class to check for inline style instead
- `PlayerList` tests: update any assertions that check for `.cashed-out` color

### Step 8: Run all tests, typecheck, lint

- `npm run test`
- `npm run typecheck`
- `npm run lint`

## Architecture Notes

- Tier definitions (names, thresholds, colors) live in `config.ts` — single source of truth, easily tunable.
- Using inline `style:color` rather than CSS classes because the color is computed from a continuous value — avoids 6 CSS class rules per component.
- Rarity logic lives in a single shared module — no duplication across components.
- No changes to server code or game mechanics.
