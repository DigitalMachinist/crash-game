import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import type { ThreatLevel } from '../../../types';
import ThreatMeter from '../ThreatMeter.svelte';

describe('ThreatMeter', () => {
  it('renders a 20-char bar', () => {
    render(ThreatMeter, { multiplier: 1.0, threatLevel: 'GHOST' });
    // bar is ▓▓▓▓░░░░░░░░░░░░░░░░ or similar — 20 chars total
    const bar = document.querySelector('.bar');
    expect(bar).toBeTruthy();
    // Count filled + empty = 20
    const text = bar?.textContent ?? '';
    const filled = [...text].filter((c) => c === '▓').length;
    const empty = [...text].filter((c) => c === '░').length;
    expect(filled + empty).toBe(20);
  });

  it('fills 0 chars at 1.0x (GHOST)', () => {
    render(ThreatMeter, { multiplier: 1.0, threatLevel: 'GHOST' });
    const bar = document.querySelector('.bar');
    const text = bar?.textContent ?? '';
    const filled = [...text].filter((c) => c === '▓').length;
    expect(filled).toBe(0);
  });

  it('fills 20 chars at 25x (CRITICAL)', () => {
    render(ThreatMeter, { multiplier: 25.0, threatLevel: 'CRITICAL' });
    const bar = document.querySelector('.bar');
    const text = bar?.textContent ?? '';
    const filled = [...text].filter((c) => c === '▓').length;
    expect(filled).toBe(20);
  });

  it('fills partial chars at intermediate multiplier', () => {
    render(ThreatMeter, { multiplier: 5.0, threatLevel: 'HIGH' });
    const bar = document.querySelector('.bar');
    const text = bar?.textContent ?? '';
    const filled = [...text].filter((c) => c === '▓').length;
    // At 5.0x, fill is 10
    expect(filled).toBe(10);
  });

  it('shows THREAT: label', () => {
    render(ThreatMeter, { multiplier: 1.0, threatLevel: 'GHOST' });
    expect(screen.getByText(/THREAT:/)).toBeTruthy();
  });

  it('shows level name in bar row', () => {
    render(ThreatMeter, { multiplier: 2.5, threatLevel: 'ELEVATED' });
    expect(screen.getByText('ELEVATED')).toBeTruthy();
  });

  it('shows !! CRITICAL suffix at CRITICAL threat level', () => {
    render(ThreatMeter, { multiplier: 25.0, threatLevel: 'CRITICAL' });
    expect(screen.getByText('!! CRITICAL')).toBeTruthy();
  });

  it('renders sub-indicators PROXIES IDS COVER', () => {
    render(ThreatMeter, { multiplier: 1.0, threatLevel: 'GHOST' });
    expect(screen.getByText(/PROXIES:/)).toBeTruthy();
    expect(screen.getByText(/IDS:/)).toBeTruthy();
    expect(screen.getByText(/COVER:/)).toBeTruthy();
  });

  it('sub-indicator values match GHOST level', () => {
    render(ThreatMeter, { multiplier: 1.0, threatLevel: 'GHOST' });
    expect(screen.getByText(/PROXIES: 6\/6/)).toBeTruthy();
    expect(screen.getByText(/IDS: silent/)).toBeTruthy();
    expect(screen.getByText(/COVER: intact/)).toBeTruthy();
  });

  it('sub-indicator values match CRITICAL level', () => {
    render(ThreatMeter, { multiplier: 30.0, threatLevel: 'CRITICAL' });
    expect(screen.getByText(/PROXIES: 0\/6 EXPOSED/)).toBeTruthy();
    expect(screen.getByText(/IDS: ACTIVE HUNT/)).toBeTruthy();
    expect(screen.getByText(/COVER: BLOWN/)).toBeTruthy();
  });
});
