import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

// S5-5 (#140): the offline harness reads the real catalogue through this subpath, with no
// database. Importing pg or drizzle-orm from here fails the test, so the subpath stays
// free of the client that the package's root entry brings in.
vi.mock('pg', () => {
  throw new Error('pg was imported');
});
vi.mock('drizzle-orm', () => {
  throw new Error('drizzle-orm was imported');
});

const DIR = resolve(import.meta.dirname, '../../catalogue');
const TODAY = '2026-12-31';

describe('@bonvoyage/db/catalogue', () => {
  it('loads the real catalogue with no errors, and without pg or drizzle-orm', async () => {
    const { loadCatalogue } = await import('@bonvoyage/db/catalogue');
    const { hubs, destinations, fares, pois, costRules, issues } = loadCatalogue(DIR, {
      today: TODAY,
    });
    expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(hubs.map((hub) => hub.slug)).toEqual(expect.arrayContaining(['gurugram', 'delhi']));
    expect(destinations.length).toBeGreaterThan(0);
    expect(fares.some((fare) => fare.mode === 'car')).toBe(true);
    expect(pois.length).toBeGreaterThan(0);
    expect(costRules).toBeDefined();
  });

  it('the root entry does need them, so the check above can fail', async () => {
    await expect(import('@bonvoyage/db')).rejects.toThrow();
  });
});
