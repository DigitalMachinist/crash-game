import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import CRTOverlay from '../CRTOverlay.svelte';

describe('CRTOverlay', () => {
  it('renders without crashing', () => {
    const { container } = render(CRTOverlay);
    expect(container).toBeTruthy();
  });

  it('applies flk-lo class for GHOST', () => {
    const { container } = render(CRTOverlay, { props: { threatLevel: 'GHOST' } });
    expect(container.querySelector('.flk-lo')).toBeTruthy();
    expect(container.querySelector('.flk-hi')).toBeFalsy();
  });

  it('applies flk-lo class for LOW', () => {
    const { container } = render(CRTOverlay, { props: { threatLevel: 'LOW' } });
    expect(container.querySelector('.flk-lo')).toBeTruthy();
  });

  it('applies flk-lo class for ELEVATED', () => {
    const { container } = render(CRTOverlay, { props: { threatLevel: 'ELEVATED' } });
    expect(container.querySelector('.flk-lo')).toBeTruthy();
  });

  it('applies flk-lo class for HIGH', () => {
    const { container } = render(CRTOverlay, { props: { threatLevel: 'HIGH' } });
    expect(container.querySelector('.flk-lo')).toBeTruthy();
    expect(container.querySelector('.flk-hi')).toBeFalsy();
  });

  it('applies flk-hi class for SEVERE', () => {
    const { container } = render(CRTOverlay, { props: { threatLevel: 'SEVERE' } });
    expect(container.querySelector('.flk-hi')).toBeTruthy();
    expect(container.querySelector('.flk-lo')).toBeFalsy();
  });

  it('applies flk-hi class for CRITICAL', () => {
    const { container } = render(CRTOverlay, { props: { threatLevel: 'CRITICAL' } });
    expect(container.querySelector('.flk-hi')).toBeTruthy();
    expect(container.querySelector('.flk-lo')).toBeFalsy();
  });

  it('does not render vhs2 for GHOST through HIGH', () => {
    for (const level of ['GHOST', 'LOW', 'ELEVATED', 'HIGH'] as const) {
      const { container } = render(CRTOverlay, { props: { threatLevel: level } });
      expect(container.querySelector('.vhs2')).toBeFalsy();
    }
  });

  it('renders vhs2 div for SEVERE', () => {
    const { container } = render(CRTOverlay, { props: { threatLevel: 'SEVERE' } });
    expect(container.querySelector('.vhs2')).toBeTruthy();
  });

  it('renders vhs2 div for CRITICAL', () => {
    const { container } = render(CRTOverlay, { props: { threatLevel: 'CRITICAL' } });
    expect(container.querySelector('.vhs2')).toBeTruthy();
  });

  it('always renders the primary vhs band', () => {
    const { container } = render(CRTOverlay, { props: { threatLevel: 'GHOST' } });
    expect(container.querySelector('.vhs')).toBeTruthy();
  });

  it('has a .crt container element', () => {
    const { container } = render(CRTOverlay);
    expect(container.querySelector('.crt')).toBeTruthy();
  });
});
