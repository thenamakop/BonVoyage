import { describe, expect, it } from 'vitest';
import { formatDate, formatHub, formatInr, groupBudgetLine } from './format';

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

describe('formatHub', () => {
  it('gives the name alone when the state equals the name', () => {
    expect(formatHub({ name: 'Delhi', state: 'Delhi' })).toBe('Delhi');
  });

  it('gives "name, state" otherwise', () => {
    expect(formatHub({ name: 'Gurugram', state: 'Haryana' })).toBe('Gurugram, Haryana');
  });
});

describe('groupBudgetLine', () => {
  it('divides the group total by active members, rounded down to ₹500', () => {
    expect(groupBudgetLine(48000, 3)).toBe(
      'The group budget is ₹48,000, about ₹16,000 each for 3 members.',
    );
    expect(groupBudgetLine(50000, 3)).toBe(
      'The group budget is ₹50,000, about ₹16,500 each for 3 members.',
    );
  });

  it('says "member" for one', () => {
    expect(groupBudgetLine(20000, 1)).toBe(
      'The group budget is ₹20,000, about ₹20,000 each for 1 member.',
    );
  });
});
