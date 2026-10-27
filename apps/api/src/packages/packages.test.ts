import { createDb } from '@bonvoyage/db';
import { costItem, fareFallback, poi, tripPackage } from '@bonvoyage/db/schema';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import {
  InvitationResponse,
  PackagesResponse,
  type ErrorEnvelope,
  type PreferenceInput,
} from '@bonvoyage/shared';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { createAuth } from '../auth/auth';
import {
  createTestUser,
  createTripAs,
  ensureCostRules,
  ensureDestination,
  ensureHubAt,
} from '../test/helpers';

// S3-3: migration 0002 and the packages API (T9 to T11, I3, I4), against a
// small fixture catalogue around a hub far from the real one.

const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const auth = createAuth({
  db,
  secret: 'test-secret-test-secret-test-secret',
  baseURL: { allowedHosts: ['localhost:5173', 'localhost:4000', '*.vercel.app'] },
});
const app = createApp({
  db,
  pool,
  logger: pino({ level: 'silent' }),
  auth,
  clock: () => new Date('2026-11-01T06:30:00Z'),
  scoringWeights: { alpha: 0.5, beta: 0.3, gamma: 0.2 },
});
const H = { Host: 'localhost:5173', Origin: 'http://localhost:5173' };

const prefs = (over: Partial<PreferenceInput> = {}): PreferenceInput => ({
  destinationTypes: ['mountain'],
  activities: ['trekking', 'museums'],
  climate: 'mild',
  travelStyle: 'comfort',
  budgetMinInr: 10000,
  budgetMaxInr: 40000,
  dateStart: '2026-11-13',
  dateEnd: '2026-11-16',
  ...over,
});

beforeAll(async () => {
  const hub = await ensureHubAt(db, 'pkg-hub', 12, 77);
  await ensureCostRules(db);
  const destId = await ensureDestination(db, { slug: 'pkg-dest', lat: 12.2, lng: 77 });
  const extraIds = [
    await ensureDestination(db, { slug: 'pkg-dest2', lat: 12.3, lng: 77 }),
    await ensureDestination(db, { slug: 'pkg-dest3', lat: 12.4, lng: 77 }),
  ];
  for (const f of [
    { mode: 'bus' as const, fare: 400, durationMinutes: 300, km: 90 },
    { mode: 'train' as const, fare: 300, durationMinutes: 240, km: 90 },
    { mode: 'car' as const, fare: null, durationMinutes: 180, km: 90 },
  ]) {
    await db
      .insert(fareFallback)
      .values({
        originHubId: hub.id,
        destinationId: destId,
        mode: f.mode,
        farePerPersonInr: f.fare,
        durationMinutes: f.durationMinutes,
        distanceKm: f.km,
        collectedOn: '2026-10-12',
        reviewStatus: 'verified',
      })
      .onConflictDoNothing();
  }
  for (const extraId of extraIds) {
    await db
      .insert(fareFallback)
      .values({
        originHubId: hub.id,
        destinationId: extraId,
        mode: 'bus',
        farePerPersonInr: 350,
        durationMinutes: 300,
        distanceKm: 100,
        collectedOn: '2026-10-12',
        reviewStatus: 'verified',
      })
      .onConflictDoNothing();
  }
  for (const p of [
    { key: 'ghat', name: 'Ghat', minutes: 60 },
    { key: 'fort', name: 'Fort', minutes: 90 },
  ]) {
    await db
      .insert(poi)
      .values({
        destinationId: destId,
        poiKey: p.key,
        name: p.name,
        category: 'sight',
        typicalMinutes: p.minutes,
        closedDays: [],
        entryFeeInr: 100,
        lat: 12.2,
        lng: 77,
        collectedOn: '2026-10-12',
        reviewStatus: 'verified',
      })
      .onConflictDoNothing();
  }
});

afterAll(async () => {
  await pool.end();
});

type Agent = request.Agent;
const code = (res: request.Response) => (res.body as ErrorEnvelope).error.code;

