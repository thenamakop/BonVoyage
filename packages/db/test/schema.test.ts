import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { createDb } from '../src/client';
import * as s from '../src/schema';
import { user } from '../src/schema/auth';

// S0-5: cascade and CHECK behaviour on the test database. User rows are
// inserted directly (auth round trip is covered in the API tests).

const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const uid = (n: string) => `test-user-${n}`;

async function expectSqlState(promise: Promise<unknown>, state: string): Promise<void> {
  await expect(promise).rejects.toMatchObject({ cause: { code: state } });
}

async function seedChain(): Promise<{ tripId: string }> {
  await db.insert(user).values([
    { id: uid('a'), name: 'A', email: 'a@test.bv' },
    { id: uid('b'), name: 'B', email: 'b@test.bv' },
  ]);
  const [h] = await db
    .insert(s.hub)
    .values({
      slug: 'testhub',
      name: 'Hub',
      state: 'S',
      lat: 28,
      lng: 77,
      collectedOn: '2026-10-12',
      reviewStatus: 'draft',
    })
    .returning({ id: s.hub.id });
  const [d] = await db
    .insert(s.destination)
    .values({
      slug: 'testdest',
      name: 'Dest',
      state: 'S',
      lat: 29,
      lng: 78,
      types: ['heritage'],
      activities: ['museums'],
      climate: 'mild',
      bestMonths: [10],
      minNights: 1,
      collectedOn: '2026-10-12',
      reviewStatus: 'draft',
      costReviewStatus: 'draft',
    })
    .returning({ id: s.destination.id });
  await db.insert(s.poi).values({
    destinationId: d!.id,
    poiKey: 'p1',
    name: 'P',
    category: 'sight',
    typicalMinutes: 60,
    entryFeeInr: 0,
    lat: 29,
    lng: 78,
    collectedOn: '2026-10-12',
    reviewStatus: 'draft',
  });
  const [t] = await db
    .insert(s.trip)
    .values({
      title: 'T',
      organiserId: uid('a'),
      originHubId: h!.id,
      durationNights: 2,
      budgetTotalInr: 10000,
      radiusKm: 400,
    })
    .returning({ id: s.trip.id });
  const tripId = t!.id;
  const [m1] = await db
    .insert(s.tripMember)
    .values({ tripId, userId: uid('a'), role: 'organiser' })
    .returning({ id: s.tripMember.id });
  await db.insert(s.tripMember).values({ tripId, userId: uid('b'), role: 'member' });
  await db.insert(s.preference).values({
    tripMemberId: m1!.id,
    destinationTypes: ['heritage'],
    activities: ['museums'],
    climate: 'any',
    travelStyle: 'budget',
    budgetMinInr: 100,
    budgetMaxInr: 1000,
    dateStart: '2026-11-01',
    dateEnd: '2026-11-05',
  });
  await db.insert(s.invitation).values({
    tripId,
    token: 'tok-' + tripId.slice(0, 8),
    createdBy: uid('a'),
    expiresAt: new Date(Date.now() + 86_400_000),
  });
  await db.insert(s.tripTransition).values({
    tripId,
    transitionId: 'T1',
    event: 'createTrip',
    toStatus: 'draft',
    actorUserId: uid('a'),
  });
  const [run] = await db
    .insert(s.recommendationRun)
    .values({ tripId, kind: 'shortlist', alpha: 0.5, beta: 0.3, gamma: 0.2, feasibleCount: 3 })
    .returning({ id: s.recommendationRun.id });
  await db.insert(s.recommendationItem).values({
    runId: run!.id,
    destinationId: d!.id,
    rank: 1,
    gfs: 0.5,
    mean: 0.5,
    min: 0.5,
    sd: 0,
    estimatedCostInr: 1000,
    distanceKm: 100,
    distanceProvenance: 'estimated',
  });
  const [pkg] = await db
    .insert(s.tripPackage)
    .values({
      tripId,
      destinationId: d!.id,
      transportMode: 'car',
      stayTier: 'budget',
      rooms: 1,
      startDate: '2026-11-01',
      endDate: '2026-11-03',
      totalInr: 1000,
      perPersonInr: 500,
    })
    .returning({ id: s.tripPackage.id });
  await db.insert(s.costItem).values({
    packageId: pkg!.id,
    category: 'stay',
    label: 'hotel',
    amountInr: 500,
    provenance: 'curated',
  });
  await db
    .insert(s.packageDecision)
    .values({ packageId: pkg!.id, userId: uid('a'), decision: 'accept' });
  const [itin] = await db
    .insert(s.itinerary)
    .values({ packageId: pkg!.id, version: 1 })
    .returning({ id: s.itinerary.id });
  await db.insert(s.itineraryItem).values({
    itineraryId: itin!.id,
    dayNumber: 1,
    position: 1,
    kind: 'free',
  });
  await db
    .insert(s.itineraryDecision)
    .values({ itineraryId: itin!.id, userId: uid('a'), decision: 'accept' });
  await db.insert(s.notification).values({ userId: uid('a'), tripId, type: 'test' });
  return { tripId };
}

afterAll(async () => {
  await pool.end();
});

