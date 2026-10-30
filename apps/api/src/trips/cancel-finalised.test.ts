import { createDb } from '@bonvoyage/db';
import { fareFallback, poi, trip, tripTransition } from '@bonvoyage/db/schema';
import {
  InvitationResponse,
  ItineraryResponse,
  NotificationsResponse,
  PackagesResponse,
  TripDetail,
  type ErrorEnvelope,
  type PreferenceInput,
} from '@bonvoyage/shared';
import { asc, eq } from 'drizzle-orm';
import { pino } from 'pino';
import type request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { createAuth } from '../auth/auth';
import {
  createTestUser,
  createTripAs,
  ensureCostRules,
  ensureDestination,
  ensureHubAt,
  setTripStatus,
} from '../test/helpers';

// T16 (finalised -> cancelled, guard today < startDate) through the real path:
// every trip here reaches finalised over HTTP, so nothing but T14 sets the date.
// cancel.test.ts writes start_date into the row, which is how a 500 on real
// trips went unnoticed. The members' dates give a first day of 13 November, and
// the clock is mutable so the India-date boundary is exact.

const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const auth = createAuth({
  db,
  secret: 'test-secret-test-secret-test-secret',
  baseURL: { allowedHosts: ['localhost:5173', 'localhost:4000', '*.vercel.app'] },
});
const PLANNING_DAY = new Date('2026-11-01T06:30:00Z');
const FIRST_DAY = '2026-11-13';
let now = PLANNING_DAY;
const app = createApp({
  db,
  pool,
  logger: pino({ level: 'silent' }),
  auth,
  clock: () => now,
  scoringWeights: { alpha: 0.5, beta: 0.3, gamma: 0.2 },
});
const H = { Host: 'localhost:5173', Origin: 'http://localhost:5173' };

const prefs: PreferenceInput = {
  destinationTypes: ['mountain'],
  activities: ['trekking'],
  climate: 'mild',
  travelStyle: 'comfort',
  budgetMinInr: 10000,
  budgetMaxInr: 40000,
  dateStart: FIRST_DAY,
  dateEnd: '2026-11-16',
};

beforeAll(async () => {
  const hub = await ensureHubAt(db, 'cancel-hub', 35.5, 72);
  await ensureCostRules(db);
  for (const [slug, lat, km] of [
    ['cancel-a', 35.6, 30],
    ['cancel-b', 35.7, 45],
    ['cancel-c', 35.8, 60],
  ] as const) {
    const id = await ensureDestination(db, { slug, lat, lng: 72 });
    for (const [mode, fare] of [
      ['bus', 400],
      ['car', null],
    ] as const) {
      await db
        .insert(fareFallback)
        .values({
          originHubId: hub.id,
          destinationId: id,
          mode,
          farePerPersonInr: fare,
          durationMinutes: 150,
          distanceKm: km,
          collectedOn: '2026-10-12',
          reviewStatus: 'verified',
        })
        .onConflictDoNothing();
    }
    await db
      .insert(poi)
      .values({
        destinationId: id,
        poiKey: 'ghat',
        name: 'Ghat',
        category: 'sight',
        typicalMinutes: 60,
        closedDays: [],
        entryFeeInr: 100,
        lat,
        lng: 72,
        collectedOn: '2026-10-12',
        reviewStatus: 'verified',
      })
      .onConflictDoNothing();
  }
});

beforeEach(() => {
  now = PLANNING_DAY;
});

afterAll(async () => {
  await pool.end();
});

type Agent = request.Agent;
const code = (res: request.Response) => (res.body as ErrorEnvelope).error.code;
const post = (agent: Agent, path: string) => agent.post(path).set(H).send({});
const cancel = (agent: Agent, tripId: string) => post(agent, `/api/trips/${tripId}/cancel`);

const statusOf = async (tripId: string) => {
  const [row] = await db
    .select({ status: trip.status, startDate: trip.startDate })
    .from(trip)
    .where(eq(trip.id, tripId));
  return row;
};
const transitionsOf = async (tripId: string) =>
  (
    await db
      .select({ id: tripTransition.transitionId })
      .from(tripTransition)
      .where(eq(tripTransition.tripId, tripId))
      .orderBy(asc(tripTransition.createdAt), asc(tripTransition.id))
  ).map((t) => t.id);
