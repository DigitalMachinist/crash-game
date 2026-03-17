import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import type { TerminalLine } from '../../../types';
import TerminalDisplay from '../TerminalDisplay.svelte';

function makeLine(
  id: number,
  text: string,
  color = '#ffb000',
  type: TerminalLine['type'] = 'normal',
): TerminalLine {
  return { id, text, color, type, timestamp: Date.now() };
}

describe('TerminalDisplay', () => {
  it('renders without crashing with no lines', () => {
    const { container } = render(TerminalDisplay);
    expect(container).toBeTruthy();
  });

  it('renders each line with its text', () => {
    const lines = [makeLine(1, 'Hello, world'), makeLine(2, 'Second line')];
    const { container } = render(TerminalDisplay, { props: { lines } });
    expect(container.textContent).toContain('Hello, world');
    expect(container.textContent).toContain('Second line');
  });

  it('renders each line with its color via inline style', () => {
    const lines = [makeLine(1, 'test', '#ff0040')];
    const { container } = render(TerminalDisplay, { props: { lines } });
    const lineEl = container.querySelector('.line');
    expect(lineEl).toBeTruthy();
    expect((lineEl as HTMLElement).style.color).toBe('rgb(255, 0, 64)');
  });

  it('renders empty state without error', () => {
    const { container } = render(TerminalDisplay, { props: { lines: [] } });
    expect(container.querySelector('.terminal')).toBeTruthy();
    expect(container.querySelectorAll('.line').length).toBe(0);
  });

  it('applies dim class when dim=true', () => {
    const { container } = render(TerminalDisplay, { props: { dim: true } });
    expect(container.querySelector('.terminal.dim')).toBeTruthy();
  });

  it('does not apply dim class when dim=false', () => {
    const { container } = render(TerminalDisplay, { props: { dim: false } });
    expect(container.querySelector('.terminal.dim')).toBeFalsy();
  });

  it('applies type class to each line', () => {
    const lines = [
      makeLine(1, 'danger line', '#ff0040', 'danger'),
      makeLine(2, 'success line', '#00cc66', 'success'),
    ];
    const { container } = render(TerminalDisplay, { props: { lines } });
    expect(container.querySelector('.line.danger')).toBeTruthy();
    expect(container.querySelector('.line.success')).toBeTruthy();
  });
});
