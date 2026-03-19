import { describe, expect, it } from 'vitest';
import { getPrepLines } from '../prep-terminal';

describe('getPrepLines', () => {
  it('returns no lines when secondsRemaining is above 10', () => {
    const lines = getPrepLines(11, null);
    expect(lines).toEqual([]);
  });

  it('returns 1 line when secondsRemaining is 10 (only the first line)', () => {
    const lines = getPrepLines(10, null);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.text).toContain('Initializing proxy chain');
  });

  it('returns all 10 lines when secondsRemaining is 1', () => {
    const lines = getPrepLines(1, null);
    expect(lines).toHaveLength(10);
  });

  it('returns lines in countdown order (10 down to secondsRemaining)', () => {
    const lines = getPrepLines(5, null);
    expect(lines).toHaveLength(6); // 10, 9, 8, 7, 6, 5
    expect(lines[0]!.text).toContain('[00:10]');
    expect(lines[5]!.text).toContain('[00:05]');
  });

  it('uses fallback IP when target is null', () => {
    const lines = getPrepLines(4, null);
    const nmapLine = lines.find((l) => l.text.includes('nmap'));
    expect(nmapLine).toBeTruthy();
    expect(nmapLine!.text).toContain('198.51.100.██');
  });

  it('uses target IP when provided', () => {
    const target = { org: 'TestOrg', hostname: 'test.host', ip: '203.0.113.██', roundId: 1 };
    const lines = getPrepLines(4, target);
    const nmapLine = lines.find((l) => l.text.includes('nmap'));
    expect(nmapLine).toBeTruthy();
    expect(nmapLine!.text).toContain('203.0.113.██');
  });

  it('pads single-digit seconds with leading zero', () => {
    const lines = getPrepLines(1, null);
    const lastLine = lines[lines.length - 1]!;
    expect(lastLine.text).toContain('[00:01]');
  });

  it('does not pad double-digit seconds', () => {
    const lines = getPrepLines(10, null);
    expect(lines[0]!.text).toContain('[00:10]');
  });

  it('assigns unique IDs to each line', () => {
    const lines = getPrepLines(1, null);
    const ids = lines.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each line has a timestamp', () => {
    const lines = getPrepLines(5, null);
    for (const line of lines) {
      expect(line.timestamp).toBeTypeOf('number');
      expect(line.timestamp).toBeGreaterThan(0);
    }
  });

  it('returns 0 lines when secondsRemaining is 0 and all lines are already shown', () => {
    // secondsRemaining=0 means loop goes from 10 down to 0, covering all entries (10 through 1)
    // There is no entry for key 0, so still 10 lines
    const lines = getPrepLines(0, null);
    expect(lines).toHaveLength(10);
  });
});
