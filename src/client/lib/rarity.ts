import { MULTIPLIER_RARITY_TIERS } from '../../config';

const DEFAULT_COLOR = MULTIPLIER_RARITY_TIERS[0].color;

/**
 * Returns the rarity color for a given multiplier value.
 * Walks the tier list in reverse to find the highest tier whose
 * minMultiplier threshold is met.
 */
export function getRarityColor(multiplier: number): string {
  for (let i = MULTIPLIER_RARITY_TIERS.length - 1; i >= 0; i--) {
    const tier = MULTIPLIER_RARITY_TIERS[i];
    if (tier && multiplier >= tier.minMultiplier) {
      return tier.color;
    }
  }
  return DEFAULT_COLOR;
}
