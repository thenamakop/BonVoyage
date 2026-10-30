import { randomUUID } from 'node:crypto';
import { createDb } from '@bonvoyage/db';
import { fareFallback, llmCache, poi } from '@bonvoyage/db/schema';
import { createGuardedLlmClient, FixtureLlmClient } from '@bonvoyage/integrations';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import {
  GroupProfileResponse,
  InvitationResponse,
  ItineraryResponse,
  LatestRecommendationResponse,
  PackagesResponse,
  TripDetail,
} from '@bonvoyage/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { createAuth } from '../auth/auth';
import { ENDPOINTS } from '../test/endpoint-inventory';
import {
  createTestUser,
  createTripAs,
  ensureCostRules,
  ensureDestination,
  ensureHub,
  ensureHubAt,
} from '../test/helpers';

// S1-6 step 3 (R10, SRS 3.4): every GET endpoint, called by every kind of
// caller, is searched as raw text for anything private to another user.
// Each user carries values nothing else could produce by chance.

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
});
const H = { Host: 'localhost:5173', Origin: 'http://localhost:5173' };

type Agent = request.Agent;
interface Person {
  key: string;
  agent: Agent;
  userId: string;
  email: string;
  /** Private to this person: preference budgets and a past-trip name. */
  secrets: string[];
}

const prefs = (min: number, max: number) => ({
  destinationTypes: ['heritage'],
  activities: ['museums'],
  climate: 'warm',
  travelStyle: 'premium',
  budgetMinInr: min,
  budgetMaxInr: max,
  dateStart: '2026-11-13',
  dateEnd: '2026-11-16',
});

let people: Person[];
let tripId: string;
let token: string;
let outsiderTripBudget: string;

beforeAll(async () => {
  await ensureHub(db, 'test-hub');
  await ensureCostRules(db);
  const make = async (key: string, name: string, min: number, max: number) => {
    const u = await createTestUser(app, name);
    await u.agent
      .post('/api/me/past-trips')
      .set(H)
      .send({ placeName: `Leaktest-${key}`, rating: 4 });
    return { key, ...u, min, max, secrets: [String(min), String(max), `Leaktest-${key}`] };
  };
  const asha = await make('Asha', 'Leak Asha', 111113, 123457);
  const rohan = await make('Rohan', 'Leak Rohan', 222227, 234571);
  const outsider = await make('Outsider', 'Leak Outsider', 333331, 345679);

  // Asha organises; Rohan joins; both submit. The outsider has a trip of their own.
  tripId = (await createTripAs(asha.agent, { budgetTotalInr: 48000, durationNights: 2 })).id;
  token = InvitationResponse.parse(
    (await asha.agent.post(`/api/trips/${tripId}/invitations`).set(H).send({})).body,
  ).token;
  await rohan.agent.post(`/api/invitations/${token}/accept`).set(H).send({});
  for (const p of [asha, rohan]) {
    await p.agent.put(`/api/trips/${tripId}/preferences/me`).set(H).send(prefs(p.min, p.max));
  }
  // S2-6: a stored run, so the recommendation and group-profile GETs carry
  // real content (group budgets are rounded to ₹500, never a member's limit).
  const run = await asha.agent.post(`/api/trips/${tripId}/recommendations`).set(H).send({});
  expect(run.status, JSON.stringify(run.body)).toBe(200);
  outsiderTripBudget = '987659';
  const other = await createTripAs(outsider.agent, { budgetTotalInr: 987659, durationNights: 2 });
  const otherToken = InvitationResponse.parse(
    (await outsider.agent.post(`/api/trips/${other.id}/invitations`).set(H).send({})).body,
  ).token;
  expect(otherToken).toBeTruthy();
  await outsider.agent
    .put(`/api/trips/${other.id}/preferences/me`)
    .set(H)
    .send(prefs(outsider.min, outsider.max));
  people = [asha, rohan, outsider];
});

afterAll(async () => {
  await pool.end();
});

const GETS = ENDPOINTS.filter((e) => e.method === 'GET');
const urlOf = (path: string) => path.replace(':id', tripId).replace(':token', token);

async function fetchAll(agent: Agent | null) {
  const out: { path: string; status: number; text: string }[] = [];
  for (const e of GETS) {
    const res = await (agent ?? request(app)).get(urlOf(e.path)).set(H);
    out.push({ path: e.path, status: res.status, text: res.text });
  }
  return out;
}

describe('no response leaks another user’s private data', () => {
  it('covers every GET endpoint in the inventory', () => {
    expect(GETS.length).toBeGreaterThanOrEqual(10);
  });

  it('anonymous callers see no budget, past trip or email anywhere', async () => {
    const all = await fetchAll(null);
    for (const { path, text } of all) {
      for (const p of people) {
        for (const secret of [...p.secrets, p.email]) {
          expect(text, `${path} leaked ${secret}`).not.toContain(secret);
        }
      }
      expect(text, `${path} leaked the outsider's trip budget`).not.toContain(outsiderTripBudget);
    }
  });

  it.each(['Asha', 'Rohan', 'Outsider'])(
    '%s sees only their own private values, and their email only on GET /api/me',
    async (key) => {
      const me = people.find((p) => p.key === key)!;
      const others = people.filter((p) => p !== me);
      const all = await fetchAll(me.agent);
      for (const { path, text } of all) {
        for (const o of others) {
          for (const secret of [...o.secrets, o.email]) {
            expect(text, `${path} as ${key} leaked ${secret}`).not.toContain(secret);
          }
        }
        if (key !== 'Outsider') {
          expect(text, `${path} as ${key} leaked another trip's budget`).not.toContain(
            outsiderTripBudget,
          );
        }
        const hasOwnEmail = text.includes(me.email);
        expect(hasOwnEmail, `${path} as ${key}: own email`).toBe(path === '/api/me');
      }
    },
  );

  it("the trip's members carry names, roles, statuses and the submitted flag only", async () => {
    const res = await people[1]!.agent.get(`/api/trips/${tripId}`).set(H);
    const detail = TripDetail.parse(res.body);
    const raw = res.body as { members: Record<string, unknown>[] };
    for (const m of raw.members) {
      expect(Object.keys(m).sort()).toEqual(
        ['joinedAt', 'name', 'role', 'status', 'submitted', 'userId'].sort(),
      );
    }
    expect(detail.members.map((m) => m.submitted)).toEqual([true, true]);
  });

  it('the invitation preview has no budgets, dates, member names or emails', async () => {
    const res = await request(app).get(`/api/invitations/${token}`).set(H);
    expect(res.status).toBe(200);
    const text = res.text;
    for (const p of people) {
      for (const secret of [...p.secrets, p.email]) expect(text).not.toContain(secret);
    }
    expect(text).not.toContain('48000');
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(text).not.toContain('Leak Rohan');
    expect(text).not.toContain('@');
    // The organiser's name is the one name it may carry.
    expect(text).toContain('Leak Asha');
  });
});

