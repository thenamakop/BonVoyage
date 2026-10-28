import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { createDb } from '../src/client';
import { importCatalogue } from '../src/catalogue/import';
import {
  destination,
  fareFallback,
  hub,
  itinerary,
  itineraryItem,
  poi,
  trip,
  tripPackage,
} from '../src/schema';
import { user } from '../src/schema/auth';

// S0-5: importCatalogue upserts a fixture catalogue twice and refuses an
// error-level catalogue. S3-8: --prune deletes places of interest that left
// pois.csv; S4-8 (#126): and fares that left fares.csv, nothing else.
// The fixtures sit in the Nicobar Islands (8.0, 93.5), out of every trip's
// radius: the test database is shared across files, and a perfect "mountain,
// trekking" place within reach of Gurugram with no Gurugram fares would top
// another file's shortlist and give it a car leg with no time.

const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const TODAY = '2026-10-12';

const POI_HEADER =
  'destination_slug,poi_key,name,category,typical_minutes,open_time,close_time,closed_days,entry_fee_inr,lat,lng,source_url,collected_on,review_status';
const poiRow = (dest: string, key: string, name: string) =>
  `${dest},${key},${name},viewpoint,60,,,,0,8.0,93.5,,2026-10-12,draft`;

const FARE_HEADER =
  'origin_hub,destination_slug,mode,fare_per_person_inr,duration_minutes,distance_km,source_url,collected_on,review_status';
const fareRow = (hubSlug: string, dest: string, mode: string, status = 'draft') =>
  mode === 'car'
    ? `${hubSlug},${dest},car,,300,420,,2026-10-12,${status}`
    : `${hubSlug},${dest},${mode},250,330,410,,2026-10-12,${status}`;

