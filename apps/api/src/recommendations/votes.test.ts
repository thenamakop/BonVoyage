import { createDb } from '@bonvoyage/db';
import {
  fareFallback,
  notification,
  recommendationRun,
  tripMember,
  tripTransition,
  vote,
} from '@bonvoyage/db/schema';
import {
  ActivityResponse,
  InvitationResponse,
  LatestRecommendationResponse,
  PackagesResponse,
  RunVotes,
  TripDetail,
  type ErrorEnvelope,
} from '@bonvoyage/shared';
import { and, eq } from 'drizzle-orm';
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
import { votesView } from './votes';

// S5-4 part 1 (R18, decision E4): votes on the shortlist as I6. The fixture hub sits far
// from every other file's destinations, so nothing else falls inside its radius.

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

type Agent = request.Agent;
const code = (res: request.Response) => (res.body as ErrorEnvelope).error.code;

// vote-far is inside the first radius (200 km) and outside an edited one (100 km);
// vote-outside is never inside it, so it exists and is in no run.
const DESTINATIONS = [
  { slug: 'vote-a', lat: 15.2, km: 30 },
  { slug: 'vote-b', lat: 15.3, km: 45 },
  { slug: 'vote-c', lat: 15.4, km: 60 },
  { slug: 'vote-far', lat: 15.9, km: 130 },
  { slug: 'vote-outside', lat: 18, km: 430 },
];

const PREFS = {
  destinationTypes: ['mountain'],
  activities: ['trekking'],
  climate: 'mild',
  travelStyle: 'comfort',
  budgetMinInr: 10000,
  budgetMaxInr: 40000,
  dateStart: '2026-11-13',
  dateEnd: '2026-11-16',
};