// S2-6 (R10, 0004 i): recommendation responses. Two members with values only
// one of them chose, and a group cap set by members' maxima (not the trip
// budget), so the diagnostic's F5 figures would carry the lowest member
// maximum if they were not rounded. Numbers are compared as values, not as
// text, so a short secret can never match inside an id.
describe('recommendation responses hold no other member’s answers or exact budget', () => {
  const numbersIn = (value: unknown): number[] => {
    if (typeof value === 'number') return [value];
    if (Array.isArray(value)) return value.flatMap(numbersIn);
    if (value !== null && typeof value === 'object') return Object.values(value).flatMap(numbersIn);
    return [];
  };
  const recPrefs = (over: Record<string, unknown>) => ({
    climate: 'mild',
    travelStyle: 'comfort',
    dateStart: '2026-11-13',
    dateEnd: '2026-11-16',
    ...over,
  });
  // B's private figures: odd values, and what an unrounded cap would be.
  const B_MIN = 1997;
  const B_MAX = 3003;
  const B_SECRETS = [B_MIN, B_MAX, 2 * B_MAX];

  let a: Awaited<ReturnType<typeof createTestUser>>;
  let b: Awaited<ReturnType<typeof createTestUser>>;
  let recTripId: string;

  beforeAll(async () => {
    await ensureHubAt(db, 'leak-hub', 10, 77);
    for (const [slug, lat, lng] of [
      ['leak-a', 10.3, 77],
      ['leak-b', 10, 77.4],
      ['leak-c', 9.7, 77],
    ] as const) {
      await ensureDestination(db, { slug, lat, lng });
    }
    a = await createTestUser(app, 'Leak Rec A');
    b = await createTestUser(app, 'Leak Rec B');
    recTripId = (
      await createTripAs(a.agent, {
        originHubSlug: 'leak-hub',
        radiusKm: 150,
        budgetTotalInr: 900000,
        durationNights: 2,
      })
    ).id;
    const recToken = InvitationResponse.parse(
      (await a.agent.post(`/api/trips/${recTripId}/invitations`).set(H).send({})).body,
    ).token;
    await b.agent.post(`/api/invitations/${recToken}/accept`).set(H).send({});
    await a.agent
      .put(`/api/trips/${recTripId}/preferences/me`)
      .set(H)
      .send(
        recPrefs({
          destinationTypes: ['mountain', 'adventure'],
          activities: ['trekking', 'rafting'],
          budgetMinInr: 1000,
          budgetMaxInr: 9001,
        }),
      );
    await b.agent
      .put(`/api/trips/${recTripId}/preferences/me`)
      .set(H)
      .send(
        recPrefs({
          destinationTypes: ['mountain', 'lake'],
          activities: ['trekking', 'boating'],
          budgetMinInr: B_MIN,
          budgetMaxInr: B_MAX,
        }),
      );
    const run = await a.agent.post(`/api/trips/${recTripId}/recommendations`).set(H).send({});
    expect(run.status, JSON.stringify(run.body)).toBe(200);
  });

  it('the fixture really produces F5 near misses against a cap set by members', async () => {
    const body = LatestRecommendationResponse.parse(
      (await a.agent.get(`/api/trips/${recTripId}/recommendations/latest`).set(H)).body,
    );
    const f5 = body.run!.diagnostic!.nearMisses.flatMap((e) =>
      e.failures.filter((f) => f.id === 'F5'),
    );
    expect(f5.length).toBeGreaterThan(0);
    for (const failure of f5) {
      // D1, #116: with 2 members even the rounded cap (2 x B's maximum rounded
      // down, 6000) gives B away, so the limit and the gap are left out.
      expect(failure).toMatchObject({ limit: null, relaxation: null, relative: null });
      expect(failure.actual).toBeGreaterThan(0);
    }
    expect(body.run!.groupProfile).toMatchObject({
      budgetBand: { minInr: null, maxInr: null, overlaps: true },
      perPersonCapInr: null,
      groupCapInr: null,
    });
  });

  it.each(['recommendations/latest', 'group-profile'])(
    "%s: A sees none of B's own values, B none of A's; group lists count 2 or more",
    async (path) => {
      const asA = await a.agent.get(`/api/trips/${recTripId}/${path}`).set(H);
      const asB = await b.agent.get(`/api/trips/${recTripId}/${path}`).set(H);
      expect([asA.status, asB.status]).toEqual([200, 200]);
      for (const onlyB of ['boating', 'lake']) expect(asA.text).not.toContain(onlyB);
      for (const onlyA of ['rafting', 'adventure']) expect(asB.text).not.toContain(onlyA);

      const numbers = numbersIn(asA.body);
      for (const secret of B_SECRETS)
        expect(numbers, `${path} carried ${secret}`).not.toContain(secret);

      const profile =
        path === 'group-profile'
          ? GroupProfileResponse.parse(asA.body)
          : LatestRecommendationResponse.parse(asA.body).run!.groupProfile;
      if (!profile.ready) throw new Error('group profile should be ready');
      for (const v of [...profile.typeVotes, ...profile.activityVotes, ...profile.climateVotes]) {
        expect(v.count).toBeGreaterThanOrEqual(2);
      }
      expect(profile.otherInterestCount).toBe(4);
      if (path === 'recommendations/latest') {
        for (const item of LatestRecommendationResponse.parse(asA.body).items) {
          for (const v of [...item.group.sharedTypes, ...item.group.sharedActivities]) {
            expect(v.count).toBeGreaterThanOrEqual(2);
          }
        }
      }
    },
  );
});

