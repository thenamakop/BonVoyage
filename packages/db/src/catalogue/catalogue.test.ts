import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkCatalogue, type CatalogueRows } from './checks';
import { loadCatalogue } from './load';
import { HEADERS, destinationRow, fareRow, hubRow, poiRow } from './schemas';

const TODAY = '2026-10-12';

const goodHub = {
  slug: 'gurugram',
  name: 'Gurugram',
  state: 'Haryana',
  lat: '28.4595',
  lng: '77.0266',
  source_url: 'https://en.wikipedia.org/wiki/Gurgaon',
  collected_on: '2026-10-12',
  review_status: 'draft',
};

const goodDestination = {
  slug: 'mussoorie',
  name: 'Mussoorie',
  state: 'Uttarakhand',
  lat: '30.4598',
  lng: '78.0644',
  types: 'hill_station',
  activities: 'trekking|shopping',
  climate: 'mild',
  best_months: '3|4|5|6|9|10',
  min_nights: '2',
  stay_budget_inr: '1200',
  stay_mid_inr: '2800',
  stay_premium_inr: '7000',
  food_per_day_inr: '600',
  local_per_day_inr: '400',
  source_url: 'https://en.wikipedia.org/wiki/Mussoorie',
  collected_on: '2026-10-12',
  review_status: 'draft',
  cost_source_url: '',
  cost_collected_on: '',
  cost_review_status: 'draft',
};

const goodFare = {
  origin_hub: 'gurugram',
  destination_slug: 'mussoorie',
  mode: 'car',
  fare_per_person_inr: '',
  duration_minutes: '330',
  distance_km: '290',
  source_url: '',
  collected_on: '2026-10-12',
  review_status: 'draft',
};

const goodPoi = {
  destination_slug: 'mussoorie',
  poi_key: 'gun-hill',
  name: 'Gun Hill',
  category: 'viewpoint',
  typical_minutes: '90',
  open_time: '10:00',
  close_time: '18:00',
  closed_days: '',
  entry_fee_inr: '0',
  lat: '30.4600',
  lng: '78.0600',
  source_url: '',
  collected_on: '2026-10-12',
  review_status: 'draft',
};

const issues = (result: {
  success: boolean;
  error?: { issues: { message: string; path: (string | number | symbol)[] }[] };
}) =>
  result.success
    ? []
    : (result.error?.issues ?? []).map((i) => `${String(i.path[0])}: ${i.message}`);

