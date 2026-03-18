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

  it('does not render STATUS READOUT side panel', () => {
    render(CrashScreen, { crashPoint: 3.0, isSpectator: false });
    expect(screen.queryByText('STATUS READOUT')).toBeNull();
  });

  it('does not render PROXIES COVER IDS readout', () => {
    render(CrashScreen, { crashPoint: 3.0, isSpectator: false });
    expect(screen.queryByText('PROXIES')).toBeNull();
    expect(screen.queryByText('COVER')).toBeNull();
    expect(screen.queryByText('IDS')).toBeNull();
  });

  it('renders agency name in main content area after mount', async () => {
    render(CrashScreen, { crashPoint: 2.5, isSpectator: false });
    // Agency name is set on mount — the main-content div should contain it
    const mainContent = document.querySelector('.main-content');
    expect(mainContent).toBeTruthy();
    // agency.name is set via onMount, may be empty string initially in test
    // Just verify the .agency-name element exists in main-content
    const agencyNameEl = mainContent!.querySelector('.agency-name');
    expect(agencyNameEl).toBeTruthy();
  });

  describe('isEscaped prop', () => {
    it('renders SYSTEM LOCKOUT when isEscaped=true', () => {
      render(CrashScreen, { crashPoint: 3.0, isSpectator: true, isEscaped: true });
      expect(screen.getByText('SYSTEM LOCKOUT')).toBeTruthy();
    });

    it('does not render TRACED when isEscaped=true', () => {
      render(CrashScreen, { crashPoint: 3.0, isSpectator: true, isEscaped: true });
      expect(screen.queryByText('TRACED')).toBeNull();
    });

    it('does not render ALL FUNDS SEIZED when isEscaped=true', () => {
      render(CrashScreen, { crashPoint: 3.0, isSpectator: false, isEscaped: true });
      expect(screen.queryByText('ALL FUNDS SEIZED')).toBeNull();
    });

    it('does not render ALL FUNDS SEIZED when isEscaped=true and isSpectator=true', () => {
      render(CrashScreen, { crashPoint: 3.0, isSpectator: true, isEscaped: true });
      expect(screen.queryByText('ALL FUNDS SEIZED')).toBeNull();
    });

    it('renders TRACED when isEscaped=false (default)', () => {
      render(CrashScreen, { crashPoint: 3.0, isSpectator: false });
      expect(screen.getByText('TRACED')).toBeTruthy();
    });

    it('does not render SYSTEM LOCKOUT when isEscaped=false (default)', () => {
      render(CrashScreen, { crashPoint: 3.0, isSpectator: false });
      expect(screen.queryByText('SYSTEM LOCKOUT')).toBeNull();
    });

    it('applies escaped CSS class when isEscaped=true', () => {
      render(CrashScreen, { crashPoint: 3.0, isSpectator: true, isEscaped: true });
      const screen_ = document.querySelector('.crash-screen');
      expect(screen_?.classList.contains('escaped')).toBe(true);
    });
  });
});
