import { describe, expect, it } from 'vitest';
import { PreferenceInput } from './preferences';

const valid = {
  destinationTypes: ['mountain', 'spiritual'],
  activities: ['trekking', 'temples'],
  climate: 'mild',
  travelStyle: 'comfort',
  budgetMinInr: 8000,
  budgetMaxInr: 12000,
  dateStart: '2026-11-13',
  dateEnd: '2026-11-15',
};

const issuesOf = (input: unknown) => {
  const r = PreferenceInput.safeParse(input);
  return r.success
    ? []
    : r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
};

describe('PreferenceInput', () => {
  it('accepts a full preference', () => {
    expect(PreferenceInput.parse(valid)).toEqual(valid);
  });

  it('needs at least one destination type, with a sentence', () => {
    expect(issuesOf({ ...valid, destinationTypes: [] })).toEqual([
      { path: 'destinationTypes', message: 'Pick at least one kind of place.' },
    ]);
  });

  it('rejects duplicates and unknown vocabulary', () => {
    expect(issuesOf({ ...valid, activities: ['trekking', 'trekking'] })[0]?.path).toBe(
      'activities',
    );
    expect(issuesOf({ ...valid, destinationTypes: ['moon'] })[0]?.path).toBe('destinationTypes.0');
  });

  it('puts max < min on budgetMaxInr, even while other fields are still empty', () => {
    expect(issuesOf({ ...valid, budgetMinInr: 8000, budgetMaxInr: 6000 })).toEqual([
      { path: 'budgetMaxInr', message: 'Maximum must be at least the minimum.' },
    ]);
    const paths = issuesOf({ ...valid, destinationTypes: [], budgetMaxInr: 6000 }).map(
      (i) => i.path,
    );
    expect(paths).toEqual(['destinationTypes', 'budgetMaxInr']);
  });

  it('accepts max equal to min and puts a reversed window on dateEnd', () => {
    expect(issuesOf({ ...valid, budgetMaxInr: 8000 })).toEqual([]);
    expect(issuesOf({ ...valid, dateEnd: '2026-11-12' })[0]?.path).toBe('dateEnd');
  });

  it('rejects an impossible or missing date', () => {
    expect(issuesOf({ ...valid, dateStart: '' })[0]).toEqual({
      path: 'dateStart',
      message: 'Choose the first day you could travel.',
    });
    expect(issuesOf({ ...valid, dateEnd: '2026-13-40' })[0]?.path).toBe('dateEnd');
  });
});
