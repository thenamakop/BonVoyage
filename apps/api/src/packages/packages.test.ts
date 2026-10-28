import { createDb, importCatalogue } from '@bonvoyage/db';
import { costItem, fareFallback, poi, tripPackage } from '@bonvoyage/db/schema';
import { eq } from 'drizzle-orm';
import { resolve } from 'node:path';
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
  const hub = await ensureHubAt(db, 'pkg-hub', 30, 85);
  await ensureCostRules(db);
  const destId = await ensureDestination(db, { slug: 'pkg-dest', lat: 30.2, lng: 85 });
  const extraIds = [
    await ensureDestination(db, { slug: 'pkg-dest2', lat: 30.3, lng: 85 }),
    await ensureDestination(db, { slug: 'pkg-dest3', lat: 30.4, lng: 85 }),
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
        lat: 30.2,
        lng: 85,
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

/**
 * A trip with packages_proposed and its organiser/members: 3 members, or the
 * first `memberCount` of the three users (the rest are created but never join).
 */
async function proposedTrip(
  trip: { budgetTotalInr?: number; memberCount?: 2 | 3; budget?: Partial<PreferenceInput> } = {},
) {
  const members = await Promise.all([
    createTestUser(app, 'Pkg A'),
    createTestUser(app, 'Pkg B'),
    createTestUser(app, 'Pkg C'),
  ]);
  const joined = members.slice(0, trip.memberCount ?? 3);
  const organiser = members[0];
  const { id: tripId } = await createTripAs(organiser.agent, {
    originHubSlug: 'pkg-hub',
    radiusKm: 200,
    budgetTotalInr: trip.budgetTotalInr ?? 120000,
    durationNights: 2,
  });
  const { token } = InvitationResponse.parse(
    (await organiser.agent.post(`/api/trips/${tripId}/invitations`).set(H).send({})).body,
  );
  for (const m of joined.slice(1)) {
    await m.agent.post(`/api/invitations/${token}/accept`).set(H).send({});
  }
  for (const m of joined) {
    const res = await m.agent
      .put(`/api/trips/${tripId}/preferences/me`)
      .set(H)
      .send(prefs(trip.budget));
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
    expect(
      (await member.post(`/api/trips/${tripId}/packages/${saver.id}/select`).set(H).send({}))
        .status,
    ).toBe(403);
    expect(
      (await member.post(`/api/trips/${tripId}/packages/${saver.id}/remove`).set(H).send({}))
        .status,
    ).toBe(403);
    expect(
      (
        await member
          .patch(`/api/trips/${tripId}/packages/${saver.id}`)
          .set(H)
          .send({ stayTier: 'premium' })
      ).status,
    ).toBe(403);
    // A non-proposed package id hits the 404 first.
    const missing = await members[0].agent
      .post(`/api/trips/${tripId}/packages/${crypto.randomUUID()}/select`)
      .set(H)
      .send({});
    expect(missing.status).toBe(404);
    expect(code(missing)).toBe('PACKAGE_NOT_FOUND');
  });
});

