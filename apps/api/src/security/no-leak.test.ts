import { createDb } from '@bonvoyage/db';
import { fareFallback, poi } from '@bonvoyage/db/schema';
import { pino } from 'pino';
import {
  GroupProfileResponse,
  InvitationResponse,
  LatestRecommendationResponse,
  TripDetail,
} from '@bonvoyage/shared';
import request from 'supertest';
import { PackagesResponse } from '@bonvoyage/shared';
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
      // n x (B's maximum rounded down to ₹500), never n x B's exact maximum.
      expect(failure.limit).toBe(6000);
      expect(failure.relaxation).toBe(failure.actual - 6000);
      expect(failure.relative).toBeCloseTo((failure.actual - 6000) / 6000, 12);
    }
    expect(body.run!.groupProfile).toMatchObject({
      budgetBand: { minInr: 2000, maxInr: 3000, overlaps: true },
      perPersonCapInr: 3000,
      groupCapInr: 6000,
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
    const hub = await ensureHubAt(db, 'leak-hub', 15, 78);
    const destId = await ensureDestination(db, { slug: 'leak-dest', lat: 15.2, lng: 78 });
    await ensureDestination(db, { slug: 'leak-dest2', lat: 15.3, lng: 78 });
    await ensureDestination(db, { slug: 'leak-dest3', lat: 15.4, lng: 78 });
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
        lat: 15.2,
        lng: 78,
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
