import { describe, expect, it } from 'vitest';
import { indiaDate, indiaDateTime, nightsBetween } from './time';

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

describe('indiaDateTime', () => {
  it('writes an instant in India time with a lower-case am or pm', () => {
    expect(indiaDateTime(new Date('2026-11-02T06:30:00Z'))).toBe('2 Nov, 12:00 pm');
    expect(indiaDateTime(new Date('2026-11-02T18:30:00Z'))).toBe('3 Nov, 12:00 am');
    expect(indiaDateTime(new Date('2026-11-02T10:05:00Z'))).toBe('2 Nov, 3:35 pm');
  });
});
