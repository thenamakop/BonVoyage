import { resolve } from 'node:path';
import { createDb, importCatalogue } from '@bonvoyage/db';
import { recommendationRun } from '@bonvoyage/db/schema';
import { estimateRoadKm } from '@bonvoyage/engine';
import {
  ActivityResponse,
  GroupProfileResponse,
  InvitationResponse,
  LatestRecommendationResponse,
  RequestRecommendationsResponse,
  TripDetail,
  type ErrorEnvelope,
  type PreferenceInput,
} from '@bonvoyage/shared';
import { eq } from 'drizzle-orm';
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
  type FixtureDestination,
} from '../test/helpers';
import type { RecommendationHooks } from './service';

// S2-6 step 5: recommendation runs (T4, T6>T7, T6>T8), staleness, a second
// round and the destination choice (T9), against a small fixture catalogue
// around a hub far from the real one (so real destinations, when another test
// file has imported them, fail F1 by hundreds of kilometres and never rank).

const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const auth = createAuth({
  db,
  secret: 'test-secret-test-secret-test-secret',
  baseURL: { allowedHosts: ['localhost:5173', 'localhost:4000', '*.vercel.app'] },
});
const hooks: RecommendationHooks = {};
const app = createApp({
  db,
  pool,
  logger: pino({ level: 'silent' }),
  auth,
  clock: () => new Date('2026-11-01T06:30:00Z'),
  scoringWeights: { alpha: 0.5, beta: 0.3, gamma: 0.2 },
  recommendationHooks: hooks,
});
const H = { Host: 'localhost:5173', Origin: 'http://localhost:5173' };

const HUB = { slug: 'rec-hub', lat: 12, lng: 77 };
const DESTINATIONS: FixtureDestination[] = [
  {
    slug: 'rec-a',
    lat: 12.5,
    lng: 77,
    types: ['mountain', 'adventure'],
    activities: ['trekking', 'camping'],
    climate: 'mild',
  },
  {
    slug: 'rec-b',
    lat: 12,
    lng: 77.6,
    types: ['mountain'],
    activities: ['trekking'],
    climate: 'cold',
  },
  {
    slug: 'rec-c',
    lat: 11.5,
    lng: 77,
    types: ['heritage', 'city'],
    activities: ['museums'],
    climate: 'warm',
  },
  { slug: 'rec-far', lat: 13.5, lng: 77, types: ['mountain'], activities: ['trekking'] },
  { slug: 'rec-incomplete', lat: 12.2, lng: 77.2, stayBudgetInr: null },
];
const roadKm = (slug: string) => {
  const d = DESTINATIONS.find((x) => x.slug === slug)!;
  return estimateRoadKm(HUB, d).distanceKm;
};

type Agent = request.Agent;
interface Member {
  agent: Agent;
  userId: string;
}

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

/**
 * A trip from the fixture hub whose members all submit, so it reaches
 * ready_for_recommendation through T3. The organiser is members[0].
 */
