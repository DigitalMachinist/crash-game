/**
 * Integration test: full threat escalation chain.
 *
 * Verifies that the full pipeline propagates correctly at each threat level:
 * displayMultiplier → threatLevel → dangerColors → CSS custom properties on :root
 *
 * Each test mounts App.svelte, sets displayMultiplier to a representative
 * value for each threat tier, and asserts that the CSS custom property
 * --threat-color on document.documentElement reflects the expected color.
 */
import { render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App.svelte';
import { displayMultiplier } from '../../lib/stores';

vi.mock('../../lib/socket', () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock('../../lib/balance', () => ({
  getOrCreatePlayerId: vi.fn().mockReturnValue('test-player-id'),
  getBalance: vi.fn().mockReturnValue(100),
  getPlayerName: vi.fn().mockReturnValue('test-handle'),
  setPlayerName: vi.fn(),
  applyCashout: vi.fn(),
  addHistoryEntry: vi.fn(),
  isRoundRecorded: vi.fn().mockReturnValue(false),
  applyPendingPayout: vi.fn().mockReturnValue(null),
  applyRoundResult: vi.fn(),
}));

vi.mock('../../lib/commands', () => ({
  sendSetName: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  displayMultiplier.set(1.0);
  document.documentElement.classList.remove('threat-critical');
  document.documentElement.style.removeProperty('--threat-color');
  document.documentElement.style.removeProperty('--threat-dim');
  document.documentElement.style.removeProperty('--threat-border');
  document.documentElement.style.removeProperty('--threat-glow-alpha');
});

const THREAT_CASES = [
  { multiplier: 1.0, level: 'GHOST', color: '#ffb000' },
  { multiplier: 1.5, level: 'LOW', color: '#ffb000' },
  { multiplier: 3.0, level: 'ELEVATED', color: '#ff8c00' },
  { multiplier: 7.0, level: 'HIGH', color: '#ff6600' },
  { multiplier: 15.0, level: 'SEVERE', color: '#ff4400' },
  { multiplier: 30.0, level: 'CRITICAL', color: '#ff0040' },
] as const;

describe('threat escalation integration', () => {
  for (const { multiplier, level, color } of THREAT_CASES) {
    it(`at ${multiplier}x (${level}): --threat-color=${color}`, async () => {
      render(App);
      displayMultiplier.set(multiplier);
      await tick();
      const cssColor = document.documentElement.style.getPropertyValue('--threat-color');
      expect(cssColor).toBe(color);
    });
  }

  it('threat-critical class only present at CRITICAL, not at SEVERE', async () => {
    render(App);

    displayMultiplier.set(15.0);
    await tick();
    expect(document.documentElement.classList.contains('threat-critical')).toBe(false);

    displayMultiplier.set(30.0);
    await tick();
    expect(document.documentElement.classList.contains('threat-critical')).toBe(true);
  });

  it('CSS vars update as multiplier escalates through all threat tiers', async () => {
    render(App);

    for (const { multiplier, color } of THREAT_CASES) {
      displayMultiplier.set(multiplier);
      await tick();
      const cssColor = document.documentElement.style.getPropertyValue('--threat-color');
      expect(cssColor).toBe(color);
    }
  });
});
