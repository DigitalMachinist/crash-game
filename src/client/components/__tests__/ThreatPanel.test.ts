import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import ThreatPanel from '../ThreatPanel.svelte';

describe('ThreatPanel', () => {
  it('renders JP accent header', () => {
    render(ThreatPanel, { threatLevel: 'GHOST', multiplier: 1.0 });
    expect(screen.getByText(/THREAT ASSESSMENT/)).toBeTruthy();
  });

  it('renders STATUS row with current threat level', () => {
    render(ThreatPanel, { threatLevel: 'ELEVATED', multiplier: 3.0 });
    expect(screen.getByText('STATUS')).toBeTruthy();
    expect(screen.getByText('ELEVATED')).toBeTruthy();
  });

  it('renders PROXIES IDS COVER rows', () => {
    render(ThreatPanel, { threatLevel: 'GHOST', multiplier: 1.0 });
    expect(screen.getByText('PROXIES')).toBeTruthy();
    expect(screen.getByText('IDS')).toBeTruthy();
    expect(screen.getByText('COVER')).toBeTruthy();
  });

  it('shows correct sub-indicators for GHOST level', () => {
    render(ThreatPanel, { threatLevel: 'GHOST', multiplier: 1.0 });
    expect(screen.getByText('6/6')).toBeTruthy();
    expect(screen.getByText('silent')).toBeTruthy();
    expect(screen.getByText('intact')).toBeTruthy();
  });

  it('shows correct sub-indicators for CRITICAL level', () => {
    render(ThreatPanel, { threatLevel: 'CRITICAL', multiplier: 30.0 });
    expect(screen.getByText('0/6 EXPOSED')).toBeTruthy();
    expect(screen.getByText('ACTIVE HUNT')).toBeTruthy();
    expect(screen.getByText('burning')).toBeTruthy();
  });

  it('applies critical class at CRITICAL threat level', () => {
    render(ThreatPanel, { threatLevel: 'CRITICAL', multiplier: 30.0 });
    const panel = document.querySelector('.threat-panel');
    expect(panel?.classList.contains('critical')).toBe(true);
  });

  it('applies severe class at SEVERE threat level', () => {
    render(ThreatPanel, { threatLevel: 'SEVERE', multiplier: 15.0 });
    const panel = document.querySelector('.threat-panel');
    expect(panel?.classList.contains('severe')).toBe(true);
  });

  it('does NOT apply severe or critical class at LOW threat level', () => {
    render(ThreatPanel, { threatLevel: 'LOW', multiplier: 1.5 });
    const panel = document.querySelector('.threat-panel');
    expect(panel?.classList.contains('severe')).toBe(false);
    expect(panel?.classList.contains('critical')).toBe(false);
  });

  describe('disconnected prop', () => {
    it('renders OFFLINE status when disconnected=true', () => {
      render(ThreatPanel, { threatLevel: 'CRITICAL', multiplier: 30.0, disconnected: true });
      expect(screen.getByText('OFFLINE')).toBeTruthy();
    });

    it('renders scrubbed proxies when disconnected=true', () => {
      render(ThreatPanel, { threatLevel: 'CRITICAL', multiplier: 30.0, disconnected: true });
      expect(screen.getByText('scrubbed')).toBeTruthy();
    });

    it('renders dark IDS when disconnected=true', () => {
      render(ThreatPanel, { threatLevel: 'CRITICAL', multiplier: 30.0, disconnected: true });
      expect(screen.getByText('dark')).toBeTruthy();
    });

    it('renders restored cover when disconnected=true', () => {
      render(ThreatPanel, { threatLevel: 'CRITICAL', multiplier: 30.0, disconnected: true });
      expect(screen.getByText('restored')).toBeTruthy();
    });

    it('does NOT apply critical class when disconnected=true even at CRITICAL level', () => {
      render(ThreatPanel, { threatLevel: 'CRITICAL', multiplier: 30.0, disconnected: true });
      const panel = document.querySelector('.threat-panel');
      expect(panel?.classList.contains('critical')).toBe(false);
    });

    it('applies disconnected class when disconnected=true', () => {
      render(ThreatPanel, { threatLevel: 'GHOST', multiplier: 1.0, disconnected: true });
      const panel = document.querySelector('.threat-panel');
      expect(panel?.classList.contains('disconnected')).toBe(true);
    });
  });
});