/** A 3-member trip with packages_proposed and its organiser/members. */
async function proposedTrip() {
  const members = await Promise.all([
    createTestUser(app, 'Pkg A'),
    createTestUser(app, 'Pkg B'),
    createTestUser(app, 'Pkg C'),
  ]);
  const organiser = members[0];
  const { id: tripId } = await createTripAs(organiser.agent, {
    originHubSlug: 'pkg-hub',
    radiusKm: 200,
    budgetTotalInr: 120000,
    durationNights: 2,
  });
  const { token } = InvitationResponse.parse(
    (await organiser.agent.post(`/api/trips/${tripId}/invitations`).set(H).send({})).body,
  );
  for (const m of members.slice(1)) {
    await m.agent.post(`/api/invitations/${token}/accept`).set(H).send({});
  }
  for (const m of members) {
    const res = await m.agent.put(`/api/trips/${tripId}/preferences/me`).set(H).send(prefs());
    expect(res.status, JSON.stringify(res.body)).toBe(200);
  }
  const run = await organiser.agent.post(`/api/trips/${tripId}/recommendations`).set(H).send({});
  expect(run.status, JSON.stringify(run.body)).toBe(200);
  const chosen = await organiser.agent
    .post(`/api/trips/${tripId}/destination`)
    .set(H)
    .send({ destinationSlug: 'pkg-dest' });
  expect(chosen.status, JSON.stringify(chosen.body)).toBe(200);
  return { tripId, organiser, members };
}

const getPackages = (agent: Agent, tripId: string) =>
  agent.get(`/api/trips/${tripId}/packages`).set(H);

describe('T9: choosing a destination stores the packages', () => {
  it('stores >=3 packages with 6 lines each summing to the total; activity line keeps place keys', async () => {
    const { tripId } = await proposedTrip();
    const rows = await db.select().from(tripPackage).where(eq(tripPackage.tripId, tripId));
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows.every((r) => r.status === 'proposed')).toBe(true);
    const labels = rows.map((r) => r.label);
    expect(labels).toContain('Saver');
    for (const p of rows) {
      const lines = await db.select().from(costItem).where(eq(costItem.packageId, p.id));
      expect(lines.length).toBe(6);
      expect(lines.reduce((s, l) => s + l.amountInr, 0)).toBe(p.totalInr);
      const activities = lines.find((l) => l.category === 'activities');
      expect(activities?.sourceRef).toMatch(/^pois:pkg-dest\//);
    }
    // Car rows are verified, so the car line is curated; stays/food/local are
    // draft in the fixture destination, so those lines are estimated.
    const saver = rows.find((r) => r.label === 'Saver')!;
    const lines = await db.select().from(costItem).where(eq(costItem.packageId, saver.id));
    expect(lines.find((l) => l.category === 'onward')?.provenance).toBe('curated');
    expect(lines.find((l) => l.category === 'stay')?.provenance).toBe('estimated');
  });
});

describe('GET /api/trips/:id/packages and opinions', () => {
  it('members see counts and only their own mine; upsert replaces the vote', async () => {
    const { tripId, organiser, members } = await proposedTrip();
    const list = PackagesResponse.parse((await getPackages(organiser.agent, tripId)).body);
    const saver = list.packages.find((p) => p.label === 'Saver')!;
    expect(list.n).toBe(3);
    expect(list.destination.slug).toBe('pkg-dest');
    expect(list.choices.length).toBeGreaterThan(0);

    const r1 = await members[1].agent
      .put(`/api/trips/${tripId}/packages/${saver.id}/opinion`)
      .set(H)
      .send({ decision: 'accept' });
    expect(r1.status).toBe(200);
    const view1 = PackagesResponse.parse(r1.body);
    const v1 = view1.packages.find((p) => p.id === saver.id)!;
    expect(v1.opinions).toMatchObject({ works: 1, notForMe: 0, members: 3 });
    expect(v1.mine).toBe('accept');
    // Another viewer sees the count but not the other member's choice.
    const other = PackagesResponse.parse((await getPackages(members[2].agent, tripId)).body);
    expect(other.packages.find((p) => p.id === saver.id)!.mine).toBeNull();
    // Upsert flips the vote, not a second row.
    const r2 = await members[1].agent
      .put(`/api/trips/${tripId}/packages/${saver.id}/opinion`)
      .set(H)
      .send({ decision: 'reject' });
    const v2 = PackagesResponse.parse(r2.body).packages.find((p) => p.id === saver.id)!;
    expect(v2.opinions).toMatchObject({ works: 0, notForMe: 1 });
    expect(v2.mine).toBe('reject');
  });

  it('opinions are 409 outside packages_proposed and 403 for non-active members', async () => {
    const { tripId, organiser } = await proposedTrip();
    const saver = PackagesResponse.parse((await getPackages(organiser.agent, tripId)).body)
      .packages[0]!;
    const stranger = await createTestUser(app, 'Stranger');
    const res = await stranger.agent
      .put(`/api/trips/${tripId}/packages/${saver.id}/opinion`)
      .set(H)
      .send({ decision: 'accept' });
    expect(res.status).toBe(404);
  });
});

