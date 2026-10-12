import { describe, expect, it } from 'vitest';
import { formatDate, formatInr } from './format';

describe('formatInr', () => {
  it('formats with Indian grouping and no decimals', () => {
    expect(formatInr(48000)).toBe('₹48,000');
    expect(formatInr(120000)).toBe('₹1,20,000');
    expect(formatInr(800)).toBe('₹800');
  });

  it('formats zero and seven-figure amounts', () => {
    expect(formatInr(0)).toBe('₹0');
    expect(formatInr(1245678)).toBe('₹12,45,678');
  });
});

describe('formatDate', () => {
  it('formats an ISO date as "13 Nov 2026"', () => {
    expect(formatDate('2026-11-13')).toBe('13 Nov 2026');
  });

  it('stays on the same calendar day in Asia/Kolkata', () => {
    expect(formatDate('2026-11-13T20:00:00Z')).toBe('14 Nov 2026');
  });
});
