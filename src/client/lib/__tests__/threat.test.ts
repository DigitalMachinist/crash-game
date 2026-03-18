import { describe, expect, it } from 'vitest';
import {
  getDangerColors,
  getSubIndicators,
  getThreatColor,
  getThreatFillCount,
  getThreatLevel,
} from '../threat';

describe('getThreatLevel', () => {
  it('returns GHOST at 1.00x', () => {
    expect(getThreatLevel(1.0)).toBe('GHOST');
  });

  it('returns GHOST below 1.2x', () => {
    expect(getThreatLevel(1.19)).toBe('GHOST');
  });

  it('returns LOW at 1.2x', () => {
    expect(getThreatLevel(1.2)).toBe('LOW');
  });

  it('returns LOW up to (not including) 2.5x', () => {
    expect(getThreatLevel(2.499)).toBe('LOW');
  });

  it('returns ELEVATED at 2.5x', () => {
    expect(getThreatLevel(2.5)).toBe('ELEVATED');
  });

  it('returns ELEVATED up to (not including) 5x', () => {
    expect(getThreatLevel(4.99)).toBe('ELEVATED');
  });

  it('returns HIGH at 5x', () => {
    expect(getThreatLevel(5.0)).toBe('HIGH');
  });

  it('returns HIGH up to (not including) 10x', () => {
    expect(getThreatLevel(9.99)).toBe('HIGH');
  });

  it('returns SEVERE at 10x', () => {
    expect(getThreatLevel(10.0)).toBe('SEVERE');
  });

  it('returns SEVERE up to (not including) 25x', () => {
    expect(getThreatLevel(24.99)).toBe('SEVERE');
  });

  it('returns CRITICAL at 25x', () => {
    expect(getThreatLevel(25.0)).toBe('CRITICAL');
  });

  it('returns CRITICAL above 25x', () => {
    expect(getThreatLevel(100)).toBe('CRITICAL');
  });

  it('boundary: 2.499x is LOW, 2.5x is ELEVATED', () => {
    expect(getThreatLevel(2.499)).toBe('LOW');
    expect(getThreatLevel(2.5)).toBe('ELEVATED');
  });
});

describe('getThreatFillCount', () => {
  it('returns 0 at 1.0x', () => {
    expect(getThreatFillCount(1.0)).toBe(0);
  });

  it('returns 0 below 1.0x', () => {
    expect(getThreatFillCount(0.5)).toBe(0);
  });

  it('returns 2 at 1.2x', () => {
    expect(getThreatFillCount(1.2)).toBe(2);
  });

  it('returns 6 at 2.5x', () => {
    expect(getThreatFillCount(2.5)).toBe(6);
  });

  it('returns 10 at 5x', () => {
    expect(getThreatFillCount(5.0)).toBe(10);
  });

  it('returns 14 at 10x', () => {
    expect(getThreatFillCount(10.0)).toBe(14);
  });

  it('returns 20 at 25x', () => {
    expect(getThreatFillCount(25.0)).toBe(20);
  });

  it('returns 20 above 25x', () => {
    expect(getThreatFillCount(100)).toBe(20);
  });

  it('interpolates within bands', () => {
    // Midpoint of 1.0–1.2 band: fill 0–2, midpoint should be ~1
    expect(getThreatFillCount(1.1)).toBe(1);
    // Midpoint of 2.5–5.0 band: fill 6–10, midpoint should be ~8
    expect(getThreatFillCount(3.75)).toBe(8);
  });
});

describe('getDangerColors', () => {
  it('returns amber for GHOST', () => {
    const c = getDangerColors('GHOST');
    expect(c.color).toBe('#ffb000');
    expect(c.dim).toBe('#805800');
  });

  it('returns amber for LOW', () => {
    const c = getDangerColors('LOW');
    expect(c.color).toBe('#ffb000');
  });

  it('returns orange for ELEVATED', () => {
    const c = getDangerColors('ELEVATED');
    expect(c.color).toBe('#ff8c00');
  });

  it('returns orange-red for HIGH', () => {
    const c = getDangerColors('HIGH');
    expect(c.color).toBe('#ff6600');
  });

  it('returns red-orange for SEVERE', () => {
    const c = getDangerColors('SEVERE');
    expect(c.color).toBe('#ff4400');
  });

  it('returns hot red for CRITICAL', () => {
    const c = getDangerColors('CRITICAL');
    expect(c.color).toBe('#ff0040');
  });

  it('each level has a glowAlpha > 0', () => {
    const levels = ['GHOST', 'LOW', 'ELEVATED', 'HIGH', 'SEVERE', 'CRITICAL'] as const;
    for (const level of levels) {
      expect(getDangerColors(level).glowAlpha).toBeGreaterThan(0);
    }
  });

  it('glowAlpha increases with threat', () => {
    const ghost = getDangerColors('GHOST').glowAlpha;
    const critical = getDangerColors('CRITICAL').glowAlpha;
    expect(critical).toBeGreaterThan(ghost);
  });
});

describe('getThreatColor', () => {
  it('returns amber (#ffb000) for GHOST range (< 1.2x)', () => {
    expect(getThreatColor(1.0)).toBe('#ffb000');
  });

  it('returns amber (#ffb000) for LOW range (1.2x–2.49x)', () => {
    expect(getThreatColor(1.23)).toBe('#ffb000');
  });

  it('returns orange (#ff8c00) for ELEVATED range (2.5x)', () => {
    expect(getThreatColor(2.5)).toBe('#ff8c00');
  });

  it('returns orange-red (#ff6600) for HIGH range (5x)', () => {
    expect(getThreatColor(5.75)).toBe('#ff6600');
  });

  it('returns red-orange (#ff4400) for SEVERE range (10x)', () => {
    expect(getThreatColor(15.0)).toBe('#ff4400');
  });

  it('returns hot red (#ff0040) for CRITICAL range (25x+)', () => {
    expect(getThreatColor(30.0)).toBe('#ff0040');
  });
});

describe('getSubIndicators', () => {
  it('returns safe values for GHOST', () => {
    const s = getSubIndicators('GHOST');
    expect(s.proxies).toBe('6/6');
    expect(s.ids).toBe('silent');
    expect(s.cover).toBe('intact');
  });

  it('returns degrading values for HIGH', () => {
    const s = getSubIndicators('HIGH');
    expect(s.cover).toBe('degrading');
  });

  it('returns burning for CRITICAL', () => {
    const s = getSubIndicators('CRITICAL');
    expect(s.proxies).toBe('0/6 EXPOSED');
    expect(s.ids).toBe('ACTIVE HUNT');
    expect(s.cover).toBe('burning');
  });
});