const cancelNoticesFor = async (agent: Agent) =>
  NotificationsResponse.parse((await agent.get('/api/notifications').set(H)).body).items.filter(
    (n) => n.type === 'trip_cancelled',
  );

/** A trip with a proposed day plan (T12), reached over HTTP. */
async function plannedTrip() {
  const [organiser, rohan, meera] = await Promise.all([
    createTestUser(app, 'Asha'),
    createTestUser(app, 'Rohan'),
    createTestUser(app, 'Meera'),
  ]);
  const { id: tripId } = await createTripAs(organiser.agent, {
    originHubSlug: 'cancel-hub',
    radiusKm: 200,
    budgetTotalInr: 120000,
    durationNights: 2,
  });
  const { token } = InvitationResponse.parse(
    (await post(organiser.agent, `/api/trips/${tripId}/invitations`)).body,
  );
  for (const m of [rohan, meera]) {
    expect((await post(m.agent, `/api/invitations/${token}/accept`)).status).toBe(200);
  }
  for (const m of [organiser, rohan, meera]) {
    const res = await m.agent.put(`/api/trips/${tripId}/preferences/me`).set(H).send(prefs);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
  }
  expect((await post(organiser.agent, `/api/trips/${tripId}/recommendations`)).status).toBe(200);
  const chosen = await organiser.agent
    .post(`/api/trips/${tripId}/destination`)
    .set(H)
    .send({ destinationSlug: 'cancel-a' });
  expect(chosen.status, JSON.stringify(chosen.body)).toBe(200);
  const { packages } = PackagesResponse.parse(
    (await organiser.agent.get(`/api/trips/${tripId}/packages`).set(H)).body,
  );
  const selected = await post(
    organiser.agent,
    `/api/trips/${tripId}/packages/${packages[0]!.id}/select`,
  );
  expect(selected.status, JSON.stringify(selected.body)).toBe(200);
  const planned = await post(organiser.agent, `/api/trips/${tripId}/itinerary`);
  expect(planned.status, JSON.stringify(planned.body)).toBe(200);
  return { tripId, organiser, rohan, meera };
}

/** The same trip, accepted (T14). */
async function finalisedTrip() {
  const planned = await plannedTrip();
  const accepted = await post(
    planned.organiser.agent,
    `/api/trips/${planned.tripId}/itinerary/accept`,
  );
  expect(accepted.status, JSON.stringify(accepted.body)).toBe(200);
  expect((await statusOf(planned.tripId))?.status).toBe('finalised');
  return planned;
}

describe('T14 stores the trip’s first day', () => {
  it('trip.start_date is the accepted day plan’s first day; planning alone sets nothing', async () => {
    const { tripId, organiser } = await plannedTrip();
    expect((await statusOf(tripId))?.startDate).toBeNull();
    const accepted = await post(organiser.agent, `/api/trips/${tripId}/itinerary/accept`);
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(200);
    expect(TripDetail.parse(accepted.body).startDate).toBe(FIRST_DAY);
    const { itinerary } = ItineraryResponse.parse(
      (await organiser.agent.get(`/api/trips/${tripId}/itinerary`).set(H)).body,
    );
    expect(itinerary?.days[0]?.date).toBe(FIRST_DAY);
  });

  it('turning the plan down (T13) sets no date', async () => {
    const { tripId, organiser } = await plannedTrip();
    expect((await post(organiser.agent, `/api/trips/${tripId}/itinerary/reject`)).status).toBe(200);
    expect(await statusOf(tripId)).toEqual({ status: 'package_selected', startDate: null });
  });
});