function fixtureDir(
  destExtra = '',
  {
    extraDestinations = '',
    extraHubs = '',
    pois = [poiRow('impdest', 'p1', 'Viewpoint')],
    fares = [fareRow('imphub', 'impdest', 'car')],
  }: { extraDestinations?: string; extraHubs?: string; pois?: string[]; fares?: string[] } = {},
): string {
  const dir = mkdtempSync(join(tmpdir(), 'bv-catalogue-'));
  writeFileSync(
    join(dir, 'hubs.csv'),
    `slug,name,state,lat,lng,source_url,collected_on,review_status
imphub,Import Hub,AN,8.2,93.3,,2026-10-12,draft
${extraHubs}`,
  );
  writeFileSync(
    join(dir, 'destinations.csv'),
    `slug,name,state,lat,lng,types,activities,climate,best_months,min_nights,stay_budget_inr,stay_mid_inr,stay_premium_inr,food_per_day_inr,local_per_day_inr,source_url,collected_on,review_status,cost_source_url,cost_collected_on,cost_review_status
impdest,Import Dest${destExtra},AN,8.0,93.5,mountain,trekking,cold,10|11,2,500,900,1500,400,300,,2026-10-12,draft,,,draft
${extraDestinations}`,
  );
  writeFileSync(join(dir, 'fares.csv'), `${[FARE_HEADER, ...fares].join('\n')}\n`);
  writeFileSync(join(dir, 'pois.csv'), `${[POI_HEADER, ...pois].join('\n')}\n`);
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

describe('importCatalogue with prune', () => {
  const OTHER_DEST =
    'pruneother,Prune Other,AN,8.0,93.5,mountain,trekking,cold,10|11,2,500,900,1500,400,300,,2026-10-12,draft,,,draft\n';
  const poisOf = async (slug: string) =>
    (
      await db
        .select({ key: poi.poiKey })
        .from(poi)
        .innerJoin(destination, eq(destination.id, poi.destinationId))
        .where(eq(destination.slug, slug))
        .orderBy(poi.poiKey)
    ).map((r) => r.key);

  it('without prune, a place that left pois.csv stays; with prune it is listed and deleted', async () => {
    await importCatalogue(
      db,
      fixtureDir('', {
        pois: [
          poiRow('impdest', 'p1', 'Viewpoint'),
          poiRow('impdest', 'stale-a', 'Old garden'),
          poiRow('impdest', 'stale-b', 'Old ashram'),
        ],
      }),
      { today: TODAY },
    );
    const trimmed = fixtureDir();

    const kept = await importCatalogue(db, trimmed, { today: TODAY });
    expect(kept.pruned).toEqual([]);
    expect(await poisOf('impdest')).toEqual(['p1', 'stale-a', 'stale-b']);

    const pruned = await importCatalogue(db, trimmed, { today: TODAY, prune: true });
    expect(pruned.pruned).toEqual([
      { destinationSlug: 'impdest', poiKey: 'stale-a', name: 'Old garden' },
      { destinationSlug: 'impdest', poiKey: 'stale-b', name: 'Old ashram' },
    ]);
    expect(await poisOf('impdest')).toEqual(['p1']);
    // The upsert still ran in the same import.
    expect(pruned.updated.poi).toBe(1);

    const again = await importCatalogue(db, trimmed, { today: TODAY, prune: true });
    expect(again.pruned).toEqual([]);
  });

  it("leaves a destination's places alone when the destination is not in the files", async () => {
    await importCatalogue(
      db,
      fixtureDir('', {
        extraDestinations: OTHER_DEST,
        pois: [poiRow('impdest', 'p1', 'Viewpoint'), poiRow('pruneother', 'q1', 'Other view')],
      }),
      { today: TODAY },
    );
    const res = await importCatalogue(db, fixtureDir(), { today: TODAY, prune: true });
    expect(res.pruned).toEqual([]);
    expect(await poisOf('pruneother')).toEqual(['q1']);
    // Destinations are never pruned either.
    expect(
      await db.select().from(destination).where(eq(destination.slug, 'pruneother')),
    ).toHaveLength(1);
  });

  it('a day-plan item that pointed at a pruned place keeps its text, with no place', async () => {
    await importCatalogue(
      db,
      fixtureDir('', {
        pois: [poiRow('impdest', 'p1', 'Viewpoint'), poiRow('impdest', 'gone', 'Gone falls')],
      }),
      { today: TODAY },
    );
    const [dest] = await db.select().from(destination).where(eq(destination.slug, 'impdest'));
    const [origin] = await db.select().from(hub).where(eq(hub.slug, 'imphub'));
    const [gone] = await db
      .select()
      .from(poi)
      .where(and(eq(poi.destinationId, dest!.id), eq(poi.poiKey, 'gone')));
    const userId = `prune-user-${Date.now()}`;
    await db.insert(user).values({ id: userId, name: 'Prune', email: `${userId}@test.bv` });
    const [t] = await db
      .insert(trip)
      .values({
        title: 'Prune trip',
        organiserId: userId,
        originHubId: origin!.id,
        durationNights: 2,
        budgetTotalInr: 30000,
        radiusKm: 450,
      })
      .returning();
    const [pkg] = await db
      .insert(tripPackage)
      .values({
        tripId: t!.id,
        destinationId: dest!.id,
        transportMode: 'car',
        stayTier: 'budget',
        rooms: 1,
        startDate: '2026-11-20',
        endDate: '2026-11-22',
        totalInr: 20000,
        perPersonInr: 10000,
      })
      .returning();
    const [plan] = await db
      .insert(itinerary)
      .values({ packageId: pkg!.id, version: 1 })
      .returning();
    const [item] = await db
      .insert(itineraryItem)
      .values({
        itineraryId: plan!.id,
        dayNumber: 2,
        position: 0,
        kind: 'activity',
        poiId: gone!.id,
        note: 'Visit Gone falls (nature). Entry ₹0 per person.',
      })
      .returning();

    try {
      const res = await importCatalogue(db, fixtureDir(), { today: TODAY, prune: true });
      expect(res.pruned.map((p) => p.poiKey)).toEqual(['gone']);
      const [after] = await db.select().from(itineraryItem).where(eq(itineraryItem.id, item!.id));
      expect(after).toMatchObject({
        poiId: null,
        note: 'Visit Gone falls (nature). Entry ₹0 per person.',
        kind: 'activity',
      });
    } finally {
      // Cascades to the package, the day plan and its item.
      await db.delete(user).where(inArray(user.id, [userId]));
    }
  });
});

// S4-8 batch 1 (#126): --prune also deletes fares that left fares.csv, but only
// for a hub and a destination the files list; a dry run lists and keeps them.
describe('importCatalogue with prune: fares', () => {
  const OTHER_HUB = 'othhub,Other Hub,AN,8.4,93.4,,2026-10-12,draft\n';
  const OTHER_DEST =
    'fareother,Fare Other,AN,8.0,93.5,mountain,trekking,cold,10|11,2,500,900,1500,400,300,,2026-10-12,draft,,,draft\n';
  const modesOf = async (hubSlug: string, destSlug: string) =>
    (
      await db
        .select({ mode: fareFallback.mode })
        .from(fareFallback)
        .innerJoin(hub, eq(hub.id, fareFallback.originHubId))
        .innerJoin(destination, eq(destination.id, fareFallback.destinationId))
        .where(and(eq(hub.slug, hubSlug), eq(destination.slug, destSlug)))
    )
      .map((r) => r.mode)
      // mode is a Postgres enum, ordered by declaration, so sort by name here.
      .sort();
  const withTrain = () =>
    fixtureDir('', {
      fares: [fareRow('imphub', 'impdest', 'car'), fareRow('imphub', 'impdest', 'train')],
    });

  it('a fare that left fares.csv survives without prune and is listed and deleted with it', async () => {
    await importCatalogue(db, withTrain(), { today: TODAY });
    const trimmed = fixtureDir();

    const kept = await importCatalogue(db, trimmed, { today: TODAY });
    expect(kept.prunedFares).toEqual([]);
    expect(await modesOf('imphub', 'impdest')).toEqual(['car', 'train']);

    const pruned = await importCatalogue(db, trimmed, { today: TODAY, prune: true });
    expect(pruned.prunedFares).toEqual([
      { hubSlug: 'imphub', destinationSlug: 'impdest', mode: 'train', reviewStatus: 'draft' },
    ]);
    expect(await modesOf('imphub', 'impdest')).toEqual(['car']);
    // The upsert still ran in the same import.
    expect(pruned.updated.fare_fallback).toBe(1);
  });

  it('never touches a fare whose hub or destination the files do not list', async () => {
    await importCatalogue(
      db,
      fixtureDir('', {
        extraHubs: OTHER_HUB,
        extraDestinations: OTHER_DEST,
        fares: [
          fareRow('imphub', 'impdest', 'car'),
          fareRow('othhub', 'impdest', 'bus'),
          fareRow('imphub', 'fareother', 'bus'),
        ],
      }),
      { today: TODAY },
    );
    // These files list neither othhub nor fareother.
    const res = await importCatalogue(db, fixtureDir(), { today: TODAY, prune: true });
    expect(res.prunedFares).toEqual([]);
    expect(await modesOf('othhub', 'impdest')).toEqual(['bus']);
    expect(await modesOf('imphub', 'fareother')).toEqual(['bus']);
  });

  it('a dry run lists the fare and deletes nothing', async () => {
    await importCatalogue(db, withTrain(), { today: TODAY });
    const dry = await importCatalogue(db, fixtureDir(), {
      today: TODAY,
      prune: true,
      dryRun: true,
    });
    expect(dry.prunedFares).toEqual([
      { hubSlug: 'imphub', destinationSlug: 'impdest', mode: 'train', reviewStatus: 'draft' },
    ]);
    expect(await modesOf('imphub', 'impdest')).toEqual(['car', 'train']);
  });
});