describe('row schemas', () => {
  it('accepts a good hub row', () => {
    expect(hubRow(TODAY).safeParse(goodHub).success).toBe(true);
  });

  it('accepts good destination, fare and POI rows', () => {
    expect(destinationRow(TODAY).safeParse(goodDestination).success).toBe(true);
    expect(fareRow(TODAY).safeParse(goodFare).success).toBe(true);
    expect(poiRow(TODAY).safeParse(goodPoi).success).toBe(true);
  });

  it('rejects a bad slug', () => {
    const r = hubRow(TODAY).safeParse({ ...goodHub, slug: 'Gurgaon!' });
    expect(issues(r).some((m) => m.startsWith('slug'))).toBe(true);
  });

  it('rejects coordinates outside India', () => {
    const r = hubRow(TODAY).safeParse({ ...goodHub, lat: '40.0' });
    expect(issues(r).some((m) => m.startsWith('lat'))).toBe(true);
  });

  it('rejects an unknown type or activity', () => {
    const r = destinationRow(TODAY).safeParse({ ...goodDestination, types: 'hill_station|island' });
    expect(issues(r).some((m) => m.startsWith('types'))).toBe(true);
    const a = destinationRow(TODAY).safeParse({ ...goodDestination, activities: 'sailing' });
    expect(issues(a).some((m) => m.startsWith('activities'))).toBe(true);
  });

  it('rejects empty and duplicate best_months', () => {
    expect(
      issues(destinationRow(TODAY).safeParse({ ...goodDestination, best_months: '' })).some((m) =>
        m.startsWith('best_months'),
      ),
    ).toBe(true);
    expect(
      issues(destinationRow(TODAY).safeParse({ ...goodDestination, best_months: '3|3' })).some(
        (m) => m.startsWith('best_months'),
      ),
    ).toBe(true);
  });

  it('bounds min_nights, typical_minutes, distance and duration', () => {
    expect(
      issues(destinationRow(TODAY).safeParse({ ...goodDestination, min_nights: '15' })).some((m) =>
        m.startsWith('min_nights'),
      ),
    ).toBe(true);
    expect(
      issues(poiRow(TODAY).safeParse({ ...goodPoi, typical_minutes: '5' })).some((m) =>
        m.startsWith('typical_minutes'),
      ),
    ).toBe(true);
    expect(
      issues(fareRow(TODAY).safeParse({ ...goodFare, distance_km: '4000' })).some((m) =>
        m.startsWith('distance_km'),
      ),
    ).toBe(true);
    expect(
      issues(fareRow(TODAY).safeParse({ ...goodFare, duration_minutes: '5' })).some((m) =>
        m.startsWith('duration_minutes'),
      ),
    ).toBe(true);
  });

  it('rejects a collected_on after today', () => {
    const r = hubRow(TODAY).safeParse({ ...goodHub, collected_on: '2999-01-01' });
    expect(issues(r).some((m) => m.startsWith('collected_on'))).toBe(true);
  });

  it('requires an https source_url for verified rows', () => {
    const noUrl = hubRow(TODAY).safeParse({
      ...goodHub,
      source_url: '',
      review_status: 'verified',
    });
    expect(issues(noUrl).some((m) => m.startsWith('source_url'))).toBe(true);
    const http = hubRow(TODAY).safeParse({
      ...goodHub,
      source_url: 'http://x.in',
      review_status: 'draft',
    });
    expect(issues(http).some((m) => m.startsWith('source_url'))).toBe(true);
    const ok = hubRow(TODAY).safeParse({ ...goodHub, review_status: 'verified' });
    expect(ok.success).toBe(true);
  });

  it('allows empty cost columns while draft but not once verified', () => {
    const draft = destinationRow(TODAY).safeParse({
      ...goodDestination,
      stay_budget_inr: '',
      stay_mid_inr: '',
      stay_premium_inr: '',
      food_per_day_inr: '',
      local_per_day_inr: '',
    });
    expect(draft.success).toBe(true);
    const verified = destinationRow(TODAY).safeParse({
      ...goodDestination,
      stay_budget_inr: '',
      cost_review_status: 'verified',
      cost_source_url: 'https://example.com/rates',
    });
    expect(issues(verified).some((m) => m.startsWith('stay_budget_inr'))).toBe(true);
  });

  it('requires cost_source_url for verified costs', () => {
    const r = destinationRow(TODAY).safeParse({
      ...goodDestination,
      cost_review_status: 'verified',
    });
    expect(issues(r).some((m) => m.startsWith('cost_source_url'))).toBe(true);
  });

  it('car rows never carry a fare; verified bus/train rows need one', () => {
    const carWithFare = fareRow(TODAY).safeParse({ ...goodFare, fare_per_person_inr: '500' });
    expect(issues(carWithFare).some((m) => m.startsWith('fare_per_person_inr'))).toBe(true);
    const busNoFare = fareRow(TODAY).safeParse({
      ...goodFare,
      mode: 'bus',
      review_status: 'verified',
      source_url: 'https://example.com/bus',
    });
    expect(issues(busNoFare).some((m) => m.startsWith('fare_per_person_inr'))).toBe(true);
    const busOk = fareRow(TODAY).safeParse({
      ...goodFare,
      mode: 'bus',
      fare_per_person_inr: '650',
      review_status: 'verified',
      source_url: 'https://example.com/bus',
    });
    expect(busOk.success).toBe(true);
  });
});

