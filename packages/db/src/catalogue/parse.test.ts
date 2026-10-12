import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadCatalogue, parseCatalogue, type CatalogueFiles } from './load';
import { HEADERS } from './schemas';

// S1-7: parseCatalogue takes the five files as strings (the administrator
// page uploads them), and loadCatalogue is now a thin file-reading wrapper.

const TODAY = '2026-10-12';
const DIR = resolve(import.meta.dirname, '../../catalogue');

const RULE = (value: number, unit: string) => ({
  value,
  unit,
  source_url: '',
  collected_on: TODAY,
  review_status: 'draft',
});
const COST_RULES = JSON.stringify({
  fuel_price_inr_per_litre: RULE(95, 'INR/litre'),
  car_km_per_litre: RULE(15, 'km/litre'),
  toll_inr_per_km: RULE(1.6, 'INR/km'),
  persons_per_car: RULE(4, 'persons'),
  car_rental_inr_per_day: RULE(2500, 'INR/day'),
});

const files = (overrides: Partial<CatalogueFiles> = {}): CatalogueFiles => ({
  hubs: `${HEADERS.hubs}\ngurugram,Gurugram,Haryana,28.46,77.03,,${TODAY},draft\n`,
  destinations: `${HEADERS.destinations}\n`,
  fares: `${HEADERS.fares}\n`,
  pois: `${HEADERS.pois}\n`,
  costRules: COST_RULES,
  ...overrides,
});

const errors = (f: CatalogueFiles) =>
  parseCatalogue(f, { today: TODAY }).issues.filter((i) => i.severity === 'error');

describe('parseCatalogue', () => {
  it('parses good inline files with no errors', () => {
    const parsed = parseCatalogue(files(), { today: TODAY });
    expect(parsed.hubs.map((h) => h.slug)).toEqual(['gurugram']);
    expect(Object.keys(parsed.costRules ?? {})).toHaveLength(5);
    expect(parsed.issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('reports a wrong header on line 1', () => {
    expect(errors(files({ destinations: 'slug,name\n' }))).toEqual([
      expect.objectContaining({ file: 'destinations.csv', line: 1, severity: 'error' }),
    ]);
  });

  it('reports a bad row with its 1-based line and column', () => {
    const hubs = `${HEADERS.hubs}\ngurugram,Gurugram,Haryana,28.46,77.03,,${TODAY},draft\ndelhi,Delhi,Delhi,99.9,77.2,,${TODAY},draft\n`;
    expect(errors(files({ hubs }))).toEqual([
      expect.objectContaining({ file: 'hubs.csv', line: 3, column: 'lat' }),
    ]);
  });

  it('reports a missing file and invalid JSON as errors', () => {
    expect(errors(files({ pois: undefined }))).toEqual([
      { file: 'pois.csv', severity: 'error', message: 'file not found or unreadable' },
    ]);
    expect(errors(files({ costRules: '{not json' }))[0]).toMatchObject({
      file: 'cost-rules.json',
      severity: 'error',
    });
  });

  it('gives exactly what loadCatalogue gives for the real catalogue directory', () => {
    const read = (f: string) => readFileSync(resolve(DIR, f), 'utf8');
    const fromStrings = parseCatalogue(
      {
        hubs: read('hubs.csv'),
        destinations: read('destinations.csv'),
        fares: read('fares.csv'),
        pois: read('pois.csv'),
        costRules: read('cost-rules.json'),
      },
      { today: TODAY },
    );
    expect(fromStrings).toEqual(loadCatalogue(DIR, { today: TODAY }));
  });
});
