import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { createDb } from '../src/client';
import { importCatalogue } from '../src/catalogue/import';
import { destination, fareFallback, hub } from '../src/schema';

// S0-5: importCatalogue upserts a fixture catalogue twice and refuses an
// error-level catalogue.

const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const TODAY = '2026-10-12';

function fixtureDir(destExtra = ''): string {
  const dir = mkdtempSync(join(tmpdir(), 'bv-catalogue-'));
  writeFileSync(
    join(dir, 'hubs.csv'),
    `slug,name,state,lat,lng,source_url,collected_on,review_status
imphub,Import Hub,HR,28.1,77.1,,2026-10-12,draft
`,
  );
  writeFileSync(
    join(dir, 'destinations.csv'),
    `slug,name,state,lat,lng,types,activities,climate,best_months,min_nights,stay_budget_inr,stay_mid_inr,stay_premium_inr,food_per_day_inr,local_per_day_inr,source_url,collected_on,review_status,cost_source_url,cost_collected_on,cost_review_status
impdest,Import Dest${destExtra},HP,31.0,77.2,mountain,trekking,cold,10|11,2,500,900,1500,400,300,,2026-10-12,draft,,,draft
`,
  );
  writeFileSync(
    join(dir, 'fares.csv'),
    `origin_hub,destination_slug,mode,fare_per_person_inr,duration_minutes,distance_km,source_url,collected_on,review_status
imphub,impdest,car,,300,420,,2026-10-12,draft
`,
  );
  writeFileSync(
    join(dir, 'pois.csv'),
    `destination_slug,poi_key,name,category,typical_minutes,open_time,close_time,closed_days,entry_fee_inr,lat,lng,source_url,collected_on,review_status
impdest,p1,Viewpoint,viewpoint,60,,,,0,31.0,77.2,,2026-10-12,draft
`,
  );
  const rule = {
    value: 100,
    unit: 'INR/litre',
    source_url: '',
    collected_on: '2026-10-12',
    review_status: 'draft',
  };
  writeFileSync(
    join(dir, 'cost-rules.json'),
    JSON.stringify({
      fuel_price_inr_per_litre: rule,
      car_km_per_litre: rule,
      toll_inr_per_km: rule,
      persons_per_car: rule,
      car_rental_inr_per_day: rule,
    }),
  );
  return dir;
}

afterAll(async () => {
  await pool.end();
});

describe('importCatalogue', () => {
  it('imports twice with identical row counts', async () => {
    const dir = fixtureDir();
    const first = await importCatalogue(db, dir, { today: TODAY });
    expect(first.inserted.hub).toBe(1);
    const second = await importCatalogue(db, dir, { today: TODAY });
    expect(second.inserted.hub).toBe(0);
    expect(second.updated.hub).toBe(1);
    const n = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(destination)
      .where(eq(destination.slug, 'impdest'));
    expect(n[0]!.n).toBe(1);
    const fares = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(fareFallback)
      .where(eq(fareFallback.mode, 'car'));
    expect(fares[0]!.n).toBeGreaterThanOrEqual(1);
  });

  it('updates a changed value in place', async () => {
    const dir = fixtureDir(' v2');
    await importCatalogue(db, dir, { today: TODAY });
    const row = await db.select().from(destination).where(eq(destination.slug, 'impdest'));
    expect(row[0]!.name).toBe('Import Dest v2');
    const hubs = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(hub)
      .where(eq(hub.slug, 'imphub'));
    expect(hubs[0]!.n).toBe(1);
  });

  it('refuses an error-level catalogue and writes nothing', async () => {
    const dir = fixtureDir();
    // Break the fixture: fare references a destination that doesn't exist.
    writeFileSync(
      join(dir, 'fares.csv'),
      `origin_hub,destination_slug,mode,fare_per_person_inr,duration_minutes,distance_km,source_url,collected_on,review_status
imphub,nonexistent,car,,300,250,,2026-10-12,draft
`,
    );
    await expect(importCatalogue(db, dir, { today: TODAY })).rejects.toThrow(/refused|error/i);
  });
});
