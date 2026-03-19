import type { DangerColors, ThreatLevel } from '../../types';

export function getThreatLevel(multiplier: number): ThreatLevel {
  if (multiplier >= 25) return 'CRITICAL';
  if (multiplier >= 10) return 'SEVERE';
  if (multiplier >= 5) return 'HIGH';
  if (multiplier >= 2.5) return 'ELEVATED';
  if (multiplier >= 1.2) return 'LOW';
  return 'GHOST';
}

export function getDangerColors(level: ThreatLevel): DangerColors {
  switch (level) {
    case 'GHOST':
      return {
        color: '#ffb000',
        dim: '#805800',
        dimText: '#c08400',
        bg: '#0a0800',
        border: '#332800',
        glowAlpha: 0.15,
      };
    case 'LOW':
      return {
        color: '#ffb000',
        dim: '#805800',
        dimText: '#c08400',
        bg: '#0a0800',
        border: '#332800',
        glowAlpha: 0.2,
      };
    case 'ELEVATED':
      return {
        color: '#ff8c00',
        dim: '#803000',
        dimText: '#c04800',
        bg: '#0f0800',
        border: '#332800',
        glowAlpha: 0.3,
      };
    case 'HIGH':
      return {
        color: '#ff6600',
        dim: '#803000',
        dimText: '#c04800',
        bg: '#100700',
        border: '#331800',
        glowAlpha: 0.35,
      };
    case 'SEVERE':
      return {
        color: '#ff4400',
        dim: '#800020',
        dimText: '#c00030',
        bg: '#120600',
        border: '#331800',
        glowAlpha: 0.45,
      };
    case 'CRITICAL':
      return {
        color: '#ff0040',
        dim: '#400000',
        dimText: '#800020',
        bg: '#1a0000',
        border: '#400000',
        glowAlpha: 0.6,
      };
  }
}

/** Returns the threat-palette hex color for a given multiplier value. */
export function getThreatColor(multiplier: number): string {
  return getDangerColors(getThreatLevel(multiplier)).color;
}

/**
 * Returns 0–20 fill count for the threat bar, continuously interpolated
 * from multiplier. Breakpoints: 1x→0, 1.2x→2, 2.5x→6, 5x→10, 10x→14, 25x→20.
 */
export function getThreatFillCount(multiplier: number): number {
  const breakpoints: [number, number][] = [
    [1.0, 0],
    [1.2, 2],
    [2.5, 6],
    [5.0, 10],
    [10.0, 14],
    [25.0, 20],
  ];

  if (multiplier <= 1.0) return 0;
  if (multiplier >= 25.0) return 20;

  for (let i = 1; i < breakpoints.length; i++) {
    const prev = breakpoints[i - 1]!;
    const curr = breakpoints[i]!;
    const [x0, y0] = prev;
    const [x1, y1] = curr;
    if (multiplier <= x1) {
      const t = (multiplier - x0) / (x1 - x0);
      return Math.round(y0 + t * (y1 - y0));
    }
  }
  return 20;
}

/**
 * Returns qualitative sub-indicators for the threat panel.
 * variance parameter (0–1) controls per-round randomness within tier bounds.
 */
export function getSubIndicators(
  level: ThreatLevel,
  variance = 0,
): { proxies: string; ids: string; cover: string } {
  switch (level) {
    case 'GHOST':
      return { proxies: '6/6', ids: 'silent', cover: 'intact' };
    case 'LOW':
      return { proxies: '6/6', ids: 'silent', cover: 'intact' };
    case 'ELEVATED':
      return { proxies: '6/6', ids: '1 alert', cover: 'intact' };
    case 'HIGH': {
      const proxCount = variance < 0.5 ? 5 : 4;
      const alerts = variance < 0.5 ? 2 : 3;
      return { proxies: `${proxCount}/6`, ids: `${alerts} alerts`, cover: 'degrading' };
    }
    case 'SEVERE': {
      const proxCount = variance < 0.5 ? 3 : 2;
      return { proxies: `${proxCount}/6`, ids: '5+ alerts', cover: 'compromised' };
    }
    case 'CRITICAL':
      return { proxies: '0/6 EXPOSED', ids: 'ACTIVE HUNT', cover: 'burning' };
    default:
      return { proxies: '6/6', ids: 'silent', cover: 'intact' };
  }
}
