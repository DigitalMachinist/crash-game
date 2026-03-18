import { describe, expect, it } from 'vitest';
import { pickAgency, pickLockoutSubtitle } from '../crash-agency';

describe('pickAgency', () => {
  it('returns an object with name, subtitle, and caseRef string fields', () => {
    const agency = pickAgency();
    expect(typeof agency.name).toBe('string');
    expect(typeof agency.subtitle).toBe('string');
    expect(typeof agency.caseRef).toBe('string');
  });

  it('name is non-empty', () => {
    const agency = pickAgency();
    expect(agency.name.length).toBeGreaterThan(0);
  });

  it('subtitle is non-empty', () => {
    const agency = pickAgency();
    expect(agency.subtitle.length).toBeGreaterThan(0);
  });

  it('returns different results across calls (random selection)', () => {
    const results = new Set(Array.from({ length: 20 }, () => pickAgency().name));
    expect(results.size).toBeGreaterThan(1);
  });
});

describe('pickLockoutSubtitle', () => {
  it('returns a non-empty string', () => {
    const subtitle = pickLockoutSubtitle();
    expect(typeof subtitle).toBe('string');
    expect(subtitle.length).toBeGreaterThan(0);
  });

  it('returns different results across calls (random selection)', () => {
    const results = new Set(Array.from({ length: 20 }, () => pickLockoutSubtitle()));
    expect(results.size).toBeGreaterThan(1);
  });
});