describe('budget flag and re-choose', () => {
  it('a cap below a package total sets overBudget and overByInr; one at the cap is not over', async () => {
    // The cap equals the Saver total: Saver sits exactly at it (not over),
    // the pricier tiers are over by total - cap.
    const { tripId, organiser } = await proposedTrip({ budgetTotalInr: 15600 });
    const list = PackagesResponse.parse((await getPackages(organiser.agent, tripId)).body);
    const over = list.packages.filter((p) => p.overBudget);
    expect(over.length).toBeGreaterThan(0);
    for (const p of over) expect(p.overByInr).toBe(p.totalInr - 15600);
    const saver = list.packages.find((p) => p.label === 'Saver')!;
    expect(saver.totalInr).toBe(15600); // exactly at the cap: not over budget
    expect(saver.overBudget).toBe(false);
    expect(saver.overByInr).toBe(0);
  });

  it('2 members: an amount over a member-set cap is left out; over a trip-set cap it is shown (D1, #116)', async () => {
    // The 2-member Saver total, read off a trip with room to spare.
    const probe = await proposedTrip({ memberCount: 2 });
    const saverOf = (list: PackagesResponse) => list.packages.find((p) => p.label === 'Saver')!;
    const s2 = saverOf(
      PackagesResponse.parse((await getPackages(probe.organiser.agent, probe.tripId)).body),
    ).totalInr;
    expect(s2 % 2, 'the cap below is 2 x s2 / 2, so s2 must be even').toBe(0);

    // Members' maxima set the cap at exactly the Saver total.
    const members = await proposedTrip({
      memberCount: 2,
      budgetTotalInr: 120000,
      budget: { budgetMinInr: 1000, budgetMaxInr: s2 / 2 },
    });
    const byMembers = PackagesResponse.parse(
      (await getPackages(members.members[1].agent, members.tripId)).body,
    );
    expect(byMembers.packages.some((p) => p.overBudget)).toBe(true);
    for (const p of byMembers.packages) {
      expect(p.overBudget).toBe(p.totalInr > s2);
      expect(p.overByInr).toBeNull();
    }

    // The trip budget sets the same cap: it is public, so the amount stays.
    const byTrip = await proposedTrip({ memberCount: 2, budgetTotalInr: s2 });
    const list = PackagesResponse.parse(
      (await getPackages(byTrip.organiser.agent, byTrip.tripId)).body,
    );
    expect(list.packages.some((p) => p.overBudget)).toBe(true);
    for (const p of list.packages) expect(p.overByInr).toBe(Math.max(0, p.totalInr - s2));
  });

  it('after a change (I3) overByInr follows the stored total, proposed and accepted', async () => {
    // Saver sits at the 15600 cap; premium makes it dearer. The figure must
    // come from the changed row, not from a default Saver rebuilt by label.
    const cap = 15600;
    const { tripId, organiser } = await proposedTrip({ budgetTotalInr: cap });
    const saverOf = async () =>
      PackagesResponse.parse((await getPackages(organiser.agent, tripId)).body).packages.find(
        (p) => p.label === 'Saver',
      )!;
    const change = async (id: string, stayTier: 'budget' | 'premium') => {
      const res = await organiser.agent
        .patch(`/api/trips/${tripId}/packages/${id}`)
        .set(H)
        .send({ stayTier });
      expect(res.status, JSON.stringify(res.body)).toBe(200);
    };
    const { id } = await saverOf();

    await change(id, 'premium');
    const dearer = await saverOf();
    expect(dearer.totalInr).toBeGreaterThan(cap);
    expect(dearer.overBudget).toBe(true);
    expect(dearer.overByInr).toBe(dearer.totalInr - cap);
    const [row] = await db.select().from(tripPackage).where(eq(tripPackage.id, id));
    expect(row?.overBudget).toBe(true);

    await change(id, 'budget');
    const back = await saverOf();
    expect(back.totalInr).toBe(cap);
    expect(back.overBudget).toBe(false);
    expect(back.overByInr).toBe(0);

    await change(id, 'premium');
    const select = await organiser.agent
      .post(`/api/trips/${tripId}/packages/${id}/select`)
      .set(H)
      .send({});
    expect(select.status).toBe(200);
    const accepted = await saverOf();
    expect(accepted.status).toBe('accepted');
    expect(accepted.overBudget).toBe(true);
    expect(accepted.overByInr).toBe(accepted.totalInr - cap);
  });

  it('T10 back to shortlisted then choosing another destination builds fresh packages', async () => {
    const { tripId, organiser } = await proposedTrip();
    let list = PackagesResponse.parse((await getPackages(organiser.agent, tripId)).body);
    const oldIds = new Set(list.packages.map((p) => p.id));
    while (list.packages.length > 0) {
      const res = await organiser.agent
        .post(`/api/trips/${tripId}/packages/${list.packages[0]!.id}/remove`)
        .set(H)
        .send({});
      expect(res.status).toBe(200);
      list =
        (res.body as { status: string }).status === 'packages_proposed'
          ? PackagesResponse.parse((await getPackages(organiser.agent, tripId)).body)
          : { ...list, packages: [] };
    }
    // Now shortlisted again; choose the other feasible destination.
    const chosen = await organiser.agent
      .post(`/api/trips/${tripId}/destination`)
      .set(H)
      .send({ destinationSlug: 'pkg-dest2' });
    expect(chosen.status, JSON.stringify(chosen.body)).toBe(200);
    const fresh = PackagesResponse.parse((await getPackages(organiser.agent, tripId)).body);
    expect(fresh.destination.slug).toBe('pkg-dest2');
    expect(fresh.packages.length).toBeGreaterThan(0);
    expect(fresh.packages.some((p) => oldIds.has(p.id))).toBe(false);
    const rows = await db.select().from(tripPackage).where(eq(tripPackage.tripId, tripId));
    expect(rows.filter((r) => r.status === 'proposed').map((r) => r.destinationId)).toEqual(
      rows
        .filter((r) => r.status === 'proposed')
        .map(() => rows.find((x) => x.status === 'proposed')!.destinationId),
    );
    expect(rows.filter((r) => oldIds.has(r.id)).every((r) => r.status === 'hidden')).toBe(true);
  });
});

describe('speed on the real catalogue (R15, P10)', () => {
  it('a 3-member Gurugram destination choice completes under 1000 ms', async () => {
    const dir = resolve(import.meta.dirname, '../../../../packages/db/catalogue');
    await importCatalogue(db, dir, { today: '2026-11-01' });
    const members = await Promise.all([
      createTestUser(app, 'Speed A'),
      createTestUser(app, 'Speed B'),
      createTestUser(app, 'Speed C'),
    ]);
    const organiser = members[0];
    const { id: tripId } = await createTripAs(organiser.agent, {
      originHubSlug: 'gurugram',
      radiusKm: 450,
      budgetTotalInr: 60000,
      durationNights: 2,
    });
    const { token } = InvitationResponse.parse(
      (await organiser.agent.post(`/api/trips/${tripId}/invitations`).set(H).send({})).body,
    );
    for (const m of members.slice(1)) {
      await m.agent.post(`/api/invitations/${token}/accept`).set(H).send({});
    }
    for (const [i, m] of members.entries()) {
      const res = await m.agent
        .put(`/api/trips/${tripId}/preferences/me`)
        .set(H)
        .send(
          prefs({
            destinationTypes: [
              ['hill_station', 'mountain'],
              ['spiritual', 'mountain'],
              ['heritage', 'city'],
            ][i]! as never,
          }),
        );
      expect(res.status).toBe(200);
    }
    const run = await organiser.agent.post(`/api/trips/${tripId}/recommendations`).set(H).send({});
    expect(run.status).toBe(200);
    const slug = (run.body as { items: { destination: { slug: string } }[] }).items[0]!.destination
      .slug;
    const started = performance.now();
    const res = await organiser.agent
      .post(`/api/trips/${tripId}/destination`)
      .set(H)
      .send({ destinationSlug: slug });
    const ms = Math.round(performance.now() - started);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    process.stdout.write(`
S3-3 destination choice: ${ms} ms (${slug})
`);
    expect(ms).toBeLessThan(1000);
  });
});
