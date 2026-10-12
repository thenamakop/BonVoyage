import { describe, expect, it } from 'vitest';
import { indiaDate, nightsBetween } from './time';

describe('indiaDate', () => {
  it('is still the same day at 18:29 UTC (23:59 IST)', () => {
    expect(indiaDate(new Date('2026-11-12T18:29:00Z'))).toBe('2026-11-12');
  });

  it('turns to the next day at 18:31 UTC (00:01 IST)', () => {
    expect(indiaDate(new Date('2026-11-12T18:31:00Z'))).toBe('2026-11-13');
  });
});

describe('nightsBetween', () => {
  it('counts whole nights, across a month end', () => {
    expect(nightsBetween('2026-11-13', '2026-11-15')).toBe(2);
    expect(nightsBetween('2026-10-30', '2026-11-02')).toBe(3);
    expect(nightsBetween('2026-11-13', '2026-11-13')).toBe(0);
  });
});
