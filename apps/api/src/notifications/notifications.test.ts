import { createDb } from '@bonvoyage/db';
import { fareFallback, notification, poi, trip } from '@bonvoyage/db/schema';
import { ENTRY_ACTIONS, TRANSITIONS } from '@bonvoyage/engine';
import {
  indiaDateTime,
  InvitationResponse,
  NOTIFICATION_TYPES,
  NotificationsResponse,
  PackagesResponse,
  RemindResponse,
  type ErrorEnvelope,
  type NotificationType,
  type PreferenceInput,
} from '@bonvoyage/shared';
import { count, eq } from 'drizzle-orm';
import { pino } from 'pino';
import request from 'supertest';
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
import { NOTIFYING_TRANSITIONS, notifyTransition } from './notify';

// S5-3 (decisions E3 and M4): in-app notifications and the organiser's Remind.
// A fixture hub at (37, 70) is far from every other test's hub and from the
// real catalogue, so its three destinations are the only ones in any radius.
// The clock is mutable: notifications carry the app clock's time, so the
// 24-hour window and "newest first" are exact.

const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const auth = createAuth({
  db,
  secret: 'test-secret-test-secret-test-secret',
  baseURL: { allowedHosts: ['localhost:5173', 'localhost:4000', '*.vercel.app'] },
});
const START = new Date('2026-11-01T06:30:00Z');
let now = START;
const tick = (seconds = 60) => {
  now = new Date(now.getTime() + seconds * 1000);
};
const app = createApp({
  db,
  pool,
  logger: pino({ level: 'silent' }),
  auth,
  clock: () => now,
  scoringWeights: { alpha: 0.5, beta: 0.3, gamma: 0.2 },
});
const H = { Host: 'localhost:5173', Origin: 'http://localhost:5173' };
const PW = 'test-password-12+';

const DESTINATIONS = [
  { slug: 'notif-a', lat: 37.1, km: 30 },
  { slug: 'notif-b', lat: 37.2, km: 45 },
  { slug: 'notif-c', lat: 37.3, km: 60 },
];