// S3-3: members see aggregate opinion counts and only their own `mine`, never
// another member's vote, name, email or id.
describe('package responses hold opinion counts and only the caller’s own vote', () => {
  it('two members with different votes see the counts but not each other', async () => {
    // A small fixture destination that produces packages.
    const hub = await ensureHubAt(db, 'leak-hub', 32, 85);
    const destId = await ensureDestination(db, { slug: 'leak-dest', lat: 32.2, lng: 85 });
    await ensureDestination(db, { slug: 'leak-dest2', lat: 32.3, lng: 85 });
    await ensureDestination(db, { slug: 'leak-dest3', lat: 32.4, lng: 85 });
    for (const [id, fare] of [[destId, 400] as const, [destId, 400] as const]) {
      await db
        .insert(fareFallback)
        .values({
          originHubId: hub.id,
          destinationId: id,
          mode: 'bus',
          farePerPersonInr: fare,
          durationMinutes: 300,
          distanceKm: 90,
          collectedOn: '2026-10-12',
          reviewStatus: 'verified',
        })
        .onConflictDoNothing();
    }
    const destId2 = await db.query.destination.findFirst({
      where: (d, { eq }) => eq(d.slug, 'leak-dest2'),
    });
    const destId3 = await db.query.destination.findFirst({
      where: (d, { eq }) => eq(d.slug, 'leak-dest3'),
    });
    for (const id of [destId2!.id, destId3!.id]) {
      await db
        .insert(fareFallback)
        .values({
          originHubId: hub.id,
          destinationId: id,
          mode: 'bus',
          farePerPersonInr: 350,
          durationMinutes: 300,
          distanceKm: 100,
          collectedOn: '2026-10-12',
          reviewStatus: 'verified',
        })
        .onConflictDoNothing();
    }
    await db
      .insert(poi)
      .values({
        destinationId: destId,
        poiKey: 'fort',
        name: 'Fort',
        category: 'sight',
        typicalMinutes: 60,
        closedDays: [],
        entryFeeInr: 0,
        lat: 32.2,
        lng: 85,
        collectedOn: '2026-10-12',
        reviewStatus: 'verified',
      })
      .onConflictDoNothing();

    const asha = await createTestUser(app, 'LeakPkg Asha');
    const rohan = await createTestUser(app, 'LeakPkg Rohan');
    const secrets = { rohan: { name: 'LeakPkg Rohan', email: 'rohan@' } };
    void secrets;
    const trip = await createTripAs(asha.agent, {
      originHubSlug: 'leak-hub',
      radiusKm: 200,
      budgetTotalInr: 120000,
      durationNights: 2,
    });
    const { token } = InvitationResponse.parse(
      (await asha.agent.post(`/api/trips/${trip.id}/invitations`).set(H).send({})).body,
    );
    await rohan.agent.post(`/api/invitations/${token}/accept`).set(H).send({});
    for (const m of [asha, rohan]) {
      const res = await m.agent
        .put(`/api/trips/${trip.id}/preferences/me`)
        .set(H)
        .send(prefs(10000, 40000));
      expect(res.status).toBe(200);
    }
    const run = await asha.agent.post(`/api/trips/${trip.id}/recommendations`).set(H).send({});
    expect(run.status).toBe(200);
    const slug = (run.body as { items: { destination: { slug: string } }[] }).items[0]!.destination
      .slug;
    const chosen = await asha.agent
      .post(`/api/trips/${trip.id}/destination`)
      .set(H)
      .send({ destinationSlug: slug });
    expect(chosen.status, JSON.stringify(chosen.body)).toBe(200);
    const pkg = PackagesResponse.parse(
      (await asha.agent.get(`/api/trips/${trip.id}/packages`).set(H)).body,
    ).packages[0]!;
    await rohan.agent
      .put(`/api/trips/${trip.id}/packages/${pkg.id}/opinion`)
      .set(H)
      .send({ decision: 'reject' });

    const [aGet, aPut, bGet, bPut] = [
      await asha.agent.get(`/api/trips/${trip.id}/packages`).set(H),
      await asha.agent
        .put(`/api/trips/${trip.id}/packages/${pkg.id}/opinion`)
        .set(H)
        .send({ decision: 'accept' }),
      await rohan.agent.get(`/api/trips/${trip.id}/packages`).set(H),
      await rohan.agent
        .put(`/api/trips/${trip.id}/packages/${pkg.id}/opinion`)
        .set(H)
        .send({ decision: 'reject' }),
    ];
    for (const res of [aGet, aPut, bGet, bPut]) expect(res.status).toBe(200);
    const aView = PackagesResponse.parse(aPut.body).packages.find((x) => x.id === pkg.id)!;
    const bView = PackagesResponse.parse(bPut.body).packages.find((x) => x.id === pkg.id)!;
    // Counts are aggregate and shared; `mine` is the caller's only.
    expect(aView.opinions).toMatchObject({ works: 1, notForMe: 1, members: 2 });
    expect(bView.opinions).toMatchObject({ works: 1, notForMe: 1, members: 2 });
    expect(aView.mine).toBe('accept');
    expect(bView.mine).toBe('reject');
    expect(
      PackagesResponse.parse(aGet.body).packages.find((x) => x.id === pkg.id)!.mine,
    ).toBeNull();
    // Nothing in either body names or identifies the other member.
    for (const res of [aGet, aPut]) {
      expect(res.text).not.toContain('LeakPkg Rohan');
      expect(res.text).not.toContain(rohan.userId);
      expect(res.text).not.toContain('reject');
    }
    for (const res of [bGet, bPut]) {
      expect(res.text).not.toContain('LeakPkg Asha');
      expect(res.text).not.toContain(asha.userId);
    }
    for (const res of [aGet, aPut, bGet, bPut]) expect(res.text).not.toContain('@');
  });
});

