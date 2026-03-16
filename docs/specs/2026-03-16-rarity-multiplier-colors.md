# Specification: Borderlands-Style Rarity Coloring for Multipliers

**Date:** 2026-03-16
**Status:** Draft

## Overview

Display multiplier values throughout the UI using a Borderlands-inspired rarity color scheme. Higher multipliers are rarer (due to the exponential crash distribution) and should feel progressively more exciting through color escalation.

## Rarity Tiers

| Tier        | Color   | Hex       | Multiplier Range | Approximate Probability |
|-------------|---------|-----------|------------------|------------------------|
| Common      | White   | `#d0d0d0` | 1.00x – 1.99x   | ~50%                   |
| Uncommon    | Green   | `#00c853` | 2.00x – 4.99x   | ~30%                   |
| Rare        | Blue    | `#42a5f5` | 5.00x – 9.99x   | ~10%                   |
| Epic        | Purple  | `#ab47bc` | 10.00x – 24.99x | ~6%                    |
| Legendary   | Orange  | `#ff9800` | 25.00x – 99.99x | ~3%                    |
| Mythic      | Yellow  | `#ffd740` | 100.00x+         | ~1%                    |

Color choices use Material Design palette values (already consistent with the existing UI) except where Borderlands fidelity matters. White is slightly muted (`#d0d0d0`) to avoid harsh contrast on the dark background.

## Affected Components

### 1. Shared Utility — `src/client/lib/rarity.ts` (new file)

A pure function that maps a multiplier number to a rarity tier:

```ts
export type RarityTier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export function getRarityTier(multiplier: number): RarityTier;
export function getRarityColor(multiplier: number): string;
```

Thresholds and colors are defined as constants in this module (not in `config.ts`, since they are purely cosmetic UI concerns).

### 2. `Multiplier.svelte` — Main Live Display

- **RUNNING phase:** The live multiplier transitions through rarity colors as it climbs. The color changes in real-time as the multiplier crosses tier boundaries.
- **CRASHED phase:** The crashed multiplier retains its rarity color (replacing the current flat red). The "CRASHED!" label remains red.
- **WAITING phase:** Stays neutral gray (`#888`) — no change.
- **STARTING phase:** Stays orange with pulse — no change.

### 3. `History.svelte` — Round History

- Each crash point is colored by its rarity tier, replacing the current binary red-below-2x / default scheme.

### 4. `PlayerList.svelte` — Player Cashout Multipliers

- Successful cashout multipliers are colored by rarity tier, replacing the current flat green.
- "Lost" remains red — no change.

## Non-Goals

- No glow effects, text shadows, or particle animations in this iteration (could be a follow-up).
- No changes to server logic or game mechanics.
- No changes to the wager input, balance display, or any non-multiplier text.

## Accessibility

- All rarity colors maintain WCAG AA contrast ratio (4.5:1) against the dark background (`#0d0d1a`).
- The existing screen-reader accessible label in `Multiplier.svelte` is unchanged.
- Color is supplementary — multiplier values remain readable as numbers.

## Testing

- Unit tests for `getRarityTier()` and `getRarityColor()` covering boundary values (1.00, 1.99, 2.00, 4.99, 5.00, 9.99, 10.00, 24.99, 25.00, 99.99, 100.00, 1000.00).
- Component tests for `History.svelte` and `PlayerList.svelte` verifying correct CSS class/color application at tier boundaries.
- Visual check that live multiplier color changes smoothly during gameplay.
