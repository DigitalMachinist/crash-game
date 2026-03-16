import { describe, expect, it } from 'vitest';
import { MULTIPLIER_RARITY_TIERS } from '../../../config';
import { getRarityColor } from '../rarity';

describe('getRarityColor', () => {
  it('returns Common color for 1.00x', () => {
    expect(getRarityColor(1.0)).toBe('#d0d0d0');
  });

  it('returns Common color for 1.99x', () => {
    expect(getRarityColor(1.99)).toBe('#d0d0d0');
  });

  it('returns Uncommon color at exactly 2.00x', () => {
    expect(getRarityColor(2.0)).toBe('#00c853');
  });

  it('returns Uncommon color for 4.99x', () => {
    expect(getRarityColor(4.99)).toBe('#00c853');
  });

  it('returns Rare color at exactly 5.00x', () => {
    expect(getRarityColor(5.0)).toBe('#42a5f5');
  });

  it('returns Rare color for 9.99x', () => {
    expect(getRarityColor(9.99)).toBe('#42a5f5');
  });

  it('returns Epic color at exactly 10.00x', () => {
    expect(getRarityColor(10.0)).toBe('#ab47bc');
  });

  it('returns Epic color for 24.99x', () => {
    expect(getRarityColor(24.99)).toBe('#ab47bc');
  });

  it('returns Legendary color at exactly 25.00x', () => {
    expect(getRarityColor(25.0)).toBe('#ff9800');
  });

  it('returns Legendary color for 99.99x', () => {
    expect(getRarityColor(99.99)).toBe('#ff9800');
  });

  it('returns Mythic color at exactly 100.00x', () => {
    expect(getRarityColor(100.0)).toBe('#ffd740');
  });

  it('returns Mythic color for very large multipliers', () => {
    expect(getRarityColor(1000.0)).toBe('#ffd740');
  });

  it('returns first tier color for values below first threshold', () => {
    expect(getRarityColor(0.5)).toBe('#d0d0d0');
  });

  it('uses colors from MULTIPLIER_RARITY_TIERS config', () => {
    for (const tier of MULTIPLIER_RARITY_TIERS) {
      expect(getRarityColor(tier.minMultiplier)).toBe(tier.color);
    }
  });
});