// S5-2b-1 (V2): T21's response is a TripDetail, so it holds names, roles and
// statuses only; neither the organiser's 200 nor a member's 403 carries the
// other member's budget, email or per-member score.
describe('the "Ask again" response (T21) holds no member data', () => {
  it("neither the organiser's 200 nor the member's 403 carries the other's values", async () => {
    await ensureHubAt(db, 'leak-hub', 32, 85);
    for (const [slug, lat] of [
      ['leak-dest', 32.2],
      ['leak-dest2', 32.3],
      ['leak-dest3', 32.4],
    ] as const) {
      await ensureDestination(db, { slug, lat, lng: 85 });
    }
    const asha = await createTestUser(app, 'LeakT21 Asha');
    const rohan = await createTestUser(app, 'LeakT21 Rohan');
    const trip = await createTripAs(asha.agent, {
      originHubSlug: 'leak-hub',
      radiusKm: 200,
      budgetTotalInr: 120000,
      durationNights: 2,
    });
    const { token: t21Token } = InvitationResponse.parse(
      (await asha.agent.post(`/api/trips/${trip.id}/invitations`).set(H).send({})).body,
    );
    await rohan.agent.post(`/api/invitations/${t21Token}/accept`).set(H).send({});
    const budgets = { asha: [10007, 40009], rohan: [10013, 40031] } as const;
    for (const [m, [min, max]] of [
      [asha, budgets.asha],
      [rohan, budgets.rohan],
    ] as const) {
      const res = await m.agent
        .put(`/api/trips/${trip.id}/preferences/me`)
        .set(H)
        .send(prefs(min, max));
      expect(res.status).toBe(200);
    }
    const run = await asha.agent.post(`/api/trips/${trip.id}/recommendations`).set(H).send({});
    expect(run.status, JSON.stringify(run.body)).toBe(200);
    expect(
      TripDetail.parse((await asha.agent.get(`/api/trips/${trip.id}`).set(H)).body).status,
    ).toBe('shortlisted');

    const denied = await rohan.agent.post(`/api/trips/${trip.id}/reopen-shortlist`).set(H).send({});
    expect(denied.status).toBe(403);
    const reopened = await asha.agent
      .post(`/api/trips/${trip.id}/reopen-shortlist`)
      .set(H)
      .send({});
    expect(reopened.status, JSON.stringify(reopened.body)).toBe(200);
    expect(TripDetail.parse(reopened.body).status).toBe('ready_for_recommendation');

    // No member's budget (not even the caller's own), no email, no score keys.
    for (const res of [reopened, denied]) {
      for (const n of [...budgets.asha, ...budgets.rohan]) {
        expect(res.text).not.toContain(String(n));
      }
      expect(res.text).not.toContain('@');
      expect(res.text).not.toMatch(/"(score|lambda|weight|weights|deficit|deficits)"/);
    }
  });
});

// S5-2b-2 (V2, R17): after two shortlists the second is ranked with fairness
// weights. No body for any caller holds a lambda, a weight or a deficit, and
// items hold the caller's own score only (plus the group's lowest and highest).
describe('after two shortlists no body holds a weight, a deficit or lambda (R17)', () => {
  it('every GET for every caller, and the round 2 POST, as organiser, member and outsider', async () => {
    await ensureHubAt(db, 'leak-hub', 32, 85);
    for (const [slug, lat] of [
      ['leak-dest', 32.2],
      ['leak-dest2', 32.3],
      ['leak-dest3', 32.4],
    ] as const) {
      await ensureDestination(db, { slug, lat, lng: 85 });
    }
    const asha = await createTestUser(app, 'LeakR17 Asha');
    const rohan = await createTestUser(app, 'LeakR17 Rohan');
    const meera = await createTestUser(app, 'LeakR17 Meera');
    const outsider = await createTestUser(app, 'LeakR17 Outsider');
    const trip = await createTripAs(asha.agent, {
      originHubSlug: 'leak-hub',
      radiusKm: 200,
      budgetTotalInr: 120000,
      durationNights: 2,
    });
    const { token: r17Token } = InvitationResponse.parse(
      (await asha.agent.post(`/api/trips/${trip.id}/invitations`).set(H).send({})).body,
    );
    for (const m of [rohan, meera]) {
      await m.agent.post(`/api/invitations/${r17Token}/accept`).set(H).send({});
    }
    // Rohan wants heritage; the fixture places are mountains, so round 1 serves him least.
    const tastes = [
      [asha, 'mountain', 'trekking'],
      [rohan, 'heritage', 'museums'],
      [meera, 'mountain', 'trekking'],
    ] as const;
    for (const [m, type, activity] of tastes) {
      const res = await m.agent
        .put(`/api/trips/${trip.id}/preferences/me`)
        .set(H)
        .send({
          ...prefs(10000, 40000),
          destinationTypes: [type],
          activities: [activity],
          climate: 'mild',
        });
      expect(res.status, JSON.stringify(res.body)).toBe(200);
    }
    const round1 = await asha.agent.post(`/api/trips/${trip.id}/recommendations`).set(H).send({});
    expect(round1.status, JSON.stringify(round1.body)).toBe(200);
    const reopened = await asha.agent
      .post(`/api/trips/${trip.id}/reopen-shortlist`)
      .set(H)
      .send({});
    expect(reopened.status).toBe(200);
    const round2 = await asha.agent.post(`/api/trips/${trip.id}/recommendations`).set(H).send({});
    expect(round2.status, JSON.stringify(round2.body)).toBe(200);
    const body2 = LatestRecommendationResponse.parse(round2.body);
    expect(body2.run).toMatchObject({ round: 2, kind: 'shortlist', favoursLessServed: true });

    const forbiddenKeys = /"(lambda|weight|deficit|deficits|memberWeights|fairnessWeights)"/;
    const members = await db.query.tripMember.findMany({
      where: (t, { eq }) => eq(t.tripId, trip.id),
    });
    const memberIds = members.map((m) => m.id);
    const gets = ENDPOINTS.filter((e) => e.method === 'GET').map((e) =>
      e.path.replace(':id', trip.id).replace(':token', r17Token),
    );
    for (const [who, agent] of [
      ['Asha', asha.agent],
      ['Rohan', rohan.agent],
      ['Meera', meera.agent],
      ['Outsider', outsider.agent],
      ['anonymous', null],
    ] as const) {
      const responses = [
        ...(who === 'Asha' ? [{ path: 'POST recommendations', text: round2.text }] : []),
        ...(await Promise.all(
          gets.map(async (path) => ({
            path,
            text: (await (agent ?? request(app)).get(path).set(H)).text,
          })),
        )),
      ];
      for (const { path, text } of responses) {
        expect(text, `${path} as ${who}`).not.toMatch(forbiddenKeys);
        // Per-member rows stay in the database: no trip_member id, no member list of scores.
        for (const id of memberIds) expect(text, `${path} as ${who}`).not.toContain(id);
        expect(text, `${path} as ${who}`).not.toMatch(/"(tripMemberId|memberScores)"/);
      }
    }
    // The run's public GFS weights are the configured alpha, beta and gamma only.
    expect(Object.keys(body2.run!.weights).sort()).toEqual(['alpha', 'beta', 'gamma']);
    // Each member's latest view: items carry the caller's own score and the group range only.
    for (const m of [asha, rohan, meera]) {
      const res = await m.agent.get(`/api/trips/${trip.id}/recommendations/latest`).set(H);
      for (const item of (res.body as { items: Record<string, unknown>[] }).items) {
        expect(Object.keys(item).sort()).toEqual(
          [
            'cheapestMode',
            'destination',
            'distanceKm',
            'distanceProvenance',
            'estimatedCostInr',
            'gfs',
            'group',
            'mean',
            'min',
            'mine',
            'perPersonInr',
            'rank',
            'sd',
          ].sort(),
        );
        expect(Object.keys(item.mine as object).sort()).toEqual(
          [
            'climateMet',
            'metActivities',
            'metTypes',
            'missedActivities',
            'missedTypes',
            'score10',
          ].sort(),
        );
      }
    }
  });
});

