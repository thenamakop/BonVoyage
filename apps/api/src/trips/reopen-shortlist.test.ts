import { createDb } from '@bonvoyage/db';
import { fareFallback, recommendationRun, tripPackage } from '@bonvoyage/db/schema';
import {
  ActivityResponse,
  InvitationResponse,
  PackagesResponse,
  RequestRecommendationsResponse,
  TripDetail,
  type ErrorEnvelope,
  type PreferenceInput,
} from '@bonvoyage/shared';
import { asc, eq } from 'drizzle-orm';
import { pino } from 'pino';
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

// S5-2b-1: T21 "Ask again" (decision E1). A full cycle: shortlist, T9 and T10,
// then T21, a revision (T5), an edit (0004 j), a second request (round 2) and
// T9 on the new run only. The fixture hub sits far outside India, so the real
// catalogue other files import never falls inside its radius.

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

// reopen-far is inside the first radius (200 km) and outside the edited one
// (100 km), so round 2's shortlist differs from round 1's.
const DESTINATIONS = [
  { slug: 'reopen-a', lat: 36.2, km: 30 },
  { slug: 'reopen-b', lat: 36.3, km: 45 },
  { slug: 'reopen-c', lat: 36.4, km: 60 },
  { slug: 'reopen-far', lat: 36.9, km: 130 },
];

const prefs = (over: Partial<PreferenceInput> = {}): PreferenceInput => ({
  destinationTypes: ['mountain'],
  activities: ['trekking'],
  climate: 'mild',
  travelStyle: 'comfort',
  budgetMinInr: 10000,
  budgetMaxInr: 40000,
  dateStart: '2026-11-13',
  dateEnd: '2026-11-16',
  ...over,
});