beforeAll(async () => {
  const hub = await ensureHubAt(db, 'vote-hub', 15, 90);
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

/** A trip with `size` members, of whom the first `submit` submit, then a shortlist. */
async function shortlistedTrip(size = 3, submit = size) {
  const members = await Promise.all(
    Array.from({ length: size }, (_, i) => createTestUser(app, `Vote Member ${i}`)),
  );
  // Safe: every caller asks for at least 2 members.
  const organiser = members[0]!;
  const { id: tripId } = await createTripAs(organiser.agent, {
    originHubSlug: 'vote-hub',
    radiusKm: 200,
    budgetTotalInr: 200000,
    durationNights: 2,
  });
  const { token } = InvitationResponse.parse(
    (await organiser.agent.post(`/api/trips/${tripId}/invitations`).set(H).send({})).body,
  );
  for (const m of members.slice(1)) {
    await m.agent.post(`/api/invitations/${token}/accept`).set(H).send({});
  }
  for (const m of members.slice(0, submit)) {
    const res = await m.agent.put(`/api/trips/${tripId}/preferences/me`).set(H).send(PREFS);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
  }
  if (submit < size) {
    const closed = await organiser.agent
      .post(`/api/trips/${tripId}/close-submissions`)
      .set(H)
      .send({});
    expect(closed.status, JSON.stringify(closed.body)).toBe(200);
  }
  const run = await organiser.agent.post(`/api/trips/${tripId}/recommendations`).set(H).send({});
  expect(run.status, JSON.stringify(run.body)).toBe(200);
  expect(
    TripDetail.parse((await organiser.agent.get(`/api/trips/${tripId}`).set(H)).body).status,
  ).toBe('shortlisted');
  return { tripId, organiser, members };
}

const put = (agent: Agent, tripId: string, destinationSlug: string) =>
  agent.put(`/api/trips/${tripId}/vote`).set(H).send({ destinationSlug });
const withdraw = (agent: Agent, tripId: string) => agent.delete(`/api/trips/${tripId}/vote`).set(H);
const latest = async (agent: Agent, tripId: string) =>
  LatestRecommendationResponse.parse(
    (await agent.get(`/api/trips/${tripId}/recommendations/latest`).set(H)).body,
  );
const votesOf = async (agent: Agent, tripId: string) => (await latest(agent, tripId)).votes;
const counted = (votes: RunVotes | undefined) =>
  Object.fromEntries(Object.entries(votes?.counts ?? {}).filter(([, n]) => n > 0));
const choose = (agent: Agent, tripId: string, destinationSlug: string) =>
  agent.post(`/api/trips/${tripId}/destination`).set(H).send({ destinationSlug });

describe('PUT and DELETE /api/trips/:id/vote (R18)', () => {
  it('casts, changes and withdraws; each member sees the counts and only their own vote', async () => {
    const { tripId, organiser, members } = await shortlistedTrip();
    const [, rohan, meera] = members;

    // Before anyone votes: every destination at 0, and nobody has a vote.
    const empty = await votesOf(organiser.agent, tripId);
    expect(empty).toEqual({
      counts: { 'vote-a': 0, 'vote-b': 0, 'vote-c': 0, 'vote-far': 0 },
      voted: 0,
      eligible: 3,
    });

    const cast = await put(rohan!.agent, tripId, 'vote-a');
    expect(cast.status, JSON.stringify(cast.body)).toBe(200);
    expect(RunVotes.parse(cast.body)).toMatchObject({
      counts: { 'vote-a': 1, 'vote-b': 0 },
      voted: 1,
      eligible: 3,
      mine: 'vote-a',
    });
    // The organiser votes as a member.
    expect((await put(organiser.agent, tripId, 'vote-a')).status).toBe(200);
    expect((await put(meera!.agent, tripId, 'vote-b')).status).toBe(200);

    expect(counted(await votesOf(rohan!.agent, tripId))).toEqual({ 'vote-a': 2, 'vote-b': 1 });
    expect((await votesOf(rohan!.agent, tripId))?.mine).toBe('vote-a');
    expect((await votesOf(meera!.agent, tripId))?.mine).toBe('vote-b');
    expect((await votesOf(organiser.agent, tripId))?.voted).toBe(3);

    // Change: still one vote, moved.
    const changed = RunVotes.parse((await put(rohan!.agent, tripId, 'vote-c')).body);
    expect(changed.mine).toBe('vote-c');
    expect(changed.voted).toBe(3);
    expect(counted(changed)).toEqual({ 'vote-a': 1, 'vote-b': 1, 'vote-c': 1 });

    // Withdraw: gone, and a second withdrawal changes nothing.
    for (let i = 0; i < 2; i += 1) {
      const res = await withdraw(rohan!.agent, tripId);
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      const view = RunVotes.parse(res.body);
      expect(view.mine).toBeUndefined();
      expect(view.voted).toBe(2);
      expect(counted(view)).toEqual({ 'vote-a': 1, 'vote-b': 1 });
    }
  });

  it('two simultaneous votes by one member leave one row', async () => {
    const { tripId, members } = await shortlistedTrip();
    const rohan = members[1]!;
    const results = await Promise.all([
      put(rohan.agent, tripId, 'vote-a'),
      put(rohan.agent, tripId, 'vote-b'),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    const view = await votesOf(rohan.agent, tripId);
    expect(view?.voted).toBe(1);
    expect(Object.values(counted(view))).toEqual([1]);
  });

  it('a destination outside the run is 400, a real one and a made-up one', async () => {
    const { tripId, members } = await shortlistedTrip();
    const rohan = members[1]!;
    for (const slug of ['vote-outside', 'nowhere']) {
      const res = await put(rohan.agent, tripId, slug);
      expect(res.status, slug).toBe(400);
      expect(res.body).toEqual({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Some fields are invalid.',
          fields: { destinationSlug: 'Choose a destination from the shortlist.' },
        },
      });
    }
    const empty = await rohan.agent.put(`/api/trips/${tripId}/vote`).set(H).send({});
    expect(empty.status).toBe(400);
    expect((await votesOf(rohan.agent, tripId))?.voted).toBe(0);
  });

  it('voting is 409 before a shortlist, after T9 and after T21, and nothing is written', async () => {
    const { tripId, organiser, members } = await shortlistedTrip();
    const rohan = members[1]!;
    expect((await put(rohan.agent, tripId, 'vote-a')).status).toBe(200);
    expect((await choose(organiser.agent, tripId, 'vote-b')).status).toBe(200);

    // After T9, even a slug that is not in the run reads as closed, not as a bad field.
    for (const res of [
      await put(rohan.agent, tripId, 'vote-b'),
      await put(rohan.agent, tripId, 'nowhere'),
      await withdraw(rohan.agent, tripId),
    ]) {
      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        error: { code: 'ILLEGAL_TRANSITION', message: 'Voting has closed.' },
      });
    }
    const view = await votesOf(rohan.agent, tripId);
    expect(view?.mine).toBe('vote-a');
    expect(counted(view)).toEqual({ 'vote-a': 1 });

    const fresh = await createTestUser(app, 'Vote Early');
    const { id: early } = await createTripAs(fresh.agent, {
      originHubSlug: 'vote-hub',
      radiusKm: 200,
      budgetTotalInr: 200000,
      durationNights: 2,
    });
    const before = await put(fresh.agent, early, 'vote-a');
    expect(before.status).toBe(409);
    expect((before.body as ErrorEnvelope).error.message).toBe('Voting has closed.');
    expect(await votesOf(fresh.agent, early)).toBeUndefined();
  });

  it('T10 keeps the run’s votes; voting reopens with them', async () => {
    const { tripId, organiser, members } = await shortlistedTrip();
    const rohan = members[1]!;
    expect((await put(rohan.agent, tripId, 'vote-a')).status).toBe(200);
    expect((await choose(organiser.agent, tripId, 'vote-b')).status).toBe(200);
    let status = 'packages_proposed';
    while (status === 'packages_proposed') {
      const list = PackagesResponse.parse(
        (await organiser.agent.get(`/api/trips/${tripId}/packages`).set(H)).body,
      );
      const res = await organiser.agent
        .post(`/api/trips/${tripId}/packages/${list.packages[0]!.id}/remove`)
        .set(H)
        .send({});
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      status = TripDetail.parse(res.body).status;
    }
    expect(status).toBe('shortlisted');
    const view = await votesOf(rohan.agent, tripId);
    expect(view?.mine).toBe('vote-a');
    expect(counted(view)).toEqual({ 'vote-a': 1 });
    expect((await put(rohan.agent, tripId, 'vote-c')).status).toBe(200);
    expect(counted(await votesOf(rohan.agent, tripId))).toEqual({ 'vote-c': 1 });
  });

  it('a new run starts with no votes; voting is closed in between (T21)', async () => {
    const { tripId, organiser, members } = await shortlistedTrip();
    const rohan = members[1]!;
    expect((await put(rohan.agent, tripId, 'vote-a')).status).toBe(200);
    const reopened = await organiser.agent
      .post(`/api/trips/${tripId}/reopen-shortlist`)
      .set(H)
      .send({});
    expect(reopened.status, JSON.stringify(reopened.body)).toBe(200);
    expect((await put(rohan.agent, tripId, 'vote-b')).status).toBe(409);
    // The old shortlist still reads with its votes until the new one exists.
    expect((await votesOf(rohan.agent, tripId))?.mine).toBe('vote-a');

    expect(
      (await organiser.agent.post(`/api/trips/${tripId}/recommendations`).set(H).send({})).status,
    ).toBe(200);
    const round2 = await latest(rohan.agent, tripId);
    expect(round2.run?.round).toBe(2);
    expect(round2.votes?.voted).toBe(0);
    expect(round2.votes?.mine).toBeUndefined();
    expect(counted(round2.votes)).toEqual({});
    expect((await put(rohan.agent, tripId, 'vote-b')).status).toBe(200);
    expect(counted(await votesOf(rohan.agent, tripId))).toEqual({ 'vote-b': 1 });
  });

  it('the organiser can choose a destination with no votes (0005 h)', async () => {
    const { tripId, organiser, members } = await shortlistedTrip();
    for (const m of members) expect((await put(m.agent, tripId, 'vote-a')).status).toBe(200);
    const res = await choose(organiser.agent, tripId, 'vote-c');
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(TripDetail.parse(res.body).selectedDestination?.slug).toBe('vote-c');
  });

  it('an excluded member cannot vote, is not eligible and reads no vote of their own', async () => {
    const { tripId, organiser, members } = await shortlistedTrip(3, 2);
    const left = members[2]!;
    const cast = await put(left.agent, tripId, 'vote-a');
    expect(cast.status).toBe(403);
    expect(code(cast)).toBe('FORBIDDEN');
    expect((await withdraw(left.agent, tripId)).status).toBe(403);

    expect((await put(organiser.agent, tripId, 'vote-a')).status).toBe(200);
    const view = await votesOf(left.agent, tripId);
    expect(view).toEqual({ voted: 1, eligible: 2 });
  });

  it('removing a member deletes their votes, also from an earlier shortlist', async () => {
    const { tripId, organiser, members } = await shortlistedTrip();
    const rohan = members[1]!;
    expect((await put(rohan.agent, tripId, 'vote-a')).status).toBe(200);
    const [membership] = await db
      .select({ id: tripMember.id })
      .from(tripMember)
      .where(and(eq(tripMember.tripId, tripId), eq(tripMember.userId, rohan.userId)));
    const votesOfRohan = () => db.select().from(vote).where(eq(vote.tripMemberId, membership!.id));
    expect(await votesOfRohan()).toHaveLength(1);

    // T21, then a budget nothing fits: T6>T8 reopens the roster.
    await organiser.agent.post(`/api/trips/${tripId}/reopen-shortlist`).set(H).send({});
    const edited = await organiser.agent
      .patch(`/api/trips/${tripId}`)
      .set(H)
      .send({ budgetTotalInr: 1000 });
    expect(edited.status, JSON.stringify(edited.body)).toBe(200);
    const diagnostic = await organiser.agent
      .post(`/api/trips/${tripId}/recommendations`)
      .set(H)
      .send({});
    expect(diagnostic.status, JSON.stringify(diagnostic.body)).toBe(200);
    // A diagnostic run has nothing to vote on, so no votes field.
    expect((await latest(organiser.agent, tripId)).votes).toBeUndefined();

    const removed = await organiser.agent
      .delete(`/api/trips/${tripId}/members/${rohan.userId}`)
      .set(H);
    expect(removed.status).toBe(204);
    expect(await votesOfRohan()).toEqual([]);
  });

  it('deleting an account deletes its votes', async () => {
    const { tripId, organiser, members } = await shortlistedTrip();
    const rohan = members[1]!;
    expect((await put(rohan.agent, tripId, 'vote-a')).status).toBe(200);
    expect((await put(organiser.agent, tripId, 'vote-b')).status).toBe(200);
    const deleted = await rohan.agent
      .delete('/api/me/profile')
      .set(H)
      .send({ password: 'test-password-12+', confirmEmail: rohan.email });
    expect(deleted.status, JSON.stringify(deleted.body)).toBe(200);
    const view = await votesOf(organiser.agent, tripId);
    expect(view?.eligible).toBe(2);
    expect(view?.voted).toBe(1);
    expect(counted(view)).toEqual({});
  });

  it('with 2 members the counts wait until both have voted (E4)', async () => {
    const { tripId, organiser, members } = await shortlistedTrip(2);
    const rohan = members[1]!;
    expect(await votesOf(rohan.agent, tripId)).toEqual({ voted: 0, eligible: 2 });

    const first = RunVotes.parse((await put(rohan.agent, tripId, 'vote-a')).body);
    expect(first).toEqual({ voted: 1, eligible: 2, mine: 'vote-a' });
    expect(await votesOf(organiser.agent, tripId)).toEqual({ voted: 1, eligible: 2 });

    const second = RunVotes.parse((await put(organiser.agent, tripId, 'vote-b')).body);
    expect(counted(second)).toEqual({ 'vote-a': 1, 'vote-b': 1 });
    expect(counted(await votesOf(rohan.agent, tripId))).toEqual({ 'vote-a': 1, 'vote-b': 1 });

    // Withdrawing goes back to waiting.
    expect(RunVotes.parse((await withdraw(rohan.agent, tripId)).body)).toEqual({
      voted: 1,
      eligible: 2,
    });
    expect(await votesOf(organiser.agent, tripId)).toEqual({
      voted: 1,
      eligible: 2,
      mine: 'vote-b',
    });
  });

  it('a vote is I6: audited, no status change, not in the activity list, nobody notified', async () => {
    const { tripId, organiser, members } = await shortlistedTrip();
    const rohan = members[1]!;
    const before = TripDetail.parse(
      (await organiser.agent.get(`/api/trips/${tripId}`).set(H)).body,
    );
    const bellBefore = await db
      .select({ id: notification.id })
      .from(notification)
      .where(eq(notification.tripId, tripId));

    expect((await put(rohan.agent, tripId, 'vote-a')).status).toBe(200);
    expect((await withdraw(rohan.agent, tripId)).status).toBe(200);

    const rows = await db
      .select()
      .from(tripTransition)
      .where(and(eq(tripTransition.tripId, tripId), eq(tripTransition.transitionId, 'I6')));
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row).toMatchObject({
        event: 'voteCast',
        fromStatus: 'shortlisted',
        toStatus: 'shortlisted',
        actorUserId: rohan.userId,
      });
    }

    const after = TripDetail.parse((await organiser.agent.get(`/api/trips/${tripId}`).set(H)).body);
    expect(after.status).toBe('shortlisted');
    expect(after.lastActivityAt).toBe(before.lastActivityAt);
    expect(after.updatedAt).toBe(before.updatedAt);
    expect(after.legalEvents).toContain('voteCast');

    const activity = ActivityResponse.parse(
      (await organiser.agent.get(`/api/trips/${tripId}/activity`).set(H)).body,
    );
    expect(activity.items.map((i) => i.event)).not.toContain('voteCast');

    const bellAfter = await db
      .select({ id: notification.id })
      .from(notification)
      .where(eq(notification.tripId, tripId));
    expect(bellAfter).toHaveLength(bellBefore.length);
  });

  it('a cancelled trip takes no vote', async () => {
    const { tripId, organiser } = await shortlistedTrip();
    const cancelled = await organiser.agent.post(`/api/trips/${tripId}/cancel`).set(H).send({});
    expect(cancelled.status).toBe(200);
    expect((await put(organiser.agent, tripId, 'vote-a')).status).toBe(409);
    const [run] = await db
      .select({ id: recommendationRun.id })
      .from(recommendationRun)
      .where(eq(recommendationRun.tripId, tripId));
    expect(await db.select().from(vote).where(eq(vote.runId, run!.id))).toEqual([]);
  });

  it('the database itself refuses a destination outside the run', async () => {
    const { tripId } = await shortlistedTrip(2);
    const [run] = await db
      .select({ id: recommendationRun.id })
      .from(recommendationRun)
      .where(eq(recommendationRun.tripId, tripId));
    const [member] = await db
      .select({ id: tripMember.id })
      .from(tripMember)
      .where(eq(tripMember.tripId, tripId))
      .limit(1);
    // vote-outside is a real destination, and not in this run.
    const outside = await ensureDestination(db, { slug: 'vote-outside', lat: 18, lng: 90 });
    await expect(
      db.insert(vote).values({ runId: run!.id, tripMemberId: member!.id, destinationId: outside }),
    ).rejects.toMatchObject({ cause: { code: '23503', constraint: 'vote_run_item_fk' } });
  });
});