beforeAll(async () => {
  const hub = await ensureHubAt(db, 'notif-hub', 37, 70);
  await ensureCostRules(db);
  for (const d of DESTINATIONS) {
    const id = await ensureDestination(db, { slug: d.slug, lat: d.lat, lng: 70 });
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
          distanceKm: d.km,
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
        lat: d.lat,
        lng: 70,
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
interface Person {
  agent: Agent;
  userId: string;
  email: string;
  name: string;
}

async function person(name: string): Promise<Person> {
  return { ...(await createTestUser(app, name)), name };
}

const code = (res: request.Response) => (res.body as ErrorEnvelope).error.code;
const inbox = async (p: Person) =>
  NotificationsResponse.parse((await p.agent.get('/api/notifications').set(H)).body);
/** Types in an inbox, newest first. */
const typesOf = async (p: Person) => (await inbox(p)).items.map((n) => n.type);

// Distinctive budgets, so a leak anywhere is a plain text match.
const prefs = (min: number, max: number): PreferenceInput => ({
  destinationTypes: ['mountain'],
  activities: ['trekking'],
  climate: 'mild',
  travelStyle: 'comfort',
  budgetMinInr: min,
  budgetMaxInr: max,
  dateStart: '2026-11-13',
  dateEnd: '2026-11-16',
});
const BUDGETS = {
  Asha: [10007, 40009],
  Rohan: [10013, 40031],
  Meera: [10037, 40037],
} as const;
const submit = async (p: Person, tripId: string, min: number, max: number) => {
  const res = await p.agent.put(`/api/trips/${tripId}/preferences/me`).set(H).send(prefs(min, max));
  expect(res.status, JSON.stringify(res.body)).toBe(200);
};
const remind = (organiser: Person, tripId: string, target: Person) =>
  organiser.agent.post(`/api/trips/${tripId}/members/${target.userId}/remind`).set(H).send({});

/** A collecting trip: the organiser, then each of `members` joined by link. */
async function collectingTrip(organiser: Person, members: Person[]) {
  const { id: tripId } = await createTripAs(organiser.agent, {
    originHubSlug: 'notif-hub',
    radiusKm: 200,
    budgetTotalInr: 120000,
    durationNights: 2,
  });
  const { token } = InvitationResponse.parse(
    (await organiser.agent.post(`/api/trips/${tripId}/invitations`).set(H).send({})).body,
  );
  for (const m of members) {
    tick();
    const res = await m.agent.post(`/api/invitations/${token}/accept`).set(H).send({});
    expect(res.status, JSON.stringify(res.body)).toBe(200);
  }
  return { tripId, token };
}

describe('the notification types and the state machine agree', () => {
  it('every transition that notifies has a type, and every typed transition exists', () => {
    const notifying = TRANSITIONS.filter(
      (t) => t.actions.includes('notifyMembers') || ENTRY_ACTIONS[t.to].includes('notifyMembers'),
    ).map((t) => t.id);
    expect(notifying.sort()).toEqual(['T14', 'T15', 'T16', 'T3b']);
    for (const id of notifying) expect(NOTIFYING_TRANSITIONS, id).toHaveProperty([id]);
    const ids = TRANSITIONS.map((t) => t.id);
    for (const id of Object.keys(NOTIFYING_TRANSITIONS)) expect(ids, id).toContain(id);
    // E3: every type but the two written outside transitions has a transition.
    expect([...new Set(Object.values(NOTIFYING_TRANSITIONS))].sort()).toEqual(
      NOTIFICATION_TYPES.filter(
        (t) => t !== 'member_joined' && t !== 'preferences_reminder',
      ).sort(),
    );
  });
});

// One journey, step by step: every type is written once, to the right people,
// and nobody else. The steps share state, so they run in order.
describe('a trip from joining to cancelled', () => {
  let asha: Person;
  let rohan: Person;
  let meera: Person;
  let kabir: Person;
  let tripId: string;
  const everyone = () => [asha, rohan, meera, kabir];
  /** Notification counts per person, to show who did NOT get one. */
  const counts = async () =>
    Promise.all(everyone().map(async (p) => (await inbox(p)).items.length));

  beforeAll(async () => {
    [asha, rohan, meera, kabir] = await Promise.all([
      person('Asha'),
      person('Rohan'),
      person('Meera'),
      person('Kabir'),
    ]);
  });

  it('member_joined: the organiser hears of each join, nobody else does', async () => {
    ({ tripId } = await collectingTrip(asha, [rohan, meera, kabir]));
    const mine = await inbox(asha);
    expect(mine.items.map((n) => n.message).sort()).toEqual([
      'Kabir joined the trip',
      'Meera joined the trip',
      'Rohan joined the trip',
    ]);
    expect(mine.unreadCount).toBe(3);
    expect(mine.items.every((n) => n.type === 'member_joined' && n.tripId === tripId)).toBe(true);
    expect(mine.items.every((n) => n.tripTitle === 'Test trip' && n.readAt === null)).toBe(true);
    expect(await counts()).toEqual([3, 0, 0, 0]);
  });

  it('preferences_reminder: only the member reminded; 409, 404 and 429 paths', async () => {
    tick();
    const first = await remind(asha, tripId, kabir);
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    const sent = RemindResponse.parse(first.body);
    expect(sent.remindedAt).toBe(now.toISOString());
    expect(sent.canRemindAgainAt).toBe(new Date(now.getTime() + 86_400_000).toISOString());
    const got = (await inbox(kabir)).items;
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({
      type: 'preferences_reminder',
      message: 'Asha asked you to add your preferences',
      tripId,
    });
    expect(await counts()).toEqual([3, 0, 0, 1]);

    // 429: within 24 hours, with Retry-After and the first name and time.
    tick(3600);
    const again = await remind(asha, tripId, kabir);
    expect(again.status).toBe(429);
    expect(code(again)).toBe('TOO_MANY_REQUESTS');
    expect((again.body as ErrorEnvelope).error.message).toBe(
      `You can remind Kabir again after ${indiaDateTime(new Date(sent.canRemindAgainAt))}`,
    );
    expect((again.body as ErrorEnvelope).error.message).toMatch(
      /^You can remind Kabir again after 2 Nov, \d{1,2}:\d{2} (am|pm)$/,
    );
    expect(again.headers['retry-after']).toBe(String(23 * 3600));
    expect((await inbox(kabir)).items).toHaveLength(1);

    // 409: yourself; 404: someone who is not in the trip; a member can't remind.
    const self = await remind(asha, tripId, asha);
    expect([self.status, code(self)]).toEqual([409, 'MEMBER_NOT_PENDING']);
    const stranger = await person('Outsider');
    const nobody = await remind(asha, tripId, stranger);
    expect([nobody.status, code(nobody)]).toEqual([404, 'NOT_FOUND']);
    const forbidden = await remind(rohan, tripId, kabir);
    expect([forbidden.status, code(forbidden)]).toEqual([403, 'FORBIDDEN']);
    expect((await inbox(kabir)).items).toHaveLength(1);

    // The window is rolling: one second short is still 429, exactly 24 hours is not.
    now = new Date(Date.parse(sent.canRemindAgainAt) - 1000);
    expect((await remind(asha, tripId, kabir)).status).toBe(429);
    now = new Date(sent.canRemindAgainAt);
    expect((await remind(asha, tripId, kabir)).status).toBe(201);
    expect((await inbox(kabir)).items).toHaveLength(2);
  });

  it('a member who has submitted cannot be reminded (409)', async () => {
    tick();
    await submit(rohan, tripId, ...BUDGETS.Rohan);
    const res = await remind(asha, tripId, rohan);
    expect([res.status, code(res)]).toEqual([409, 'MEMBER_NOT_PENDING']);
    expect((await inbox(rohan)).items).toHaveLength(0);
  });

  it('submissions_closed (T3b): active members except the organiser, and a different sentence for the one left out', async () => {
    tick();
    await submit(asha, tripId, ...BUDGETS.Asha);
    await submit(meera, tripId, ...BUDGETS.Meera);
    tick();
    const before = await counts();
    const res = await asha.agent.post(`/api/trips/${tripId}/close-submissions`).set(H).send({});
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const after = await counts();
    // Asha closed submissions, so she is skipped like every other actor.
    expect(after.map((n, i) => n - before[i]!)).toEqual([0, 1, 1, 1]);
    expect((await inbox(asha)).items.some((n) => n.type === 'submissions_closed')).toBe(false);
    for (const p of [rohan, meera]) {
      expect((await inbox(p)).items[0]).toMatchObject({
        type: 'submissions_closed',
        message: 'Preferences are closed. The trip is ready for recommendations',
      });
    }
    expect((await inbox(kabir)).items[0]).toMatchObject({
      type: 'submissions_closed',
      message: 'You were not included because preferences closed before you submitted',
    });
    // Kabir is excluded now: a reminder is refused, and later events skip them.
    const late = await remind(asha, tripId, kabir);
    expect([late.status, code(late)]).toEqual([409, 'MEMBER_NOT_PENDING']);
  });

  it('shortlist_ready (T6>T7): every active member except the organiser', async () => {
    tick();
    const before = await counts();
    const res = await asha.agent.post(`/api/trips/${tripId}/recommendations`).set(H).send({});
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const after = await counts();
    expect(after.map((n, i) => n - before[i]!)).toEqual([0, 1, 1, 0]);
    expect((await inbox(rohan)).items[0]).toMatchObject({
      type: 'shortlist_ready',
      message: 'A shortlist of destinations is ready',
    });
  });

  it('shortlist_reopened (T21): every active member except the organiser, by name', async () => {
    tick();
    const before = await counts();
    const res = await asha.agent.post(`/api/trips/${tripId}/reopen-shortlist`).set(H).send({});
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const after = await counts();
    expect(after.map((n, i) => n - before[i]!)).toEqual([0, 1, 1, 0]);
    expect((await inbox(meera)).items[0]).toMatchObject({
      type: 'shortlist_reopened',
      message: 'Asha asked for new recommendations',
    });
  });

  it('package_chosen (T11) and plan_ready (T12), each to the members except the organiser', async () => {
    tick();
    expect(
      (await asha.agent.post(`/api/trips/${tripId}/recommendations`).set(H).send({})).status,
    ).toBe(200);
    const chosen = await asha.agent
      .post(`/api/trips/${tripId}/destination`)
      .set(H)
      .send({ destinationSlug: 'notif-a' });
    expect(chosen.status, JSON.stringify(chosen.body)).toBe(200);
    // T9 itself tells nobody.
    const afterT9 = await counts();

    tick();
    const packages = PackagesResponse.parse(
      (await asha.agent.get(`/api/trips/${tripId}/packages`).set(H)).body,
    ).packages;
    const selected = await asha.agent
      .post(`/api/trips/${tripId}/packages/${packages[0]!.id}/select`)
      .set(H)
      .send({});
    expect(selected.status, JSON.stringify(selected.body)).toBe(200);
    const afterT11 = await counts();
    expect(afterT11.map((n, i) => n - afterT9[i]!)).toEqual([0, 1, 1, 0]);
    expect((await inbox(rohan)).items[0]).toMatchObject({
      type: 'package_chosen',
      message: 'Asha chose a package',
    });

    tick();
    const planned = await asha.agent.post(`/api/trips/${tripId}/itinerary`).set(H).send({});
    expect(planned.status, JSON.stringify(planned.body)).toBe(200);
    const afterT12 = await counts();
    expect(afterT12.map((n, i) => n - afterT11[i]!)).toEqual([0, 1, 1, 0]);
    expect((await inbox(rohan)).items[0]).toMatchObject({
      type: 'plan_ready',
      message: 'A day plan is ready to look at',
    });
  });

  it('trip_finalised (T14) then trip_cancelled (T16), each to the members except the organiser', async () => {
    tick();
    const before = await counts();
    const accepted = await asha.agent.post(`/api/trips/${tripId}/itinerary/accept`).set(H).send({});
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(200);
    const afterT14 = await counts();
    expect(afterT14.map((n, i) => n - before[i]!)).toEqual([0, 1, 1, 0]);
    expect((await inbox(meera)).items[0]).toMatchObject({
      type: 'trip_finalised',
      message: 'The trip is finalised',
    });

    tick();
    const cancelled = await asha.agent.post(`/api/trips/${tripId}/cancel`).set(H).send({});
    expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(200);
    const afterT16 = await counts();
    expect(afterT16.map((n, i) => n - afterT14[i]!)).toEqual([0, 1, 1, 0]);
    expect((await inbox(meera)).items[0]).toMatchObject({
      type: 'trip_cancelled',
      message: 'Asha cancelled the trip',
    });
  });

  it("Rohan's inbox is the whole story, newest first, every type in order", async () => {
    expect(await typesOf(rohan)).toEqual([
      'trip_cancelled',
      'trip_finalised',
      'plan_ready',
      'package_chosen',
      'shortlist_ready',
      'shortlist_reopened',
      'shortlist_ready',
      'submissions_closed',
    ] satisfies NotificationType[]);
    const seen = new Set<string>([
      ...(await typesOf(asha)),
      ...(await typesOf(rohan)),
      ...(await typesOf(kabir)),
    ]);
    expect([...seen].sort()).toEqual([...NOTIFICATION_TYPES].sort());
  });

  it('V2: no body holds a budget, an email, a score or another member’s answers', async () => {
    // Budgets are compared as values and in the sentences, never as text over ids.
    const budgets = Object.values(BUDGETS).flat();
    for (const p of everyone()) {
      const res = await p.agent.get('/api/notifications').set(H);
      const body = res.body as { items: Record<string, unknown>[]; unreadCount: number };
      expect(budgets).not.toContain(body.unreadCount);
      for (const q of everyone()) {
        expect(res.text, `${p.name} saw ${q.email}`).not.toContain(q.email);
        // The actor is stored by id; the id never leaves the server.
        expect(res.text, `${p.name} saw ${q.name}'s user id`).not.toContain(q.userId);
      }
      expect(res.text).not.toContain('actorUserId');
      expect(res.text).not.toMatch(/"(score|lambda|weight|deficit|budget\w*|email|vote)"/i);
      for (const item of body.items) {
        expect(Object.keys(item).sort()).toEqual(
          ['createdAt', 'id', 'message', 'readAt', 'tripId', 'tripTitle', 'type'].sort(),
        );
        const sentence = `${String(item.message)} ${String(item.tripTitle)}`;
        for (const b of budgets) expect(sentence).not.toContain(String(b));
      }
    }
    // The stored payloads carry the trip id, title and the type's own fields only.
    const rows = await db.select().from(notification).where(eq(notification.tripId, tripId));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const keys = Object.keys(row.payload as object);
      expect(
        keys.every((k) => ['tripId', 'tripTitle', 'actorUserId', 'excluded'].includes(k)),
      ).toBe(true);
      // No name is stored: it is looked up when the list is read.
      expect(JSON.stringify(row.payload)).not.toMatch(/Asha|Rohan|Meera|Kabir/);
    }
  });

  it('deleting the trip deletes its notifications (cascade)', async () => {
    const [before] = await db
      .select({ n: count() })
      .from(notification)
      .where(eq(notification.tripId, tripId));
    expect(before!.n).toBeGreaterThan(0);
    await db.delete(trip).where(eq(trip.id, tripId));
    const [after] = await db
      .select({ n: count() })
      .from(notification)
      .where(eq(notification.tripId, tripId));
    expect(after!.n).toBe(0);
  });
});

describe('trip_cancelled from planning (T15)', () => {
  it('goes to the other active members; a draft trip with no one else tells nobody', async () => {
    const asha = await person('Asha');
    const rohan = await person('Rohan');
    const { tripId } = await collectingTrip(asha, [rohan]);
    tick();
    expect((await asha.agent.post(`/api/trips/${tripId}/cancel`).set(H).send({})).status).toBe(200);
    expect((await inbox(rohan)).items.map((n) => [n.type, n.message])).toEqual([
      ['trip_cancelled', 'Asha cancelled the trip'],
    ]);
    // Only the join, which the organiser sees: the cancel was hers.
    expect(await typesOf(asha)).toEqual(['member_joined']);

    const solo = await createTripAs(asha.agent, { originHubSlug: 'notif-hub' });
    const before = (await inbox(asha)).items.length;
    expect((await asha.agent.post(`/api/trips/${solo.id}/cancel`).set(H).send({})).status).toBe(
      200,
    );
    expect((await inbox(asha)).items).toHaveLength(before);
  });
});

describe('writes share the transition’s transaction', () => {
  it('a rolled-back transaction leaves no notification, an illegal event writes none', async () => {
    const asha = await person('Asha');
    const rohan = await person('Rohan');
    const { tripId } = await collectingTrip(asha, [rohan]);
    await expect(
      db.transaction(async (tx) => {
        await notifyTransition(tx, {
          tripId,
          transitionId: 'T21',
          actorUserId: asha.userId,
          excludedUserIds: [],
          now,
        });
        const [inside] = await tx
          .select({ n: count() })
          .from(notification)
          .where(eq(notification.userId, rohan.userId));
        expect(inside!.n).toBe(1);
        throw new Error('roll back');
      }),
    ).rejects.toThrow('roll back');
    expect(await typesOf(rohan)).toEqual([]);

    // An illegal event is refused before anything is written.
    const refused = await asha.agent.post(`/api/trips/${tripId}/reopen-shortlist`).set(H).send({});
    expect(refused.status).toBe(409);
    expect(await typesOf(rohan)).toEqual([]);
  });

  it('a transition id with no type writes nothing', async () => {
    const asha = await person('Asha');
    const rohan = await person('Rohan');
    const { tripId } = await collectingTrip(asha, [rohan]);
    await db.transaction((tx) =>
      notifyTransition(tx, {
        tripId,
        transitionId: 'T9',
        actorUserId: asha.userId,
        excludedUserIds: [],
        now,
      }),
    );
    expect(await typesOf(rohan)).toEqual([]);
  });
});

describe('two quick clicks on Remind (advisory lock)', () => {
  it('exactly one reminder is stored; the other click is 429', async () => {
    const asha = await person('Asha');
    const rohan = await person('Rohan');
    const meera = await person('Meera');
    const { tripId } = await collectingTrip(asha, [rohan, meera]);
    const results = await Promise.all([
      remind(asha, tripId, meera),
      remind(asha, tripId, meera),
      remind(asha, tripId, meera),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 429, 429]);
    expect(await typesOf(meera)).toEqual(['preferences_reminder']);
    // A reminder to Rohan is a separate limit.
    expect((await remind(asha, tripId, rohan)).status).toBe(201);
  });
});

describe('reading and marking notifications', () => {
  async function seeded(total: number) {
    const asha = await person('Asha');
    const rohan = await person('Rohan');
    const { tripId } = await collectingTrip(asha, [rohan]);
    // Rohan has none yet; give him `total` of his own, one a minute apart.
    await db.insert(notification).values(
      Array.from({ length: total }, (_, i) => ({
        userId: rohan.userId,
        tripId,
        type: 'shortlist_ready',
        payload: { tripId, tripTitle: 'Test trip' },
        createdAt: new Date(START.getTime() + i * 60_000),
      })),
    );
    return { asha, rohan, tripId };
  }

  it('lists your own, newest first, 30 at most, with the full unread count', async () => {
    const { rohan, asha } = await seeded(35);
    const mine = await inbox(rohan);
    expect(mine.items).toHaveLength(30);
    expect(mine.unreadCount).toBe(35);
    const times = mine.items.map((n) => Date.parse(n.createdAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(times[0]).toBe(START.getTime() + 34 * 60_000);
    // Asha's list is her own: one join, none of Rohan's.
    expect(await typesOf(asha)).toEqual(['member_joined']);
  });

  it('marks one read (idempotent), then all; someone else’s id is a 404', async () => {
    const { rohan, asha } = await seeded(3);
    const first = (await inbox(rohan)).items[0]!;
    tick();
    const read = await rohan.agent.post(`/api/notifications/${first.id}/read`).set(H).send({});
    expect(read.status).toBe(204);
    let after = await inbox(rohan);
    expect(after.unreadCount).toBe(2);
    const stamp = after.items.find((n) => n.id === first.id)!.readAt;
    expect(stamp).toBe(now.toISOString());
    tick();
    expect(
      (await rohan.agent.post(`/api/notifications/${first.id}/read`).set(H).send({})).status,
    ).toBe(204);
    after = await inbox(rohan);
    expect(after.items.find((n) => n.id === first.id)!.readAt).toBe(stamp);

    // Someone else's id looks exactly like an id that does not exist.
    const theirs = await asha.agent.post(`/api/notifications/${first.id}/read`).set(H).send({});
    const unknown = await asha.agent
      .post('/api/notifications/00000000-0000-4000-8000-000000000001/read')
      .set(H)
      .send({});
    expect([theirs.status, code(theirs)]).toEqual([404, 'NOT_FOUND']);
    expect(theirs.body).toEqual(unknown.body);
    expect((await inbox(rohan)).unreadCount).toBe(2);
    const bad = await rohan.agent.post('/api/notifications/not-an-id/read').set(H).send({});
    expect([bad.status, code(bad)]).toEqual([400, 'VALIDATION_ERROR']);

    // read-all touches only your own.
    expect((await rohan.agent.post('/api/notifications/read-all').set(H).send({})).status).toBe(
      204,
    );
    expect((await inbox(rohan)).unreadCount).toBe(0);
    expect((await inbox(asha)).unreadCount).toBe(1);
  });

  it('401 without a session', async () => {
    for (const [method, path] of [
      ['get', '/api/notifications'],
      ['post', '/api/notifications/read-all'],
    ] as const) {
      const res = await request(app)[method](path).set(H).send({});
      expect(res.status, path).toBe(401);
    }
  });
});

describe('account deletion', () => {
  it('removes the user’s notifications and leaves everyone else’s', async () => {
    const asha = await person('Asha');
    const rohan = await person('Rohan');
    const meera = await person('Meera');
    const { tripId } = await collectingTrip(asha, [rohan, meera]);
    expect((await remind(asha, tripId, rohan)).status).toBe(201);
    expect((await remind(asha, tripId, meera)).status).toBe(201);
    const rows = (userId: string) =>
      db
        .select({ n: count() })
        .from(notification)
        .where(eq(notification.userId, userId))
        .then((r) => r[0]!.n);
    expect(await rows(rohan.userId)).toBe(1);

    const res = await rohan.agent
      .delete('/api/me/profile')
      .set(H)
      .send({ password: PW, confirmEmail: rohan.email });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(await rows(rohan.userId)).toBe(0);
    expect(await rows(meera.userId)).toBe(1);
    expect(await rows(asha.userId)).toBe(2);
  });

  it('a member who joined then deleted their account is "A former member" on the organiser’s list', async () => {
    const asha = await person('Asha');
    const rohan = await person('Rohan');
    const meera = await person('Meera');
    await collectingTrip(asha, [rohan, meera]);
    expect((await inbox(asha)).items.map((n) => n.message).sort()).toEqual([
      'Meera joined the trip',
      'Rohan joined the trip',
    ]);

    const res = await rohan.agent
      .delete('/api/me/profile')
      .set(H)
      .send({ password: PW, confirmEmail: rohan.email });
    expect(res.status, JSON.stringify(res.body)).toBe(200);

    const list = await asha.agent.get('/api/notifications').set(H);
    const { items } = NotificationsResponse.parse(list.body);
    expect(items.map((n) => n.message).sort()).toEqual([
      'A former member joined the trip',
      'Meera joined the trip',
    ]);
    for (const leaked of ['Rohan', rohan.userId, rohan.email, meera.userId, meera.email]) {
      expect(list.text).not.toContain(leaked);
    }
  });
});
