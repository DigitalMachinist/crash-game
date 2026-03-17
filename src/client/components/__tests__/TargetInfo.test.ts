import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import type { RoundTarget } from '../../../types';
import TargetInfo from '../TargetInfo.svelte';

const target: RoundTarget = {
  org: 'ELLINGSON MINERAL',
  ip: '198.51.100.██',
  hostname: 'srv-prod-web-03',
  roundId: 42,
};

describe('TargetInfo', () => {
  it('renders without crashing', () => {
    const { container } = render(TargetInfo, { props: { target } });
    expect(container).toBeTruthy();
  });

  it('renders the org name', () => {
    const { container } = render(TargetInfo, { props: { target } });
    expect(container.textContent).toContain('ELLINGSON MINERAL');
  });

  it('renders the IP address', () => {
    const { container } = render(TargetInfo, { props: { target } });
    expect(container.textContent).toContain('198.51.100.██');
  });

  it('renders the hostname', () => {
    const { container } = render(TargetInfo, { props: { target } });
    expect(container.textContent).toContain('srv-prod-web-03');
  });

  it('renders the round ID', () => {
    const { container } = render(TargetInfo, { props: { target } });
    expect(container.textContent).toContain('#42');
  });

  it('renders all four field labels', () => {
    const { container } = render(TargetInfo, { props: { target } });
    const text = container.textContent ?? '';
    expect(text).toContain('TARGET:');
    expect(text).toContain('ADDR:');
    expect(text).toContain('HOST:');
    expect(text).toContain('ROUND:');
  });

  it('renders placeholder text when target is null', () => {
    const { container } = render(TargetInfo, { props: { target: null } });
    expect(container.textContent).toContain('———');
  });

  it('shows the section label', () => {
    const { container } = render(TargetInfo, { props: { target } });
    expect(container.textContent).toContain('OPERATION BRIEF');
  });
});