describe('votesView', () => {
  const slugs = ['a', 'b'];
  it('gives 3 or more members the counts from the first vote, naming no one', () => {
    const view = votesView([{ tripMemberId: 'm1', slug: 'a' }], slugs, 3, 'm2');
    expect(view).toEqual({ counts: { a: 1, b: 0 }, voted: 1, eligible: 3 });
  });
  it('hides the counts with 2 eligible until both have voted, but not your own vote', () => {
    expect(votesView([], slugs, 2, 'm1')).toEqual({ voted: 0, eligible: 2 });
    expect(votesView([{ tripMemberId: 'm1', slug: 'a' }], slugs, 2, 'm1')).toEqual({
      voted: 1,
      eligible: 2,
      mine: 'a',
    });
    expect(
      votesView(
        [
          { tripMemberId: 'm1', slug: 'a' },
          { tripMemberId: 'm2', slug: 'a' },
        ],
        slugs,
        2,
        'm1',
      ),
    ).toEqual({ counts: { a: 2, b: 0 }, voted: 2, eligible: 2, mine: 'a' });
  });
  it('a vote for a destination no longer in the list does not break the view', () => {
    expect(votesView([{ tripMemberId: 'm1', slug: 'gone' }], slugs, 3, 'm9')).toEqual({
      counts: { a: 0, b: 0 },
      voted: 1,
      eligible: 3,
    });
  });
});