describe('checkCatalogue', () => {
  const base: CatalogueRows = {
    hubs: [
      hubRow(TODAY).parse(goodHub),
      hubRow(TODAY).parse({ ...goodHub, slug: 'delhi', name: 'Delhi' }),
    ],
    destinations: [destinationRow(TODAY).parse(goodDestination)],
    fares: [
      fareRow(TODAY).parse(goodFare),
      fareRow(TODAY).parse({ ...goodFare, origin_hub: 'delhi', distance_km: '280' }),
    ],
    pois: [poiRow(TODAY).parse(goodPoi)],
  };
  const at = (rows: CatalogueRows) =>
    checkCatalogue(rows).map((i) => `${i.severity}: ${i.message}`);

  it('fires no errors on good rows (warnings only)', () => {
    const messages = at(base);
    expect(messages.every((m) => !m.startsWith('error'))).toBe(true);
    // warnings: only 1 POI, hill_station count 1
    expect(messages.some((m) => m.includes('fewer than 6 POIs'))).toBe(true);
    expect(messages.some((m) => m.includes('"hill_station"'))).toBe(true);
    expect(messages.some((m) => m.startsWith('info: no beach'))).toBe(true);
  });

  it('flags duplicate slugs, poi_keys and fare keys', () => {
    const rows: CatalogueRows = {
      ...base,
      hubs: [...base.hubs, base.hubs[0]!],
      destinations: [...base.destinations, base.destinations[0]!],
      fares: [...base.fares, base.fares[0]!],
      pois: [...base.pois, base.pois[0]!],
    };
    const messages = at(rows);
    expect(messages.some((m) => m.includes('duplicate hub slug'))).toBe(true);
    expect(messages.some((m) => m.includes('duplicate destination slug'))).toBe(true);
    expect(messages.some((m) => m.includes('duplicate fare'))).toBe(true);
    expect(messages.some((m) => m.includes('duplicate poi_key'))).toBe(true);
  });

  it('flags unknown references', () => {
    const rows: CatalogueRows = {
      ...base,
      fares: [
        fareRow(TODAY).parse({ ...goodFare, origin_hub: 'nowhere', destination_slug: 'nope' }),
      ],
      pois: [poiRow(TODAY).parse({ ...goodPoi, destination_slug: 'nope' })],
    };
    const messages = at(rows);
    expect(messages.some((m) => m.includes('unknown hub'))).toBe(true);
    expect(messages.some((m) => m.includes('unknown destination'))).toBe(true);
  });

  it('flags stay tiers out of order', () => {
    const bad = destinationRow(TODAY).parse({ ...goodDestination, stay_mid_inr: '100' });
    expect(at({ ...base, destinations: [bad] }).some((m) => m.includes('out of order'))).toBe(true);
  });

  it('flags one-sided or backwards opening hours', () => {
    const oneSided = poiRow(TODAY).parse({ ...goodPoi, close_time: '' });
    const backwards = poiRow(TODAY).parse({ ...goodPoi, open_time: '18:00', close_time: '10:00' });
    expect(at({ ...base, pois: [oneSided] }).some((m) => m.includes('only one of open_time'))).toBe(
      true,
    );
    expect(at({ ...base, pois: [backwards] }).some((m) => m.includes('not after open_time'))).toBe(
      true,
    );
  });

  it('flags impossible and suspicious car distances', () => {
    const tooShort = fareRow(TODAY).parse({ ...goodFare, distance_km: '50' });
    const tooLong = fareRow(TODAY).parse({ ...goodFare, distance_km: '3000' });
    const rows: CatalogueRows = {
      ...base,
      fares: [tooShort, { ...tooLong, origin_hub: 'delhi' }],
    };
    const messages = at(rows);
    expect(messages.some((m) => m.includes('shorter than the straight-line'))).toBe(true);
    expect(messages.some((m) => m.includes('more than twice the straight-line'))).toBe(true);
  });

  it('warns when a destination exceeds the 800 km scope', () => {
    const far = destinationRow(TODAY).parse({
      ...goodDestination,
      slug: 'kanyakumari',
      lat: '8.08',
      lng: '77.55',
    });
    expect(at({ ...base, destinations: [far] }).some((m) => m.includes('more than 800 km'))).toBe(
      true,
    );
  });

  it('warns when a destination lacks a car row from a required hub', () => {
    const rows: CatalogueRows = { ...base, fares: [base.fares[0]!] };
    expect(at(rows).some((m) => m.includes('no car row from delhi'))).toBe(true);
  });
});

describe('loadCatalogue', () => {
  const files = {
    'hubs.csv': `${HEADERS.hubs}\n`,
    'destinations.csv': `${HEADERS.destinations}\n`,
    'fares.csv': `${HEADERS.fares}\n`,
    'pois.csv': `${HEADERS.pois}\n`,
    'cost-rules.json': JSON.stringify({
      fuel_price_inr_per_litre: {
        value: 95,
        unit: 'INR/litre',
        source_url: '',
        collected_on: TODAY,
        review_status: 'draft',
      },
      car_km_per_litre: {
        value: 15,
        unit: 'km/litre',
        source_url: '',
        collected_on: TODAY,
        review_status: 'draft',
      },
      toll_inr_per_km: {
        value: 1.6,
        unit: 'INR/km',
        source_url: '',
        collected_on: TODAY,
        review_status: 'draft',
      },
      persons_per_car: {
        value: 4,
        unit: 'persons',
        source_url: '',
        collected_on: TODAY,
        review_status: 'draft',
      },
      car_rental_inr_per_day: {
        value: 2500,
        unit: 'INR/day',
        source_url: '',
        collected_on: TODAY,
        review_status: 'draft',
      },
    }),
  };

  const makeDir = (overrides: Record<string, string> = {}) => {
    const dir = mkdtempSync(join(tmpdir(), 'bv-catalogue-'));
    for (const [name, text] of Object.entries({ ...files, ...overrides })) {
      writeFileSync(join(dir, name), text);
    }
    return dir;
  };

  it('rejects a wrong header and reports line 1', () => {
    const dir = makeDir({ 'hubs.csv': 'slug,name\n' });
    const { issues: found } = loadCatalogue(dir, { today: TODAY });
    expect(found.some((i) => i.file === 'hubs.csv' && i.line === 1 && i.severity === 'error')).toBe(
      true,
    );
  });

  it('reports the 1-based line of a bad row', () => {
    const dir = makeDir({
      'hubs.csv': `${HEADERS.hubs}\ngurugram,Gurugram,Haryana,28.46,77.03,,2026-10-12,draft\nbad!slug,Delhi,Delhi,28.6,77.2,,2026-10-12,draft\n`,
    });
    const { issues: found } = loadCatalogue(dir, { today: TODAY });
    expect(found.some((i) => i.file === 'hubs.csv' && i.line === 3 && i.column === 'slug')).toBe(
      true,
    );
  });
});
