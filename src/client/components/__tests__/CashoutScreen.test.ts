import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import CashoutScreen from '../CashoutScreen.svelte';

describe('CashoutScreen', () => {
  it('renders CONNECTION TERMINATED for LOW threat', () => {
    render(CashoutScreen, { payout: 250, cashoutMultiplier: 2.5, threatLevel: 'LOW' });
    expect(screen.getByText('CONNECTION TERMINATED')).toBeTruthy();
  });

  it('renders CONNECTION TERMINATED for GHOST threat', () => {
    render(CashoutScreen, { payout: 100, cashoutMultiplier: 1.5, threatLevel: 'GHOST' });
    expect(screen.getByText('CONNECTION TERMINATED')).toBeTruthy();
  });

  it('renders EMERGENCY DISCONNECT for SEVERE threat', () => {
    render(CashoutScreen, { payout: 500, cashoutMultiplier: 12.0, threatLevel: 'SEVERE' });
    expect(screen.getByText('EMERGENCY DISCONNECT')).toBeTruthy();
  });

  it('renders EMERGENCY DISCONNECT for CRITICAL threat', () => {
    render(CashoutScreen, { payout: 1000, cashoutMultiplier: 30.0, threatLevel: 'CRITICAL' });
    expect(screen.getByText('EMERGENCY DISCONNECT')).toBeTruthy();
  });

  it('formats payout with CR suffix', () => {
    render(CashoutScreen, { payout: 1250.5, cashoutMultiplier: 5.0, threatLevel: 'HIGH' });
    expect(screen.getByText(/1,250\.50 CR/)).toBeTruthy();
  });

  it('formats payout with + prefix', () => {
    render(CashoutScreen, { payout: 200, cashoutMultiplier: 2.0, threatLevel: 'LOW' });
    expect(screen.getByText(/\+200\.00 CR/)).toBeTruthy();
  });

  it('applies tier3 class at CRITICAL', () => {
    render(CashoutScreen, { payout: 5000, cashoutMultiplier: 30.0, threatLevel: 'CRITICAL' });
    const screen_el = document.querySelector('.cashout-screen');
    expect(screen_el?.classList.contains('tier3')).toBe(true);
  });

  it('applies tier2 class at SEVERE', () => {
    render(CashoutScreen, { payout: 500, cashoutMultiplier: 12.0, threatLevel: 'SEVERE' });
    const screen_el = document.querySelector('.cashout-screen');
    expect(screen_el?.classList.contains('tier2')).toBe(true);
  });

  it('applies large class to payout at CRITICAL', () => {
    render(CashoutScreen, { payout: 5000, cashoutMultiplier: 30.0, threatLevel: 'CRITICAL' });
    const payout_el = document.querySelector('.payout');
    expect(payout_el?.classList.contains('large')).toBe(true);
  });

  it('footer shows DISCONNECTED @ multiplier for tier 1', () => {
    render(CashoutScreen, { payout: 200, cashoutMultiplier: 2.5, threatLevel: 'LOW' });
    expect(screen.getByText(/DISCONNECTED @ 2\.50x/)).toBeTruthy();
  });

  it('footer shows LEGENDARY suffix for CRITICAL', () => {
    render(CashoutScreen, { payout: 5000, cashoutMultiplier: 30.0, threatLevel: 'CRITICAL' });
    expect(screen.getByText(/LEGENDARY/)).toBeTruthy();
  });

  it('footer shows CLOSE CALL suffix for SEVERE', () => {
    render(CashoutScreen, { payout: 500, cashoutMultiplier: 12.0, threatLevel: 'SEVERE' });
    expect(screen.getByText(/CLOSE CALL/)).toBeTruthy();
  });
});
