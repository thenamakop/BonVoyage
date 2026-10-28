import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatHub,
  formatInr,
  formatRelative,
  groupBudgetLine,
  perPersonShare,
  updatedAgo,
} from './format';

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

  it('a lone member gets no share yet (S1-2 review)', () => {
    expect(groupBudgetLine(20000, 1)).toBe(
      'The group budget is ₹20,000. Per-person share appears once people join.',
    );
  });
});

describe('perPersonShare', () => {
  it('1 member: no share until people join', () => {
    expect(perPersonShare(48000, 1)).toBe('Per-person share appears once people join');
  });

  it('3 members: the group total over 3, rounded down to ₹500', () => {
    expect(perPersonShare(48000, 3)).toBe('about ₹16,000 each');
    expect(perPersonShare(50000, 3)).toBe('about ₹16,500 each');
  });

  it('4 members', () => {
    expect(perPersonShare(48000, 4)).toBe('about ₹12,000 each');
    expect(perPersonShare(45000, 4)).toBe('about ₹11,000 each');
  });
});

describe('formatRelative and updatedAgo', () => {
  const now = Date.parse('2026-10-13T10:00:00Z');
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it('words a past time', () => {
    expect(formatRelative(ago(10_000), now)).toBe('just now');
    expect(formatRelative(ago(5 * 60_000), now)).toBe('5 minutes ago');
    expect(formatRelative(ago(2 * 3_600_000), now)).toBe('2 hours ago');
    expect(formatRelative(ago(26 * 3_600_000), now)).toBe('yesterday');
  });

  it('never words a time ahead of the browser clock as the future', () => {
    expect(formatRelative(ago(30_000), now)).toBe('just now');
    expect(formatRelative(ago(-2 * 60_000), now)).toBe('just now');
    // Further ahead is still clock skew, not a future event: also "just now".
    expect(formatRelative(ago(-10 * 60_000), now)).toBe('just now');
  });

  it('ticks the footer in 5-second steps, then minutes', () => {
    expect(updatedAgo(now - 3_000, now)).toBe('Updated just now');
    expect(updatedAgo(now - 7_000, now)).toBe('Updated 5 seconds ago');
    expect(updatedAgo(now - 59_000, now)).toBe('Updated 55 seconds ago');
    expect(updatedAgo(now - 61_000, now)).toBe('Updated 1 minute ago');
  });
});