// S5-3 (V2, E3): notifications carry the trip id, title and the type's own
// fields only. After a join, a reminder, T3b, a shortlist and "Ask again", no
// body holds a budget, an email, a score or an answer, and nobody can read, or
// even confirm, another user's notification (404, not 403). The notifications
// test covers all nine types the same way.
describe('notifications hold no preference, budget, score or email', () => {
  it('each caller reads only their own, with nothing private in them', async () => {
    await ensureHubAt(db, 'leak-hub', 32, 85);
    for (const [slug, lat] of [
      ['leak-dest', 32.2],
      ['leak-dest2', 32.3],
      ['leak-dest3', 32.4],
    ] as const) {
      await ensureDestination(db, { slug, lat, lng: 85 });
    }
    const asha = await createTestUser(app, 'LeakNote Asha');
    const rohan = await createTestUser(app, 'LeakNote Rohan');
    const meera = await createTestUser(app, 'LeakNote Meera');
    const trip = await createTripAs(asha.agent, {
      originHubSlug: 'leak-hub',
      radiusKm: 200,
      budgetTotalInr: 120000,
      durationNights: 2,
    });
    const { token: noteToken } = InvitationResponse.parse(
      (await asha.agent.post(`/api/trips/${trip.id}/invitations`).set(H).send({})).body,
    );
    for (const m of [rohan, meera]) {
      await m.agent.post(`/api/invitations/${noteToken}/accept`).set(H).send({});
    }
    // Meera is reminded, never submits and is left out by T3b.
    const reminded = await asha.agent
      .post(`/api/trips/${trip.id}/members/${meera.userId}/remind`)
      .set(H)
      .send({});
    expect(reminded.status, JSON.stringify(reminded.body)).toBe(201);
    const budgets = { asha: [10019, 40021], rohan: [10039, 40043] } as const;
    for (const [m, [min, max]] of [
      [asha, budgets.asha],
      [rohan, budgets.rohan],
    ] as const) {
      const res = await m.agent
        .put(`/api/trips/${trip.id}/preferences/me`)
        .set(H)
        .send(prefs(min, max));
      expect(res.status).toBe(200);
    }
    for (const step of ['close-submissions', 'recommendations', 'reopen-shortlist']) {
      const res = await asha.agent.post(`/api/trips/${trip.id}/${step}`).set(H).send({});
      expect(res.status, `${step}: ${JSON.stringify(res.body)}`).toBe(200);
    }

    const everyone = [asha, rohan, meera];
    const all = Object.values(budgets).flat();
    const bodies = new Map<string, { items: { id: string; message: string }[] }>();
    for (const p of everyone) {
      const res = await p.agent.get('/api/notifications').set(H);
      expect(res.status).toBe(200);
      for (const q of everyone) {
        expect(res.text).not.toContain(q.email);
        // Actors are stored by user id and named on read; the id never leaves.
        expect(res.text).not.toContain(q.userId);
      }
      expect(res.text).not.toContain('@');
      expect(res.text).not.toMatch(/"(score|lambda|weight|deficit|budget\w*|email|vote)"/i);
      const body = res.body as { items: { id: string; message: string; tripTitle: string }[] };
      for (const item of body.items) {
        for (const b of all) expect(`${item.message} ${item.tripTitle}`).not.toContain(String(b));
      }
      bodies.set(p.userId, body);
    }
    // Rohan: T3b, shortlist_ready, shortlist_reopened. Meera: a reminder, then left out.
    // This app's clock is fixed, so notifications share a time and are compared sorted.
    const messages = (p: { userId: string }) =>
      bodies
        .get(p.userId)!
        .items.map((i) => i.message)
        .sort();
    expect(messages(rohan)).toEqual(
      [
        'LeakNote Asha asked for new recommendations',
        'A shortlist of destinations is ready',
        'Preferences are closed. The trip is ready for recommendations',
      ].sort(),
    );
    expect(messages(meera)).toEqual(
      [
        'You were not included because preferences closed before you submitted',
        'LeakNote Asha asked you to add your preferences',
      ].sort(),
    );

    // Someone else's notification: 404, the same as a made-up id.
    const meerasId = bodies.get(meera.userId)!.items[0]!.id;
    const peek = await rohan.agent.post(`/api/notifications/${meerasId}/read`).set(H).send({});
    expect(peek.status).toBe(404);
    expect(peek.text).not.toContain(meerasId);
  });

  // S5-3 part 2: canRemindAt tells the organiser whom they reminded and when, so
  // it is theirs alone: the reminded member, another member and a removed member
  // read the same trip without it.
  it('canRemindAt reaches only the organiser, never a member or an excluded member', async () => {
    await ensureHubAt(db, 'leak-hub', 32, 85);
    const asha = await createTestUser(app, 'LeakRemind Asha');
    const rohan = await createTestUser(app, 'LeakRemind Rohan');
    const meera = await createTestUser(app, 'LeakRemind Meera');
    const dev = await createTestUser(app, 'LeakRemind Dev');
    const trip = await createTripAs(asha.agent, { originHubSlug: 'leak-hub', durationNights: 2 });
    const { token: remindToken } = InvitationResponse.parse(
      (await asha.agent.post(`/api/trips/${trip.id}/invitations`).set(H).send({})).body,
    );
    for (const m of [rohan, meera, dev]) {
      await m.agent.post(`/api/invitations/${remindToken}/accept`).set(H).send({});
    }
    expect(
      (await asha.agent.delete(`/api/trips/${trip.id}/members/${dev.userId}`).set(H)).status,
    ).toBe(204);
    const sent = await asha.agent
      .post(`/api/trips/${trip.id}/members/${meera.userId}/remind`)
      .set(H)
      .send({});
    expect(sent.status, JSON.stringify(sent.body)).toBe(201);

    const memberKeys = ['joinedAt', 'name', 'role', 'status', 'submitted', 'userId'].sort();
    for (const [who, caller] of [
      ['a member', rohan],
      ['the member reminded', meera],
      ['an excluded member', dev],
    ] as const) {
      const res = await caller.agent.get(`/api/trips/${trip.id}`).set(H);
      expect(res.status, who).toBe(200);
      expect(res.text, who).not.toContain('canRemindAt');
      for (const m of (res.body as { members: Record<string, unknown>[] }).members) {
        expect(Object.keys(m).sort(), who).toEqual(memberKeys);
      }
    }

    // The organiser does read it, on the two members still pending.
    const organiserView = TripDetail.parse(
      (await asha.agent.get(`/api/trips/${trip.id}`).set(H)).body,
    );
    const canRemind = (userId: string) =>
      organiserView.members.find((m) => m.userId === userId)?.canRemindAt;
    expect(canRemind(rohan.userId)).toBeNull();
    expect(canRemind(meera.userId)).toEqual(expect.any(String));
    expect(canRemind(dev.userId)).toBeUndefined();
    expect(canRemind(asha.userId)).toBeUndefined();
  });
});