async function readyTrip(
  memberPrefs: PreferenceInput[],
  trip: { radiusKm?: number; budgetTotalInr?: number; durationNights?: number } = {},
): Promise<{ tripId: string; members: Member[] }> {
  const members: Member[] = [];
  for (const [i] of memberPrefs.entries()) {
    members.push(await createTestUser(app, `Rec Member ${i}`));
  }
  const organiser = members[0]!;
  const { id: tripId } = await createTripAs(organiser.agent, {
    originHubSlug: HUB.slug,
    radiusKm: trip.radiusKm ?? 150,
    budgetTotalInr: trip.budgetTotalInr ?? 120000,
    durationNights: trip.durationNights ?? 2,
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
      .send(memberPrefs[i]);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
  }
  return { tripId, members };
}

const recommend = (m: Member, tripId: string) =>
  m.agent.post(`/api/trips/${tripId}/recommendations`).set(H).send({});
const latest = async (m: Member, tripId: string) =>
  LatestRecommendationResponse.parse(
    (await m.agent.get(`/api/trips/${tripId}/recommendations/latest`).set(H)).body,
  );
const tripOf = async (m: Member, tripId: string) =>
  TripDetail.parse((await m.agent.get(`/api/trips/${tripId}`).set(H)).body);

beforeAll(async () => {
  await ensureHubAt(db, HUB.slug, HUB.lat, HUB.lng);
  await ensureCostRules(db);
  for (const d of DESTINATIONS) await ensureDestination(db, d);
});

afterAll(async () => {
  await pool.end();
});

describe('POST /api/trips/:id/recommendations', () => {
  it('3 members: T6>T7, a ranked shortlist, round 1, weights stored, private explanations', async () => {
    const { tripId, members } = await readyTrip([
      prefs({ destinationTypes: ['mountain', 'adventure'], activities: ['trekking', 'camping'] }),
      prefs({ destinationTypes: ['mountain'], activities: ['trekking'], climate: 'cold' }),
      prefs({ destinationTypes: ['heritage'], activities: ['museums'], climate: 'warm' }),
    ]);
    const [organiser, second] = members as [Member, Member, Member];
    // A liked past trip to a catalogue destination feeds the weighted types.
    await second.agent
      .post('/api/me/past-trips')
      .set(H)
      .send({ destinationSlug: 'rec-c', rating: 5 });

    const res = await recommend(organiser, tripId);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const body = RequestRecommendationsResponse.parse(res.body);
    expect(body.transition).toEqual({ transitionId: 'T6>T7', to: 'shortlisted' });
    expect(body.run).toMatchObject({
      round: 1,
      kind: 'shortlist',
      memberCount: 3,
      feasibleCount: 3,
      bindingConstraint: null,
      diagnostic: null,
      weights: { alpha: 0.5, beta: 0.3, gamma: 0.2 },
    });
    expect(body.items.map((i) => i.destination.slug).sort()).toEqual(['rec-a', 'rec-b', 'rec-c']);
    const gfs = body.items.map((i) => i.gfs);
    expect(gfs).toEqual([...gfs].sort((a, b) => b - a));
    expect(body.items.map((i) => i.rank)).toEqual([1, 2, 3]);
    for (const item of body.items) {
      expect(item.perPersonInr).toBe(Math.ceil(item.estimatedCostInr / 3));
      expect(item.distanceKm).toBe(roadKm(item.destination.slug));
      expect(item.distanceProvenance).toBe('estimated');
      expect(item.group.lowestScore10).not.toBeNull();
      expect(item.mine).not.toBeNull();
    }
    const [stored] = await db
      .select()
      .from(recommendationRun)
      .where(eq(recommendationRun.tripId, tripId));
    expect(stored).toMatchObject({ alpha: 0.5, beta: 0.3, gamma: 0.2, round: 1 });

    // Each member sees their own explanation, not the organiser's.
    const mine = await latest(second, tripId);
    const recA = (r: LatestRecommendationResponse) =>
      r.items.find((i) => i.destination.slug === 'rec-a')!.mine!;
    expect(recA(mine).missedActivities).toEqual([]);
    expect(recA(body).metActivities).toEqual(['trekking', 'camping']);

    const detail = await tripOf(organiser, tripId);
    expect(detail.status).toBe('shortlisted');
    expect(detail.latestRecommendation).toMatchObject({
      round: 1,
      kind: 'shortlist',
      feasibleCount: 3,
    });
    expect(detail.availableActions.map((a) => a.action)).toContain('chooseDestination');
  });

  it('fewer than 3 feasible: T6>T8, a diagnostic with alternatives and suggestions', async () => {
    const radiusKm = Math.max(roadKm('rec-a'), roadKm('rec-c'));
    expect(roadKm('rec-b')).toBeGreaterThan(radiusKm);
    const { tripId, members } = await readyTrip([prefs(), prefs({ climate: 'cold' })], {
      radiusKm,
    });
    const res = await recommend(members[0]!, tripId);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const body = RequestRecommendationsResponse.parse(res.body);
    expect(body.transition).toEqual({ transitionId: 'T6>T8', to: 'collecting_preferences' });
    expect(body.run).toMatchObject({
      kind: 'diagnostic',
      feasibleCount: 2,
      bindingConstraint: 'F1',
    });
    expect(body.items.map((i) => i.destination.slug).sort()).toEqual(['rec-a', 'rec-c']);
    const diagnostic = body.run!.diagnostic!;
    expect(diagnostic.alternatives[0]).toMatchObject({ slug: 'rec-b', name: 'Name of rec-b' });
    expect(diagnostic.alternatives[0]!.failures.map((f) => f.id)).toEqual(['F1']);
    const f1 = diagnostic.suggestions.find((s) => s.constraint === 'F1');
    expect(f1).toMatchObject({ newRadiusKm: Math.ceil(roadKm('rec-b') / 10) * 10 });
    expect(f1!.unlocks).toContain('rec-b');
    expect(diagnostic.incomplete).toContain('rec-incomplete');
    expect((await tripOf(members[0]!, tripId)).status).toBe('collecting_preferences');
  });

  it('second round: widen the radius, close submissions, recommend again: round 2', async () => {
    const radiusKm = Math.max(roadKm('rec-a'), roadKm('rec-c'));
    const { tripId, members } = await readyTrip([prefs(), prefs()], { radiusKm });
    const organiser = members[0]!;
    expect((await recommend(organiser, tripId)).status).toBe(200);

    const patch = await organiser.agent
      .patch(`/api/trips/${tripId}`)
      .set(H)
      .send({ radiusKm: 150 });
    expect(patch.status, JSON.stringify(patch.body)).toBe(200);
    const close = await organiser.agent
      .post(`/api/trips/${tripId}/close-submissions`)
      .set(H)
      .send({});
    expect(close.status, JSON.stringify(close.body)).toBe(200);

    const res = await recommend(organiser, tripId);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const body = RequestRecommendationsResponse.parse(res.body);
    expect(body.run).toMatchObject({ round: 2, kind: 'shortlist' });
    expect(body.transition.to).toBe('shortlisted');
  });

  it('disjoint dates: T4, a diagnostic run bound by F3, no items', async () => {
    const { tripId, members } = await readyTrip([
      prefs({ dateStart: '2026-11-05', dateEnd: '2026-11-08' }),
      prefs({ dateStart: '2026-11-20', dateEnd: '2026-11-24' }),
    ]);
    const res = await recommend(members[0]!, tripId);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const body = RequestRecommendationsResponse.parse(res.body);
    expect(body.transition).toEqual({ transitionId: 'T4', to: 'collecting_preferences' });
    expect(body.run).toMatchObject({
      kind: 'diagnostic',
      feasibleCount: 0,
      bindingConstraint: 'F3',
      diagnostic: { alternatives: [], suggestions: [] },
    });
    expect(body.run!.groupProfile.conflicts).toEqual([
      { code: 'NO_COMMON_WINDOW', blocking: true },
    ]);
    expect(body.items).toEqual([]);
    const activity = ActivityResponse.parse(
      (await members[1]!.agent.get(`/api/trips/${tripId}/activity`).set(H)).body,
    );
    expect(activity.items[0]!.summary).toMatch(/found the group's dates do not overlap enough$/);
  });

  it('a preference revised between compute and persist: 409 RECOMMENDATION_STALE and no run', async () => {
    const { tripId, members } = await readyTrip([prefs(), prefs()]);
    hooks.afterCompute = async () => {
      const res = await members[1]!.agent
        .put(`/api/trips/${tripId}/preferences/me`)
        .set(H)
        .send(prefs({ budgetMaxInr: 39000 }));
      expect(res.status).toBe(200);
    };
    try {
      const res = await recommend(members[0]!, tripId);
      expect(res.status).toBe(409);
      expect((res.body as ErrorEnvelope).error).toMatchObject({
        code: 'RECOMMENDATION_STALE',
        message: 'Preferences changed while recommending. Try again.',
      });
    } finally {
      delete hooks.afterCompute;
    }
    expect((await latest(members[0]!, tripId)).run).toBeNull();
    expect((await tripOf(members[0]!, tripId)).status).toBe('ready_for_recommendation');
    // Nothing is left half-done: the next request succeeds.
    expect((await recommend(members[0]!, tripId)).status).toBe(200);
  });

  it('a member cannot ask (403), and a trip that is not ready gives 409', async () => {
    const { tripId, members } = await readyTrip([prefs(), prefs()]);
    expect((await recommend(members[1]!, tripId)).status).toBe(403);
    expect((await recommend(members[0]!, tripId)).status).toBe(200);
    const again = await recommend(members[0]!, tripId);
    expect(again.status).toBe(409);
    expect((again.body as ErrorEnvelope).error.code).toBe('ILLEGAL_TRANSITION');
  });

  it('groups of 2 get no score range (the range would reveal the other score)', async () => {
    const { tripId, members } = await readyTrip([prefs(), prefs()]);
    const body = RequestRecommendationsResponse.parse((await recommend(members[0]!, tripId)).body);
    for (const item of body.items) {
      expect(item.group.lowestScore10).toBeNull();
      expect(item.group.highestScore10).toBeNull();
    }
  });
});

describe('privacy of recommendation responses (rule S4)', () => {
  it("A's responses hold none of the values only B wants; group lists count 2 or more", async () => {
    const { tripId, members } = await readyTrip([
      prefs({ destinationTypes: ['mountain', 'adventure'], activities: ['trekking', 'rafting'] }),
      prefs({ destinationTypes: ['mountain', 'lake'], activities: ['trekking', 'boating'] }),
    ]);
    const [a, b] = members as [Member, Member];
    expect((await recommend(a, tripId)).status).toBe(200);
    for (const path of ['recommendations/latest', 'group-profile']) {
      const asA = await a.agent.get(`/api/trips/${tripId}/${path}`).set(H);
      for (const onlyB of ['boating', 'lake']) {
        expect(asA.text, `${path} leaked ${onlyB}`).not.toContain(onlyB);
      }
      const asB = await b.agent.get(`/api/trips/${tripId}/${path}`).set(H);
      for (const onlyA of ['rafting', 'adventure']) {
        expect(asB.text, `${path} leaked ${onlyA}`).not.toContain(onlyA);
      }
    }
    const body = await latest(a, tripId);
    for (const item of body.items) {
      for (const v of [...item.group.sharedTypes, ...item.group.sharedActivities]) {
        expect(v.count).toBeGreaterThanOrEqual(2);
      }
    }
    const profile = body.run!.groupProfile;
    for (const v of [...profile.typeVotes, ...profile.activityVotes, ...profile.climateVotes]) {
      expect(v.count).toBeGreaterThanOrEqual(2);
    }
    expect(profile.otherInterestCount).toBe(4);
  });
});

describe('GET /api/trips/:id/group-profile', () => {
  it('not ready with one submission; ready with two, budgets rounded to ₹500', async () => {
    const organiser = await createTestUser(app, 'Profile Organiser');
    const member = await createTestUser(app, 'Profile Member');
    const { id: tripId } = await createTripAs(organiser.agent, { originHubSlug: HUB.slug });
    const { token } = InvitationResponse.parse(
      (await organiser.agent.post(`/api/trips/${tripId}/invitations`).set(H).send({})).body,
    );
    await member.agent.post(`/api/invitations/${token}/accept`).set(H).send({});
    await organiser.agent
      .put(`/api/trips/${tripId}/preferences/me`)
      .set(H)
      .send(prefs({ budgetMinInr: 12340, budgetMaxInr: 30120 }));
    const before = GroupProfileResponse.parse(
      (await member.agent.get(`/api/trips/${tripId}/group-profile`).set(H)).body,
    );
    expect(before).toEqual({ ready: false, memberCount: 1 });

    await member.agent
      .put(`/api/trips/${tripId}/preferences/me`)
      .set(H)
      .send(prefs({ budgetMinInr: 9000, budgetMaxInr: 25260, dateStart: '2026-11-14' }));
    const after = GroupProfileResponse.parse(
      (await member.agent.get(`/api/trips/${tripId}/group-profile`).set(H)).body,
    );
    expect(after).toMatchObject({
      ready: true,
      memberCount: 2,
      commonWindow: { start: '2026-11-14', end: '2026-11-16', days: 3 },
      windowFits: true,
      budgetBand: { minInr: 12500, maxInr: 25500, overlaps: true },
      perPersonCapInr: 25500,
      conflicts: [],
    });
    expect(JSON.stringify(after)).not.toMatch(/12340|30120|25260/);
  });
});

describe('POST /api/trips/:id/destination', () => {
  it('a shortlisted slug gives T9; another slug 422; a member 403; again 409', async () => {
    const { tripId, members } = await readyTrip([prefs(), prefs(), prefs()]);
    const [organiser, member] = members as [Member, Member, Member];
    const run = RequestRecommendationsResponse.parse((await recommend(organiser, tripId)).body);
    const chosen = run.items[0]!.destination.slug;
    const choose = (m: Member, slug: string) =>
      m.agent.post(`/api/trips/${tripId}/destination`).set(H).send({ destinationSlug: slug });

    expect((await choose(member, chosen)).status).toBe(403);
    const wrong = await choose(organiser, 'rec-far');
    expect(wrong.status).toBe(422);
    expect((wrong.body as ErrorEnvelope).error.code).toBe('DESTINATION_NOT_IN_SHORTLIST');

    const ok = await choose(organiser, chosen);
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    const detail = TripDetail.parse(ok.body);
    expect(detail.status).toBe('packages_proposed');
    expect(detail.selectedDestination?.slug).toBe(chosen);

    const again = await choose(organiser, chosen);
    expect(again.status).toBe(409);
    expect((again.body as ErrorEnvelope).error.code).toBe('ILLEGAL_TRANSITION');
  });
});

describe('speed on the real catalogue (R15)', () => {
  it('one recommendation for 3 members from gurugram takes under 2000 ms', async () => {
    const dir = resolve(import.meta.dirname, '../../../../packages/db/catalogue');
    await importCatalogue(db, dir, { today: '2026-11-01' });
    const members: Member[] = [];
    for (const name of ['Speed A', 'Speed B', 'Speed C']) {
      members.push(await createTestUser(app, name));
    }
    const organiser = members[0]!;
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
    const choices: Partial<PreferenceInput>[] = [
      { destinationTypes: ['hill_station', 'mountain'], activities: ['trekking', 'camping'] },
      { destinationTypes: ['spiritual', 'mountain'], activities: ['temples', 'yoga_wellness'] },
      {
        destinationTypes: ['heritage', 'city'],
        activities: ['forts_palaces', 'food_trails'],
        climate: 'warm',
      },
    ];
    for (const [i, m] of members.entries()) {
      await m.agent
        .put(`/api/trips/${tripId}/preferences/me`)
        .set(H)
        .send(prefs({ budgetMinInr: 8000, budgetMaxInr: 25000, ...choices[i] }));
    }

    const started = performance.now();
    const res = await recommend(organiser, tripId);
    const ms = Math.round(performance.now() - started);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const body = RequestRecommendationsResponse.parse(res.body);
    process.stdout.write(
      `\nR15 speed: ${ms} ms for ${body.run!.kind} (feasible ${body.run!.feasibleCount})\n`,
    );
    expect(ms).toBeLessThan(2000);
  });
});
