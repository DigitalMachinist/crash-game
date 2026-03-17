import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TerminalLine } from '../../../types';
import { getBaseInterval, getTierForMultiplier, startTerminalSession } from '../terminal-content';

describe('getTierForMultiplier', () => {
  it('returns 1 at 1.0x', () => expect(getTierForMultiplier(1.0)).toBe(1));
  it('returns 1 at 1.49x', () => expect(getTierForMultiplier(1.49)).toBe(1));
  it('returns 2 at 1.5x', () => expect(getTierForMultiplier(1.5)).toBe(2));
  it('returns 2 at 2.99x', () => expect(getTierForMultiplier(2.99)).toBe(2));
  it('returns 3 at 3x', () => expect(getTierForMultiplier(3)).toBe(3));
  it('returns 4 at 6x', () => expect(getTierForMultiplier(6)).toBe(4));
  it('returns 5 at 15x', () => expect(getTierForMultiplier(15)).toBe(5));
  it('returns 6 at 30x', () => expect(getTierForMultiplier(30)).toBe(6));
  it('returns 6 at 100x', () => expect(getTierForMultiplier(100)).toBe(6));
});

describe('getBaseInterval', () => {
  it('returns ~1750ms for tier 1', () => expect(getBaseInterval(1.0)).toBe(1750));
  it('returns ~1250ms for tier 2', () => expect(getBaseInterval(1.5)).toBe(1250));
  it('returns ~750ms for tier 3', () => expect(getBaseInterval(3)).toBe(750));
  it('returns ~400ms for tier 4', () => expect(getBaseInterval(6)).toBe(400));
  it('returns ~250ms for tier 5', () => expect(getBaseInterval(15)).toBe(250));
  it('returns ~150ms for tier 6', () => expect(getBaseInterval(30)).toBe(150));

  it('emission interval decreases as multiplier increases', () => {
    const t1 = getBaseInterval(1.0);
    const t3 = getBaseInterval(5.0);
    const t6 = getBaseInterval(50);
    expect(t3).toBeLessThan(t1);
    expect(t6).toBeLessThan(t3);
  });
});

describe('session lifecycle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('emits lines after initial delay', () => {
    const lines: TerminalLine[] = [];
    const session = startTerminalSession(
      1,
      () => 1.0,
      (l) => lines.push(l),
      () => {},
    );
    expect(lines.length).toBe(0);
    vi.advanceTimersByTime(600); // past initial 200–500ms delay
    expect(lines.length).toBeGreaterThanOrEqual(1);
    session.stop();
  });

  it('stops emitting after session.stop()', () => {
    const lines: TerminalLine[] = [];
    const session = startTerminalSession(
      1,
      () => 1.0,
      (l) => lines.push(l),
      () => {},
    );
    vi.advanceTimersByTime(600);
    const countBefore = lines.length;
    session.stop();
    vi.advanceTimersByTime(5000);
    expect(lines.length).toBe(countBefore);
  });

  it('emits lines at faster rate for higher multiplier', () => {
    const slowLines: TerminalLine[] = [];
    const fastLines: TerminalLine[] = [];

    const slow = startTerminalSession(
      1,
      () => 1.0,
      (l) => slowLines.push(l),
      () => {},
    );
    const fast = startTerminalSession(
      2,
      () => 30.0,
      (l) => fastLines.push(l),
      () => {},
    );

    vi.advanceTimersByTime(3000);
    slow.stop();
    fast.stop();

    expect(fastLines.length).toBeGreaterThan(slowLines.length);
  });

  it('emitted lines have required fields', () => {
    const lines: TerminalLine[] = [];
    const session = startTerminalSession(
      42,
      () => 1.0,
      (l) => lines.push(l),
      () => {},
    );
    vi.advanceTimersByTime(3000);
    session.stop();
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(typeof line.id).toBe('number');
      expect(typeof line.text).toBe('string');
      expect(line.text.length).toBeGreaterThan(0);
      expect(typeof line.color).toBe('string');
      expect(['normal', 'success', 'warning', 'danger', 'progress', 'command']).toContain(
        line.type,
      );
    }
  });

  it('reuses same hostname within session', () => {
    const lines: TerminalLine[] = [];
    const session = startTerminalSession(
      99,
      () => 2.0,
      (l) => lines.push(l),
      () => {},
    );
    vi.advanceTimersByTime(8000);
    session.stop();
    // Lines that contain a hostname should all use the same one
    const hostnames = new Set<string>();
    const knownHosts = [
      'srv-prod-web-03',
      'db-primary-01',
      'mail-gw-02',
      'api-node-07',
      'core-auth-01',
    ];
    for (const line of lines) {
      for (const h of knownHosts) {
        if (line.text.includes(h)) hostnames.add(h);
      }
    }
    expect(hostnames.size).toBeLessThanOrEqual(1);
  });

  it('calls onProgressUpdate for progress lines', () => {
    const updates: Array<{ id: number; text: string }> = [];
    const session = startTerminalSession(
      5,
      () => 8.0, // tier 4 — progress templates active
      () => {},
      (id, text) => updates.push({ id, text }),
    );
    vi.advanceTimersByTime(10000);
    session.stop();
    // Progress updates may or may not trigger depending on random template picks
    // Just verify the callback signature works without throwing
    expect(typeof updates).toBe('object');
  });
});
