import { resolve } from 'node:path';
import { createDb, importCatalogue } from '@bonvoyage/db';
import { tripTransition } from '@bonvoyage/db/schema';
import {
  indiaDate,
  InvitationResponse,
  LatestRecommendationResponse,
  RequestRecommendationsResponse,
  TripDetail,
  type DestinationType,
  type PreferenceInput,
} from '@bonvoyage/shared';
import { asc, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { createAuth } from '../auth/auth';
import { createTestUser } from '../test/helpers';

// S2-8 (R2 to R7, R15): the whole Sprint 2 flow over HTTP, from sign-up to a
// chosen destination, against the real catalogue. Each member's explanation
// must be their own, and an outsider must not learn the trip exists.

const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const auth = createAuth({
  db,
  secret: 'test-secret-test-secret-test-secret',
  baseURL: { allowedHosts: ['localhost:5173', 'localhost:4000', '*.vercel.app'] },
});
const app = createApp({ db, pool, logger: pino({ level: 'silent' }), auth });
const H = { Host: 'localhost:5173', Origin: 'http://localhost:5173' };

const inDays = (n: number) => indiaDate(new Date(Date.now() + n * 86_400_000));

// Distinct kinds of place per member, so `mine` shows whose explanation it is.
const MEMBERS: { name: string; types: DestinationType[]; prefs: Partial<PreferenceInput> }[] = [
  { name: 'Flow Asha', types: ['mountain', 'adventure'], prefs: { activities: ['trekking'] } },
  { name: 'Flow Rohan', types: ['spiritual'], prefs: { activities: ['temples', 'yoga_wellness'] } },
  { name: 'Flow Meera', types: ['heritage', 'city'], prefs: { activities: ['museums'] } },
  { name: 'Flow Kabir', types: ['hill_station', 'lake'], prefs: { activities: ['boating'] } },
];

const prefsFor = (m: (typeof MEMBERS)[number]): PreferenceInput => ({
  destinationTypes: m.types,
  activities: ['trekking'],
  climate: 'any',
  travelStyle: 'comfort',
  budgetMinInr: 8000,
  budgetMaxInr: 20000,
  dateStart: inDays(30),
  dateEnd: inDays(34),
  ...m.prefs,
});

beforeAll(async () => {
  await importCatalogue(db, resolve(import.meta.dirname, '../../../../packages/db/catalogue'), {
    today: indiaDate(new Date()),
  });
});
afterAll(() => pool.end());

describe('group flow, end to end', () => {
  it('sign-up to chosen destination, with private explanations and the transitions in order', async () => {
    const people = [];
    for (const m of MEMBERS) people.push({ ...m, ...(await createTestUser(app, m.name)) });
    const outsider = await createTestUser(app, 'Flow Outsider');
    const [organiser, ...joiners] = people;
    if (!organiser) throw new Error('no organiser');

    // T1: create the trip.
    const created = await organiser.agent.post('/api/trips').set(H).send({
      title: 'End-to-end flow',
      originHubSlug: 'gurugram',
      durationNights: 2,
      budgetTotalInr: 60000,
      radiusKm: 450,
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const tripId = TripDetail.parse(created.body).id;

    // T2: the first invitation; three members join through the link.
    const invite = await organiser.agent.post(`/api/trips/${tripId}/invitations`).set(H).send({});
    const { token } = InvitationResponse.parse(invite.body);
    for (const j of joiners) {
      expect((await j.agent.post(`/api/invitations/${token}/accept`).set(H).send({})).status).toBe(
        200,
      );
    }

    // An I1 for each submission while others are pending, then T3 on the last.
    for (const p of people) {
      const res = await p.agent.put(`/api/trips/${tripId}/preferences/me`).set(H).send(prefsFor(p));
      expect(res.status, JSON.stringify(res.body)).toBe(200);
    }
    expect(
      TripDetail.parse((await organiser.agent.get(`/api/trips/${tripId}`).set(H)).body).status,
    ).toBe('ready_for_recommendation');

    // T6>T7: a shortlist.
    const started = performance.now();
    const rec = await organiser.agent.post(`/api/trips/${tripId}/recommendations`).set(H).send({});
    const ms = performance.now() - started;
    expect(rec.status, JSON.stringify(rec.body)).toBe(200);
    const run = RequestRecommendationsResponse.parse(rec.body);
    expect(run.transition).toEqual({ transitionId: 'T6>T7', to: 'shortlisted' });
    expect(run.run?.kind).toBe('shortlist');
    expect(ms).toBeLessThan(2000); // R15, with generous room for CI

    // Each member's `mine` covers exactly their own kinds of place, on every item.
    for (const p of people) {
      const latest = LatestRecommendationResponse.parse(
        (await p.agent.get(`/api/trips/${tripId}/recommendations/latest`).set(H)).body,
      );
      expect(latest.items.length).toBeGreaterThanOrEqual(3);
      for (const item of latest.items) {
        expect(item.mine, p.name).not.toBeNull();
        const covered = [...item.mine!.metTypes, ...item.mine!.missedTypes].sort();
        expect(covered, `${p.name} on ${item.destination.slug}`).toEqual([...p.types].sort());
      }
    }

    // An outsider gets the same 404 as for a trip that does not exist.
    const peek = await outsider.agent.get(`/api/trips/${tripId}/recommendations/latest`).set(H);
    expect(peek.status).toBe(404);
    expect((peek.body as { error: { code: string } }).error.code).toBe('NOT_FOUND');

    // T9: the organiser chooses the top destination.
    const top = run.items[0]!.destination;
    const chosen = await organiser.agent
      .post(`/api/trips/${tripId}/destination`)
      .set(H)
      .send({ destinationSlug: top.slug });
    expect(chosen.status, JSON.stringify(chosen.body)).toBe(200);
    const detail = TripDetail.parse(chosen.body);
    expect(detail.status).toBe('packages_proposed');
    expect(detail.selectedDestination?.slug).toBe(top.slug);

    const transitions = await db
      .select({ id: tripTransition.transitionId })
      .from(tripTransition)
      .where(eq(tripTransition.tripId, tripId))
      .orderBy(asc(tripTransition.createdAt), asc(tripTransition.id));
    expect(transitions.map((t) => t.id)).toEqual([
      'T1',
      'T2',
      'I1',
      'I1',
      'I1',
      'T3',
      'T6>T7',
      'T9',
    ]);
  });
});