beforeAll(async () => {
  const hub = await ensureHubAt(db, 'reopen-hub', 36, 90);
  await ensureCostRules(db);
  for (const d of DESTINATIONS) {
    const id = await ensureDestination(db, { slug: d.slug, lat: d.lat, lng: 90 });
    await db
      .insert(fareFallback)
      .values({
        originHubId: hub.id,
        destinationId: id,
        mode: 'bus',
        farePerPersonInr: 400,
        durationMinutes: 120,
        distanceKm: d.km,
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

async function shortlistedTrip() {
  const members = await Promise.all([
    createTestUser(app, 'Reopen Asha'),
    createTestUser(app, 'Reopen Rohan'),
    createTestUser(app, 'Reopen Meera'),
  ]);
  const organiser = members[0];
  const { id: tripId } = await createTripAs(organiser.agent, {
    originHubSlug: 'reopen-hub',
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
  const run = RequestRecommendationsResponse.parse(
    (await organiser.agent.post(`/api/trips/${tripId}/recommendations`).set(H).send({})).body,
  );
  expect(run.transition).toEqual({ transitionId: 'T6>T7', to: 'shortlisted' });
  expect(run.run).toMatchObject({ round: 1, kind: 'shortlist', feasibleCount: 4 });
  return { tripId, organiser, members };
}

const reopen = (agent: Agent, tripId: string) =>
  agent.post(`/api/trips/${tripId}/reopen-shortlist`).set(H).send({});
const choose = (agent: Agent, tripId: string, destinationSlug: string) =>
  agent.post(`/api/trips/${tripId}/destination`).set(H).send({ destinationSlug });
const packagesOf = async (agent: Agent, tripId: string) =>
  PackagesResponse.parse((await agent.get(`/api/trips/${tripId}/packages`).set(H)).body);

/** T9 on `slug`, an opinion on one package, then remove them all (I4, then T10). */
async function chooseAndRejectAll(agent: Agent, tripId: string, slug: string) {
  expect((await choose(agent, tripId, slug)).status).toBe(200);
  let list = await packagesOf(agent, tripId);
  const ids = list.packages.map((p) => p.id);
  const opinion = await agent
    .put(`/api/trips/${tripId}/packages/${ids[0]}/opinion`)
    .set(H)
    .send({ decision: 'accept' });
  expect(opinion.status, JSON.stringify(opinion.body)).toBe(200);
  let status = 'packages_proposed';
  while (status === 'packages_proposed') {
    // Safe: while the trip is packages_proposed at least one package is proposed.
    const res = await agent
      .post(`/api/trips/${tripId}/packages/${list.packages[0]!.id}/remove`)
      .set(H)
      .send({});
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    status = TripDetail.parse(res.body).status;
    if (status === 'packages_proposed') list = await packagesOf(agent, tripId);
  }
  expect(status).toBe('shortlisted');
  return ids;
}

describe('POST /api/trips/:id/reopen-shortlist (T21)', () => {
  it('asks again: revise, edit, round 2 and T9 on the new run only', async () => {
    const { tripId, organiser, members } = await shortlistedTrip();
    const [, rohan] = members;

    // An earlier T9/T10 cycle: packages, an opinion, all removed.
    const oldIds = await chooseAndRejectAll(organiser.agent, tripId, 'reopen-far');

    // A member cannot ask again; the trip stays shortlisted.
    const denied = await reopen(rohan.agent, tripId);
    expect(denied.status).toBe(403);
    expect(code(denied)).toBe('FORBIDDEN');

    const res = await reopen(organiser.agent, tripId);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const detail = TripDetail.parse(res.body);
    expect(detail.status).toBe('ready_for_recommendation');
    expect(detail.selectedDestination).toBeNull();
    const actions = detail.availableActions.map((a) => a.action);
    expect(actions).toEqual(
      expect.arrayContaining(['requestRecommendations', 'editDetails', 'editPreferences']),
    );
    expect(actions).not.toContain('reopenShortlist');
    expect(actions).not.toContain('chooseDestination');
    const activity = ActivityResponse.parse(
      (await organiser.agent.get(`/api/trips/${tripId}/activity`).set(H)).body,
    );
    expect(activity.items[0]).toMatchObject({
      transitionId: 'T21',
      event: 'shortlistReopened',
      fromStatus: 'shortlisted',
      toStatus: 'ready_for_recommendation',
      summary: 'Reopen Asha asked for new recommendations',
    });

    // A second "Ask again" before a new shortlist is an illegal event.
    const again = await reopen(organiser.agent, tripId);
    expect(again.status).toBe(409);
    expect(code(again)).toBe('ILLEGAL_TRANSITION');

    // Members may revise (T5) and the organiser may edit (0004 j).
    const revised = await rohan.agent
      .put(`/api/trips/${tripId}/preferences/me`)
      .set(H)
      .send(prefs({ climate: 'cold' }));
    expect(revised.status, JSON.stringify(revised.body)).toBe(200);
    const edited = await organiser.agent
      .patch(`/api/trips/${tripId}`)
      .set(H)
      .send({ radiusKm: 100 });
    expect(edited.status, JSON.stringify(edited.body)).toBe(200);

    const second = RequestRecommendationsResponse.parse(
      (await organiser.agent.post(`/api/trips/${tripId}/recommendations`).set(H).send({})).body,
    );
    expect(second.transition).toEqual({ transitionId: 'T6>T7', to: 'shortlisted' });
    expect(second.run).toMatchObject({ round: 2, kind: 'shortlist', feasibleCount: 3 });
    expect(second.items.map((i) => i.destination.slug).sort()).toEqual([
      'reopen-a',
      'reopen-b',
      'reopen-c',
    ]);
    const runs = await db
      .select({ round: recommendationRun.round, kind: recommendationRun.kind })
      .from(recommendationRun)
      .where(eq(recommendationRun.tripId, tripId))
      .orderBy(asc(recommendationRun.round));
    expect(runs).toEqual([
      { round: 1, kind: 'shortlist' },
      { round: 2, kind: 'shortlist' },
    ]);

    // T9 reads the new run only: round 1's reopen-far is no longer choosable.
    const stale = await choose(organiser.agent, tripId, 'reopen-far');
    expect(stale.status).toBe(422);
    expect(code(stale)).toBe('DESTINATION_NOT_IN_SHORTLIST');
    const chosen = await choose(organiser.agent, tripId, 'reopen-b');
    expect(chosen.status, JSON.stringify(chosen.body)).toBe(200);
    expect(TripDetail.parse(chosen.body).selectedDestination?.slug).toBe('reopen-b');

    // Nothing from the earlier cycle survives: fresh packages, no old opinion.
    const fresh = await packagesOf(organiser.agent, tripId);
    expect(fresh.destination.slug).toBe('reopen-b');
    expect(fresh.packages.length).toBeGreaterThan(0);
    expect(fresh.packages.some((p) => oldIds.includes(p.id))).toBe(false);
    for (const p of fresh.packages) {
      expect(p.opinions).toMatchObject({ works: 0, notForMe: 0 });
      expect(p.mine).toBeNull();
    }
    const rows = await db.select().from(tripPackage).where(eq(tripPackage.tripId, tripId));
    expect(rows.filter((r) => oldIds.includes(r.id)).every((r) => r.status === 'hidden')).toBe(
      true,
    );
  });

  it('is 409 ILLEGAL_TRANSITION once a destination is chosen (packages_proposed)', async () => {
    const { tripId, organiser } = await shortlistedTrip();
    expect((await choose(organiser.agent, tripId, 'reopen-a')).status).toBe(200);
    const res = await reopen(organiser.agent, tripId);
    expect(res.status).toBe(409);
    expect(code(res)).toBe('ILLEGAL_TRANSITION');
    const trip = TripDetail.parse((await organiser.agent.get(`/api/trips/${tripId}`).set(H)).body);
    expect(trip.status).toBe('packages_proposed');
  });

  it('rejects a body with fields (400)', async () => {
    const { tripId, organiser } = await shortlistedTrip();
    const res = await organiser.agent
      .post(`/api/trips/${tripId}/reopen-shortlist`)
      .set(H)
      .send({ status: 'draft' });
    expect(res.status).toBe(400);
    expect(code(res)).toBe('VALIDATION_ERROR');
  });
});