// S4-3, D1 (#116): with fewer than 3 contributing members, nothing a member
// can read carries the budget band's figures, or anything from which the other
// member's minimum or maximum follows. Budgets are multiples of ₹500, so the
// raw and the rounded figure are the same number.
describe('two-member groups: no budget figure gives the other member away (D1, #116)', () => {
  const numbersIn = (value: unknown): number[] => {
    if (typeof value === 'number') return [value];
    if (Array.isArray(value)) return value.flatMap(numbersIn);
    if (value !== null && typeof value === 'object') return Object.values(value).flatMap(numbersIn);
    return [];
  };
  const twoPrefs = (min: number, max: number) => ({
    destinationTypes: ['mountain'],
    activities: ['trekking'],
    climate: 'mild',
    travelStyle: 'comfort',
    budgetMinInr: min,
    budgetMaxInr: max,
    dateStart: '2026-11-13',
    dateEnd: '2026-11-16',
  });
  // The organiser 18,000 to 30,000, the member 12,500 to 22,000. (12,000 would
  // collide with the premium-stay line, 6,000 x 1 room x 2 nights.)
  const ORG = { min: 18000, max: 30000 };
  const MEM = { min: 12500, max: 22000 };

  async function twoMemberTrip(budgetTotalInr: number) {
    await ensureHubAt(db, 'two-hub', 12, 79);
    // One cheap place passes; two whose food alone (2 people x 3 days) is over
    // any cap here fail F5, so the run is a diagnostic with budget near misses.
    await ensureDestination(db, { slug: 'two-cheap', lat: 12.2, lng: 79 });
    await ensureDestination(db, { slug: 'two-dear-1', lat: 12, lng: 79.3, foodPerDayInr: 9100 });
    await ensureDestination(db, { slug: 'two-dear-2', lat: 11.8, lng: 79, foodPerDayInr: 9700 });
    const org = await createTestUser(app, 'Two Org');
    const mem = await createTestUser(app, 'Two Mem');
    const id = (
      await createTripAs(org.agent, {
        originHubSlug: 'two-hub',
        radiusKm: 150,
        budgetTotalInr,
        durationNights: 2,
      })
    ).id;
    const tok = InvitationResponse.parse(
      (await org.agent.post(`/api/trips/${id}/invitations`).set(H).send({})).body,
    ).token;
    await mem.agent.post(`/api/invitations/${tok}/accept`).set(H).send({});
    await org.agent.put(`/api/trips/${id}/preferences/me`).set(H).send(twoPrefs(ORG.min, ORG.max));
    await mem.agent.put(`/api/trips/${id}/preferences/me`).set(H).send(twoPrefs(MEM.min, MEM.max));
    const run = await org.agent.post(`/api/trips/${id}/recommendations`).set(H).send({});
    expect(run.status, JSON.stringify(run.body)).toBe(200);
    return { id, tok, org, mem };
  }

  /** Every GET in the inventory, for this trip, as this member. */
  async function everyGet(agent: Agent, id: string, tok: string) {
    const out: { path: string; body: unknown }[] = [];
    for (const e of GETS) {
      const res = await agent.get(e.path.replace(':id', id).replace(':token', tok)).set(H);
      out.push({ path: e.path, body: res.body });
    }
    return out;
  }

  it('a member-set cap: neither member reads the other’s minimum, maximum or the cap', async () => {
    // 2 x 22,000 = 44,000 is under the trip budget, so the members set the cap.
    const { id, tok, org, mem } = await twoMemberTrip(100000);
    const views = [
      { who: 'organiser', agent: org.agent, other: [MEM.min, MEM.max] },
      { who: 'member', agent: mem.agent, other: [ORG.min, ORG.max] },
    ];
    for (const { who, agent, other } of views) {
      for (const { path, body } of await everyGet(agent, id, tok)) {
        const numbers = numbersIn(body);
        for (const secret of [...other, 2 * MEM.max]) {
          expect.soft(numbers, `${who} ${path} carried ${secret}`).not.toContain(secret);
        }
      }
      // A closest miss's gap gives the cap back: actual - relaxation.
      const latest = LatestRecommendationResponse.parse(
        (await agent.get(`/api/trips/${id}/recommendations/latest`).set(H)).body,
      );
      const f5 = (latest.run?.diagnostic?.nearMisses ?? []).flatMap((e) =>
        e.failures.filter((f) => f.id === 'F5'),
      );
      expect(f5.length, 'the fixture should produce F5 near misses').toBeGreaterThan(0);
      for (const f of f5) {
        if (f.relaxation !== null) {
          expect(f.actual - f.relaxation, `${who}: actual - relaxation`).not.toBe(2 * MEM.max);
        }
      }
    }
  });

  it('a member-set cap through to packages: an over-budget package carries no amount', async () => {
    const hubRow = await ensureHubAt(db, 'twopkg-hub', 14, 81);
    // Three places pass the 44,000 cap; on the dear one (2 x 3 days of food
    // at 6,000) the budget-stay package fits and the mid-stay one does not.
    const ids: string[] = [];
    for (const [slug, lat, food] of [
      ['twopkg-dear', 14.2, 6000],
      ['twopkg-b', 14.3, 500],
      ['twopkg-c', 14.4, 500],
    ] as const) {
      ids.push(await ensureDestination(db, { slug, lat, lng: 81, foodPerDayInr: food }));
    }
    for (const destinationId of ids) {
      await db
        .insert(fareFallback)
        .values({
          originHubId: hubRow.id,
          destinationId,
          mode: 'bus',
          farePerPersonInr: 350,
          durationMinutes: 300,
          distanceKm: 100,
          collectedOn: '2026-10-12',
          reviewStatus: 'verified',
        })
        .onConflictDoNothing();
    }
    const org = await createTestUser(app, 'TwoPkg Org');
    const mem = await createTestUser(app, 'TwoPkg Mem');
    const id = (
      await createTripAs(org.agent, {
        originHubSlug: 'twopkg-hub',
        radiusKm: 200,
        budgetTotalInr: 100000,
        durationNights: 2,
      })
    ).id;
    const tok = InvitationResponse.parse(
      (await org.agent.post(`/api/trips/${id}/invitations`).set(H).send({})).body,
    ).token;
    await mem.agent.post(`/api/invitations/${tok}/accept`).set(H).send({});
    await org.agent.put(`/api/trips/${id}/preferences/me`).set(H).send(twoPrefs(ORG.min, ORG.max));
    await mem.agent.put(`/api/trips/${id}/preferences/me`).set(H).send(twoPrefs(MEM.min, MEM.max));
    const run = await org.agent.post(`/api/trips/${id}/recommendations`).set(H).send({});
    expect(run.status, JSON.stringify(run.body)).toBe(200);
    const chosen = await org.agent
      .post(`/api/trips/${id}/destination`)
      .set(H)
      .send({ destinationSlug: 'twopkg-dear' });
    expect(chosen.status, JSON.stringify(chosen.body)).toBe(200);

    const pkgs = PackagesResponse.parse(
      (await mem.agent.get(`/api/trips/${id}/packages`).set(H)).body,
    ).packages;
    const over = pkgs.filter((p) => p.overBudget);
    expect(over.length, 'the fixture should have an over-budget package').toBeGreaterThan(0);
    for (const p of pkgs) expect(p.overByInr).toBeNull();

    for (const [who, agent, other] of [
      ['organiser', org.agent, [MEM.min, MEM.max]],
      ['member', mem.agent, [ORG.min, ORG.max]],
    ] as const) {
      for (const { path, body } of await everyGet(agent, id, tok)) {
        const numbers = numbersIn(body);
        for (const secret of [...other, 2 * MEM.max]) {
          expect.soft(numbers, `${who} ${path} carried ${secret}`).not.toContain(secret);
        }
      }
    }
  });

  it('a trip-set cap: the cap is the public trip budget; the band and caps are null', async () => {
    // 30,000 is under 2 x 22,000, so the trip budget sets the cap.
    const { id, org, mem } = await twoMemberTrip(30000);
    for (const agent of [org.agent, mem.agent]) {
      const profile = GroupProfileResponse.parse(
        (await agent.get(`/api/trips/${id}/group-profile`).set(H)).body,
      );
      if (!profile.ready) throw new Error('group profile should be ready');
      expect(profile.budgetBand).toEqual({ minInr: null, maxInr: null, overlaps: true });
      expect(profile.perPersonCapInr).toBeNull();
      expect(profile.groupCapInr).toBe(30000);
    }
  });
});