describe('organiser actions', () => {
  it('select gives T11 to package_selected and hides the other packages', async () => {
    const { tripId, organiser } = await proposedTrip();
    const saver = PackagesResponse.parse(
      (await getPackages(organiser.agent, tripId)).body,
    ).packages.find((p) => p.label === 'Saver')!;
    const res = await organiser.agent
      .post(`/api/trips/${tripId}/packages/${saver.id}/select`)
      .set(H)
      .send({});
    expect(res.status).toBe(200);
    const detail = res.body as { status: string; selectedPackage: { label: string } | null };
    expect(detail.status).toBe('package_selected');
    expect(detail.selectedPackage?.label).toBe('Saver');
    const rows = await db.select().from(tripPackage).where(eq(tripPackage.tripId, tripId));
    expect(rows.find((r) => r.id === saver.id)?.status).toBe('accepted');
    expect(rows.filter((r) => r.status === 'proposed')).toHaveLength(0);
  });

  it('remove gives I4 while alternatives remain, then T10 back to shortlisted on the last one', async () => {
    const { tripId, organiser } = await proposedTrip();
    const seen: string[] = [];
    let list = PackagesResponse.parse((await getPackages(organiser.agent, tripId)).body);
    while (list.packages.length > 1) {
      const res = await organiser.agent
        .post(`/api/trips/${tripId}/packages/${list.packages[0]!.id}/remove`)
        .set(H)
        .send({});
      expect(res.status).toBe(200);
      expect((res.body as { status: string }).status).toBe('packages_proposed');
      seen.push(list.packages[0]!.id);
      list = PackagesResponse.parse((await getPackages(organiser.agent, tripId)).body);
      expect(list.packages.some((p) => seen.includes(p.id))).toBe(false);
    }
    const last = await organiser.agent
      .post(`/api/trips/${tripId}/packages/${list.packages[0]!.id}/remove`)
      .set(H)
      .send({});
    expect((last.body as { status: string }).status).toBe('shortlisted');
    expect((last.body as { selectedDestination: unknown }).selectedDestination).toBeNull();
  });

  it('change recomputes, clears opinions, and a missing pair is 422', async () => {
    const { tripId, organiser, members } = await proposedTrip();
    const saver = PackagesResponse.parse(
      (await getPackages(organiser.agent, tripId)).body,
    ).packages.find((p) => p.label === 'Saver')!;
    await members[1].agent
      .put(`/api/trips/${tripId}/packages/${saver.id}/opinion`)
      .set(H)
      .send({ decision: 'accept' });
    const bad = await organiser.agent
      .patch(`/api/trips/${tripId}/packages/${saver.id}`)
      .set(H)
      .send({ transportMode: 'helicopter' });
    expect(bad.status).toBe(400); // not a mode at all
    const res = await organiser.agent
      .patch(`/api/trips/${tripId}/packages/${saver.id}`)
      .set(H)
      .send({ stayTier: 'premium' });
    expect(res.status).toBe(200);
    const changed = PackagesResponse.parse(res.body).packages.find((p) => p.id === saver.id)!;
    expect(changed.stayTier).toBe('premium');
    expect(changed.totalInr).not.toBe(saver.totalInr);
    expect(changed.opinions).toMatchObject({ works: 0, notForMe: 0 });
  });

  it('a member gets 403 on every organiser write; wrong states give 409', async () => {
    const { tripId, members } = await proposedTrip();
    const saver = PackagesResponse.parse(
      (await getPackages(members[1].agent, tripId)).body,
    ).packages.find((p) => p.label === 'Saver')!;
    const member = members[1].agent;
    for (const [method, path, body] of [
      ['post', `/api/trips/${tripId}/packages/${saver.id}/select`, {}],
      ['post', `/api/trips/${tripId}/packages/${saver.id}/remove`, {}],
      ['patch', `/api/trips/${tripId}/packages/${saver.id}`, { stayTier: 'premium' }],
    ] as const) {
      const res = await member[method](path).set(H).send(body);
      expect(res.status).toBe(403);
    }
    // A non-proposed package id hits the 404 first.
    const missing = await members[0].agent
      .post(`/api/trips/${tripId}/packages/${crypto.randomUUID()}/select`)
      .set(H)
      .send({});
    expect(missing.status).toBe(404);
    expect(code(missing)).toBe('PACKAGE_NOT_FOUND');
  });
});
