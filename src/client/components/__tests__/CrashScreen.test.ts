import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import CrashScreen from '../CrashScreen.svelte';

describe('CrashScreen', () => {
  it('renders TRACED text', () => {
    render(CrashScreen, { crashPoint: 2.5, isSpectator: false });
    expect(screen.getByText('TRACED')).toBeTruthy();
  });

  it('renders crash multiplier value', () => {
    render(CrashScreen, { crashPoint: 4.73, isSpectator: false });
    expect(screen.getByText('4.73x')).toBeTruthy();
  });

  it('renders hazard stripe elements', () => {
    render(CrashScreen, { crashPoint: 1.5, isSpectator: false });
    const stripes = document.querySelectorAll('.hazard-stripe');
    expect(stripes.length).toBe(2);
  });

  it('renders ALL FUNDS SEIZED when not spectator', () => {
    render(CrashScreen, { crashPoint: 2.0, isSpectator: false });
    expect(screen.getByText('ALL FUNDS SEIZED')).toBeTruthy();
  });

  it('hides ALL FUNDS SEIZED when isSpectator=true', () => {
    render(CrashScreen, { crashPoint: 2.0, isSpectator: true });
    expect(screen.queryByText('ALL FUNDS SEIZED')).toBeNull();
  });

  it('renders STATUS READOUT in side panel', () => {
    render(CrashScreen, { crashPoint: 3.0, isSpectator: false });
    expect(screen.getByText('STATUS READOUT')).toBeTruthy();
  });

  it('renders PROXIES COVER IDS readout values', () => {
    render(CrashScreen, { crashPoint: 3.0, isSpectator: false });
    expect(screen.getByText('PROXIES')).toBeTruthy();
    expect(screen.getByText('COVER')).toBeTruthy();
    expect(screen.getByText('IDS')).toBeTruthy();
  });
});