// S3-6: the day plan holds no member data — no names, emails, ids or budgets.
describe('itinerary responses hold no member data', () => {
  /** Two members plan a day plan on `appUnderTest`; returns the POST and the member GET. */
  async function planLeakTrip(appUnderTest: Parameters<typeof createTestUser>[0]) {
    const asha = await createTestUser(appUnderTest, 'LeakIt Asha');
    const rohan = await createTestUser(appUnderTest, 'LeakIt Rohan');
    const hub = await ensureHubAt(db, 'leakit-hub', 33, 85);
    const destId = await ensureDestination(db, { slug: 'leakit-dest', lat: 33.2, lng: 85 });
    for (const [id, fare] of [[destId, 400]] as const) {
      await db
        .insert(fareFallback)
        .values({
          originHubId: hub.id,
          destinationId: id,
          mode: 'bus',
          farePerPersonInr: fare,
          durationMinutes: 300,
          distanceKm: 90,
          collectedOn: '2026-10-12',
          reviewStatus: 'verified',
        })
        .onConflictDoNothing();
    }
    for (const slug of ['leakit-dest2', 'leakit-dest3']) {
      const id = await ensureDestination(db, { slug, lat: 33.3, lng: 85 });
      await db
        .insert(fareFallback)
        .values({
          originHubId: hub.id,
          destinationId: id,
          mode: 'bus',
          farePerPersonInr: 350,
          durationMinutes: 300,
          distanceKm: 100,
          collectedOn: '2026-10-12',
          reviewStatus: 'verified',
        })
        .onConflictDoNothing();
    }
    await db
      .insert(poi)
      .values({
        destinationId: destId,
        poiKey: 'fort',
        name: 'Fort',
        category: 'sight',
        typicalMinutes: 60,
        closedDays: [],
        entryFeeInr: 0,
        lat: 33.2,
        lng: 85,
        collectedOn: '2026-10-12',
        reviewStatus: 'verified',
      })
      .onConflictDoNothing();

    const trip = await createTripAs(asha.agent, {
      originHubSlug: 'leakit-hub',
      radiusKm: 200,
      budgetTotalInr: 120000,
      durationNights: 2,
    });
    const { token } = InvitationResponse.parse(
      (await asha.agent.post(`/api/trips/${trip.id}/invitations`).set(H).send({})).body,
    );
    await rohan.agent.post(`/api/invitations/${token}/accept`).set(H).send({});
    for (const m of [asha, rohan]) {
      expect(
        (await m.agent.put(`/api/trips/${trip.id}/preferences/me`).set(H).send(prefs(10000, 40000)))
          .status,
      ).toBe(200);
    }
    await asha.agent.post(`/api/trips/${trip.id}/recommendations`).set(H).send({});
    // Other tests' destinations can sit inside this radius: choose one of
    // this fixture's own, the only ones with fare rows from leakit-hub.
    const slug = LatestRecommendationResponse.parse(
      (await asha.agent.get(`/api/trips/${trip.id}/recommendations/latest`).set(H)).body,
    ).items.find((i) => i.destination.slug.startsWith('leakit-dest'))!.destination.slug;
    await asha.agent
      .post(`/api/trips/${trip.id}/destination`)
      .set(H)
      .send({ destinationSlug: slug });
    const pkgs = PackagesResponse.parse(
      (await asha.agent.get(`/api/trips/${trip.id}/packages`).set(H)).body,
    ).packages;
    await asha.agent.post(`/api/trips/${trip.id}/packages/${pkgs[0]!.id}/select`).set(H).send({});
    const plan = await asha.agent.post(`/api/trips/${trip.id}/itinerary`).set(H).send({});
    expect(plan.status, JSON.stringify(plan.body)).toBe(200);
    const get = await rohan.agent.get(`/api/trips/${trip.id}/itinerary`).set(H);
    expect(get.status).toBe(200);
    return { asha, rohan, plan, get };
  }

  it('the itinerary body and the fixture prompt carry nothing personal', async () => {
    const { asha, rohan, plan, get } = await planLeakTrip(app);
    const view = ItineraryResponse.parse(get.body).itinerary!;
    expect(view.days.length).toBeGreaterThan(0);
    for (const res of [plan, get]) {
      expect(res.text).not.toContain('LeakIt Asha');
      expect(res.text).not.toContain('LeakIt Rohan');
      expect(res.text).not.toContain(asha.userId);
      expect(res.text).not.toContain(rohan.userId);
      expect(res.text).not.toContain('@');
      expect(res.text).not.toContain('40000');
    }
  });

  // #121: the model cache stores a hash of the request, never the prompt, so
  // no row can hold a member's name, email, id or budget.
  it('llm_cache rows written while planning carry nothing personal', async () => {
    const provider = `gemini-leak-${randomUUID().slice(0, 8)}`;
    const llm = createGuardedLlmClient(
      new FixtureLlmClient({
        ItineraryWording: {
          summary: 'Two easy days.',
          reasons: ['It fits the group.'],
          notes: [{ day: 1, index: 0, note: 'An unhurried start.' }],
        },
      }),
      { db, provider, dailyLimit: 5, clock: () => new Date('2026-11-01T06:30:00Z') },
    );
    const withModel = createApp({
      db,
      pool,
      logger: pino({ level: 'silent' }),
      auth,
      clock: () => new Date('2026-11-01T06:30:00Z'),
      llm,
    });
    const { asha, rohan, plan } = await planLeakTrip(withModel);
    expect(ItineraryResponse.parse(plan.body).itinerary?.source).toBe('model');
    const rows = await db.select().from(llmCache).where(eq(llmCache.provider, provider));
    expect(rows).toHaveLength(1);
    const text = JSON.stringify(rows);
    for (const secret of [
      'LeakIt Asha',
      'LeakIt Rohan',
      asha.userId,
      rohan.userId,
      asha.email,
      rohan.email,
      '10000',
      '40000',
    ]) {
      expect(text, secret).not.toContain(secret);
    }
    expect(text).not.toContain('@');
  });
});