describe('T16: cancelling a finalised trip', () => {
  it('before the first day: 200, T16, and the other members hear of it', async () => {
    const { tripId, organiser, rohan, meera } = await finalisedTrip();
    const res = await cancel(organiser.agent, tripId);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toEqual({ id: tripId, status: 'cancelled' });
    expect((await transitionsOf(tripId)).at(-1)).toBe('T16');
    for (const m of [rohan, meera]) {
      expect((await cancelNoticesFor(m.agent)).map((n) => n.message)).toEqual([
        'Asha cancelled the trip',
      ]);
    }
    expect(await cancelNoticesFor(organiser.agent)).toEqual([]);
  });

  it('the last minute of the day before, in India: still 200', async () => {
    const { tripId, organiser } = await finalisedTrip();
    now = new Date('2026-11-12T18:29:00Z'); // 23:59 on 12 November in India
    expect((await cancel(organiser.agent, tripId)).status).toBe(200);
  });

  it.each([
    ['the first minute of the first day, in India', '2026-11-12T18:31:00Z'],
    ['a day after it', '2026-11-14T06:30:00Z'],
  ])('%s: 409 GUARD_FAILED, still finalised, nobody told', async (_when, at) => {
    const { tripId, organiser, rohan } = await finalisedTrip();
    now = new Date(at);
    const res = await cancel(organiser.agent, tripId);
    expect([res.status, code(res)]).toEqual([409, 'GUARD_FAILED']);
    expect((await statusOf(tripId))?.status).toBe('finalised');
    expect((await transitionsOf(tripId)).at(-1)).toBe('T14');
    expect(await cancelNoticesFor(rohan.agent)).toEqual([]);
  });

  it('a member cannot cancel it (403)', async () => {
    const { tripId, rohan } = await finalisedTrip();
    const res = await cancel(rohan.agent, tripId);
    expect([res.status, code(res)]).toEqual([403, 'FORBIDDEN']);
  });
});

// Trips finalised before T14 stored the date: the accepted package still knows it.
describe('a trip finalised with no stored date', () => {
  const clearDate = (tripId: string) =>
    db.update(trip).set({ startDate: null }).where(eq(trip.id, tripId));

  it('takes the date from its accepted package: 200 before the first day', async () => {
    const { tripId, organiser } = await finalisedTrip();
    await clearDate(tripId);
    expect((await cancel(organiser.agent, tripId)).status).toBe(200);
    expect(await statusOf(tripId)).toEqual({ status: 'cancelled', startDate: FIRST_DAY });
    expect((await transitionsOf(tripId)).at(-1)).toBe('T16');
  });

  it('and is refused from the first day (409)', async () => {
    const { tripId, organiser } = await finalisedTrip();
    await clearDate(tripId);
    now = new Date('2026-11-13T06:30:00Z');
    const res = await cancel(organiser.agent, tripId);
    expect([res.status, code(res)]).toEqual([409, 'GUARD_FAILED']);
    expect(await statusOf(tripId)).toEqual({ status: 'finalised', startDate: FIRST_DAY });
  });

  it('with no accepted package either: 409 with a clear message, never allowed silently', async () => {
    const organiser = await createTestUser(app, 'Asha');
    const { id: tripId } = await createTripAs(organiser.agent, { originHubSlug: 'cancel-hub' });
    await setTripStatus(db, tripId, 'finalised');
    const res = await cancel(organiser.agent, tripId);
    expect(res.status).toBe(409);
    expect((res.body as ErrorEnvelope).error).toMatchObject({
      code: 'GUARD_FAILED',
      message: 'This trip has no start date, so it cannot be cancelled.',
    });
    expect((await statusOf(tripId))?.status).toBe('finalised');
  });
});

describe('T15 is unchanged', () => {
  it('a trip with a proposed plan cancels through T15 and gets no date', async () => {
    const { tripId, organiser, rohan } = await plannedTrip();
    expect((await cancel(organiser.agent, tripId)).status).toBe(200);
    expect(await statusOf(tripId)).toEqual({ status: 'cancelled', startDate: null });
    expect((await transitionsOf(tripId)).at(-1)).toBe('T15');
    expect((await cancelNoticesFor(rohan.agent)).map((n) => n.message)).toEqual([
      'Asha cancelled the trip',
    ]);
  });

  it('a date in the past does not matter before finalised', async () => {
    const { tripId, organiser } = await plannedTrip();
    now = new Date('2026-12-01T06:30:00Z');
    expect((await cancel(organiser.agent, tripId)).status).toBe(200);
    expect((await transitionsOf(tripId)).at(-1)).toBe('T15');
  });
});