describe('schema', () => {
  it('deleting a trip cascades to every dependent table', async () => {
    const { tripId } = await seedChain();
    await db.delete(s.trip).where(sql`${s.trip.id} = ${tripId}`);
    const direct = [
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(s.tripMember)
        .where(sql`${s.tripMember.tripId} = ${tripId}`),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(s.invitation)
        .where(sql`${s.invitation.tripId} = ${tripId}`),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(s.tripTransition)
        .where(sql`${s.tripTransition.tripId} = ${tripId}`),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(s.recommendationRun)
        .where(sql`${s.recommendationRun.tripId} = ${tripId}`),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(s.tripPackage)
        .where(sql`${s.tripPackage.tripId} = ${tripId}`),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(s.notification)
        .where(sql`${s.notification.tripId} = ${tripId}`),
    ];
    for (const rows of await Promise.all(direct)) expect(rows[0]!.n).toBe(0);
    // Through-chains: rows whose only link to the trip was a cascading parent.
    const items = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.recommendationItem)
      .where(
        sql`not exists (select 1 from recommendation_run r where r.id = ${s.recommendationItem.runId})`,
      );
    expect(items[0]!.n).toBe(0);
    const prefs = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.preference)
      .where(
        sql`not exists (select 1 from trip_member m where m.id = ${s.preference.tripMemberId})`,
      );
    expect(prefs[0]!.n).toBe(0);
    const leftovers = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.itineraryItem)
      .where(
        sql`not exists (select 1 from itinerary i where i.id = ${s.itineraryItem.itineraryId})`,
      );
    expect(leftovers[0]!.n).toBe(0);
    const decisions = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.itineraryDecision)
      .where(
        sql`not exists (select 1 from itinerary i where i.id = ${s.itineraryDecision.itineraryId})`,
      );
    expect(decisions[0]!.n).toBe(0);
  });

  it('rejects CHECK violations with SQLSTATE 23514', async () => {
    const [h] = await db
      .insert(s.hub)
      .values({
        slug: 'checkhub',
        name: 'H',
        state: 'S',
        lat: 28,
        lng: 77,
        collectedOn: '2026-10-12',
        reviewStatus: 'draft',
      })
      .returning({ id: s.hub.id });
    const [d] = await db
      .insert(s.destination)
      .values({
        slug: 'checkdest',
        name: 'D',
        state: 'S',
        lat: 29,
        lng: 78,
        types: ['city'],
        activities: ['museums'],
        climate: 'warm',
        bestMonths: [1],
        minNights: 1,
        collectedOn: '2026-10-12',
        reviewStatus: 'draft',
        costReviewStatus: 'draft',
      })
      .returning({ id: s.destination.id });
    await db.insert(user).values({ id: uid('c'), name: 'C', email: 'c@test.bv' });
    const [t] = await db
      .insert(s.trip)
      .values({
        title: 'T',
        organiserId: uid('c'),
        originHubId: h!.id,
        durationNights: 1,
        budgetTotalInr: 100,
        radiusKm: 10,
      })
      .returning({ id: s.trip.id });
    const [m] = await db
      .insert(s.tripMember)
      .values({ tripId: t!.id, userId: uid('c'), role: 'organiser' })
      .returning({ id: s.tripMember.id });

    await expectSqlState(
      db.insert(s.preference).values({
        tripMemberId: m!.id,
        destinationTypes: ['city'],
        activities: ['museums'],
        climate: 'any',
        travelStyle: 'budget',
        budgetMinInr: 500,
        budgetMaxInr: 100,
        dateStart: '2026-11-01',
        dateEnd: '2026-11-02',
      }),
      '23514',
    );
    await expectSqlState(
      db.insert(s.pastTrip).values({ userId: uid('c'), placeName: 'X', rating: 6 }),
      '23514',
    );
    await expectSqlState(
      db.insert(s.trip).values({
        title: 'T2',
        organiserId: uid('c'),
        originHubId: h!.id,
        durationNights: 0,
        budgetTotalInr: 100,
        radiusKm: 10,
      }),
      '23514',
    );
    await expectSqlState(
      db.insert(s.poi).values({
        destinationId: d!.id,
        poiKey: 'bad-hours',
        name: 'X',
        category: 'sight',
        typicalMinutes: 30,
        openTime: '18:00',
        closeTime: '10:00',
        entryFeeInr: 0,
        lat: 29,
        lng: 78,
        collectedOn: '2026-10-12',
        reviewStatus: 'draft',
      }),
      '23514',
    );
  });

  it('rejects a second organiser on one trip with SQLSTATE 23505', async () => {
    const [h] = await db
      .insert(s.hub)
      .values({
        slug: 'orghub',
        name: 'H',
        state: 'S',
        lat: 28,
        lng: 77,
        collectedOn: '2026-10-12',
        reviewStatus: 'draft',
      })
      .returning({ id: s.hub.id });
    await db.insert(user).values([
      { id: uid('d'), name: 'D', email: 'd@test.bv' },
      { id: uid('e'), name: 'E', email: 'e@test.bv' },
    ]);
    const [t] = await db
      .insert(s.trip)
      .values({
        title: 'T',
        organiserId: uid('d'),
        originHubId: h!.id,
        durationNights: 1,
        budgetTotalInr: 100,
        radiusKm: 10,
      })
      .returning({ id: s.trip.id });
    await db.insert(s.tripMember).values({ tripId: t!.id, userId: uid('d'), role: 'organiser' });
    await expectSqlState(
      db.insert(s.tripMember).values({ tripId: t!.id, userId: uid('e'), role: 'organiser' }),
      '23505',
    );
  });
});
