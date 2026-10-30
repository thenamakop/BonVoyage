import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createDb } from '@bonvoyage/db';
import { notification } from '@bonvoyage/db/schema';
import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import {
  InvitationResponse,
  MyPreferenceResponse,
  PastTrip,
  type ErrorEnvelope,
} from '@bonvoyage/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { createAuth } from '../auth/auth';
import { ENDPOINTS } from '../test/endpoint-inventory';
import { createTestUser, createTripAs, ensureHub } from '../test/helpers';

// S1-6 step 2: every endpoint, tried by every kind of caller, against a fresh
// trip in collecting_preferences. The expected cells are written by hand; they
// are NOT derived from the inventory's access field, or this would prove nothing.

const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
// The administrator is listed in the app's ADMIN_EMAILS (S1-7).
const ADMIN_EMAIL = `matrix-admin-${Date.now().toString(36)}@test.bv`;
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
  adminEmails: [ADMIN_EMAIL],
  clock: () => new Date('2026-11-01T06:30:00Z'),
});
const H = { Host: 'localhost:5173', Origin: 'http://localhost:5173' };

// The real catalogue, checked as a dry run: writes nothing.
const CATALOGUE_DIR = resolve(import.meta.dirname, '../../../../packages/db/catalogue');
const readCatalogue = (f: string) => readFileSync(resolve(CATALOGUE_DIR, f), 'utf8');
const CATALOGUE_FILES = {
  hubs: readCatalogue('hubs.csv'),
  destinations: readCatalogue('destinations.csv'),
  fares: readCatalogue('fares.csv'),
  pois: readCatalogue('pois.csv'),
  costRules: readCatalogue('cost-rules.json'),
};

const ACTORS = [
  'anonymous',
  'nonMember',
  'member',
  'excludedMember',
  'organiser',
  'admin',
] as const;
type Actor = (typeof ACTORS)[number];
type Agent = request.Agent;
type Users = Record<Exclude<Actor, 'anonymous'>, { agent: Agent; userId: string }>;

interface Fixture {
  tripId: string;
  token: string;
  memberId: string;
  pastTripId: string;
  /** One of the organiser's notifications (a member joined), so only they own it. */
  notificationId: string;
}

const PREFS = {
  destinationTypes: ['mountain'],
  activities: ['trekking'],
  climate: 'mild',
  travelStyle: 'comfort',
  budgetMinInr: 8000,
  budgetMaxInr: 12000,
  dateStart: '2026-11-13',
  dateEnd: '2026-11-16',
};

interface Case {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  /** The URL for this fixture. */
  url: (f: Fixture) => string;
  body?: object;
  /** One cell per actor, in ACTORS order: "200" or "409 MEMBER_EXCLUDED". */
  expected: [string, string, string, string, string, string];
}

// Cells: anonymous, nonMember, member, excludedMember, organiser, admin. The
// admin is signed in and in no trip, so trip routes treat them as a non-member.
const CASES: Case[] = [
  {
    method: 'GET',
    path: '/api/trips/:id/itinerary/items/:itemId/alternatives',
    url: (f) => `/api/trips/${f.tripId}/itinerary/items/missing/alternatives`,
    expected: [
      '401',
      '404 NOT_FOUND',
      '403 FORBIDDEN',
      '403 FORBIDDEN',
      '409 ILLEGAL_TRANSITION',
      '404 NOT_FOUND',
    ],
  },
  {
    method: 'PATCH',
    path: '/api/trips/:id/itinerary/items/:itemId',
    url: (f) => `/api/trips/${f.tripId}/itinerary/items/missing`,
    body: { action: 'remove' },
    expected: [
      '401',
      '404 NOT_FOUND',
      '403 FORBIDDEN',
      '403 FORBIDDEN',
      '409 ILLEGAL_TRANSITION',
      '404 NOT_FOUND',
    ],
  },
  {
    method: 'GET',
    path: '/api/health',
    url: () => '/api/health',
    expected: ['200', '200', '200', '200', '200', '200'],
  },
  {
    method: 'GET',
    path: '/api/invitations/:token',
    url: (f) => `/api/invitations/${f.token}`,
    expected: ['200', '200', '200', '200', '200', '200'],
  },

  {
    method: 'GET',
    path: '/api/me',
    url: () => '/api/me',
    expected: ['401', '200', '200', '200', '200', '200'],
  },
  {
    method: 'GET',
    path: '/api/me/trips',
    url: () => '/api/me/trips',
    expected: ['401', '200', '200', '200', '200', '200'],
  },
  {
    method: 'GET',
    path: '/api/me/profile',
    url: () => '/api/me/profile',
    expected: ['401', '200', '200', '200', '200', '200'],
  },
  {
    method: 'PATCH',
    path: '/api/me/profile',
    url: () => '/api/me/profile',
    body: { homeHubSlug: 'test-hub' },
    expected: ['401', '200', '200', '200', '200', '200'],
  },
  // Only the caller's own account; an empty body fails validation first.
  {
    method: 'DELETE',
    path: '/api/me/profile',
    url: () => '/api/me/profile',
    expected: [
      '401',
      '400 VALIDATION_ERROR',
      '400 VALIDATION_ERROR',
      '400 VALIDATION_ERROR',
      '400 VALIDATION_ERROR',
      '400 VALIDATION_ERROR',
    ],
  },
  {
    method: 'POST',
    path: '/api/me/past-trips',
    url: () => '/api/me/past-trips',
    body: { placeName: 'Matrix place', rating: 4 },
    expected: ['401', '201', '201', '201', '201', '201'],
  },
  // The row belongs to the organiser: anyone else's delete is a 404.
  {
    method: 'DELETE',
    path: '/api/me/past-trips/:id',
    url: (f) => `/api/me/past-trips/${f.pastTripId}`,
    expected: ['401', '404 NOT_FOUND', '404 NOT_FOUND', '404 NOT_FOUND', '204', '404 NOT_FOUND'],
  },
  {
    method: 'GET',
    path: '/api/hubs',
    url: () => '/api/hubs',
    expected: ['401', '200', '200', '200', '200', '200'],
  },
  {
    method: 'GET',
    path: '/api/destinations',
    url: () => '/api/destinations',
    expected: ['401', '200', '200', '200', '200', '200'],
  },
  {
    method: 'POST',
    path: '/api/trips',
    url: () => '/api/trips',
    body: {
      title: 'Matrix trip',
      originHubSlug: 'test-hub',
      durationNights: 2,
      budgetTotalInr: 20000,
      radiusKm: 300,
    },
    expected: ['401', '201', '201', '201', '201', '201'],
  },
  // A non-member joins; members and the organiser are already in (idempotent).
  {
    method: 'POST',
    path: '/api/invitations/:token/accept',
    url: (f) => `/api/invitations/${f.token}/accept`,
    body: {},
    expected: ['401', '200', '200', '409 MEMBER_EXCLUDED', '200', '200'],
  },

  // S5-3: notifications. The list and "read all" are the caller's own; a single
  // one belongs to the organiser (a member joined), so everyone else gets 404.
  {
    method: 'GET',
    path: '/api/notifications',
    url: () => '/api/notifications',
    expected: ['401', '200', '200', '200', '200', '200'],
  },
  {
    method: 'POST',
    path: '/api/notifications/read-all',
    url: () => '/api/notifications/read-all',
    body: {},
    expected: ['401', '204', '204', '204', '204', '204'],
  },
  {
    method: 'POST',
    path: '/api/notifications/:id/read',
    url: (f) => `/api/notifications/${f.notificationId}/read`,
    body: {},
    expected: ['401', '404 NOT_FOUND', '404 NOT_FOUND', '404 NOT_FOUND', '204', '404 NOT_FOUND'],
  },
  // The fixture member has submitted, so the organiser's reminder is refused.
  {
    method: 'POST',
    path: '/api/trips/:id/members/:userId/remind',
    url: (f) => `/api/trips/${f.tripId}/members/${f.memberId}/remind`,
    body: {},
    expected: [
      '401',
      '404 NOT_FOUND',
      '403 FORBIDDEN',
      '403 FORBIDDEN',
      '409 MEMBER_NOT_PENDING',
      '404 NOT_FOUND',
    ],
  },

  {
    method: 'GET',
    path: '/api/trips/:id',
    url: (f) => `/api/trips/${f.tripId}`,
    expected: ['401', '404 NOT_FOUND', '200', '200', '200', '404 NOT_FOUND'],
  },
  {
    method: 'GET',
    path: '/api/trips/:id/activity',
    url: (f) => `/api/trips/${f.tripId}/activity`,
    expected: ['401', '404 NOT_FOUND', '200', '200', '200', '404 NOT_FOUND'],
  },
  {
    method: 'GET',
    path: '/api/trips/:id/preferences/me',
    url: (f) => `/api/trips/${f.tripId}/preferences/me`,
    expected: ['401', '404 NOT_FOUND', '200', '200', '200', '404 NOT_FOUND'],
  },

  {
    method: 'PUT',
    path: '/api/trips/:id/preferences/me',
    url: (f) => `/api/trips/${f.tripId}/preferences/me`,
    body: PREFS,
    expected: ['401', '404 NOT_FOUND', '200', '403 FORBIDDEN', '200', '404 NOT_FOUND'],
  },
  {
    method: 'DELETE',
    path: '/api/trips/:id/members/me',
    url: (f) => `/api/trips/${f.tripId}/members/me`,
    expected: [
      '401',
      '404 NOT_FOUND',
      '204',
      '403 FORBIDDEN',
      '422 ORGANISER_CANNOT_LEAVE',
      '404 NOT_FOUND',
    ],
  },

  // S2-6: recommendations. Any member reads the latest run and the group
  // profile; only the organiser asks or chooses, and only in the right state
  // (the fixture trip is still collecting preferences, so both are 409).
  {
    method: 'GET',
    path: '/api/trips/:id/recommendations/latest',
    url: (f) => `/api/trips/${f.tripId}/recommendations/latest`,
    expected: ['401', '404 NOT_FOUND', '200', '200', '200', '404 NOT_FOUND'],
  },
  {
    method: 'GET',
    path: '/api/trips/:id/group-profile',
    url: (f) => `/api/trips/${f.tripId}/group-profile`,
    expected: ['401', '404 NOT_FOUND', '200', '200', '200', '404 NOT_FOUND'],
  },
  {
    method: 'POST',
    path: '/api/trips/:id/recommendations',
    url: (f) => `/api/trips/${f.tripId}/recommendations`,
    body: {},
    expected: [
      '401',
      '404 NOT_FOUND',
      '403 FORBIDDEN',
      '403 FORBIDDEN',
      '409 ILLEGAL_TRANSITION',
      '404 NOT_FOUND',
    ],
  },
  // S3-3: the trip is still collecting preferences, so package reads hit the
  // 409 state check and organiser writes never reach a real package row.
  {
    method: 'GET',
    path: '/api/trips/:id/packages',
    url: (f) => `/api/trips/${f.tripId}/packages`,
    expected: [
      '401',
      '404 NOT_FOUND',
      '409 ILLEGAL_TRANSITION',
      '409 ILLEGAL_TRANSITION',
      '409 ILLEGAL_TRANSITION',
      '404 NOT_FOUND',
    ],
  },
  {
    method: 'PUT',
    path: '/api/trips/:id/packages/:packageId/opinion',
    url: (f) => `/api/trips/${f.tripId}/packages/00000000-0000-4000-8000-0000000000a0/opinion`,
    body: { decision: 'accept' },
    expected: [
      '401',
      '404 NOT_FOUND',
      '409 ILLEGAL_TRANSITION',
      '403 FORBIDDEN',
      '409 ILLEGAL_TRANSITION',
      '404 NOT_FOUND',
    ],
  },
  {
    method: 'POST',
    path: '/api/trips/:id/packages/:packageId/select',
    url: (f) => `/api/trips/${f.tripId}/packages/00000000-0000-4000-8000-0000000000a0/select`,
    expected: [
      '415 UNSUPPORTED_MEDIA_TYPE',
      '415 UNSUPPORTED_MEDIA_TYPE',
      '415 UNSUPPORTED_MEDIA_TYPE',
      '415 UNSUPPORTED_MEDIA_TYPE',
      '415 UNSUPPORTED_MEDIA_TYPE',
      '415 UNSUPPORTED_MEDIA_TYPE',
    ],
  },
  {
    method: 'POST',
    path: '/api/trips/:id/packages/:packageId/remove',
    url: (f) => `/api/trips/${f.tripId}/packages/00000000-0000-4000-8000-0000000000a0/remove`,
    expected: [
      '415 UNSUPPORTED_MEDIA_TYPE',
      '415 UNSUPPORTED_MEDIA_TYPE',
      '415 UNSUPPORTED_MEDIA_TYPE',
      '415 UNSUPPORTED_MEDIA_TYPE',
      '415 UNSUPPORTED_MEDIA_TYPE',
      '415 UNSUPPORTED_MEDIA_TYPE',
    ],
  },
  {
    method: 'PATCH',
    path: '/api/trips/:id/packages/:packageId',
    url: (f) => `/api/trips/${f.tripId}/packages/00000000-0000-4000-8000-0000000000a0`,
    body: { stayTier: 'premium' },
    expected: [
      '401',
      '404 NOT_FOUND',
      '403 FORBIDDEN',
      '403 FORBIDDEN',
      '404 PACKAGE_NOT_FOUND',
      '404 NOT_FOUND',
    ],
  },
  // S3-6: no itinerary exists yet in this fixture, so organiser writes hit
  // the 409 state check and the read finds the trip in collecting_preferences.
  {
    method: 'GET',
    path: '/api/trips/:id/itinerary',
    url: (f) => `/api/trips/${f.tripId}/itinerary`,
    expected: ['401', '404 NOT_FOUND', '200', '200', '200', '404 NOT_FOUND'],
  },
  {
    method: 'POST',
    path: '/api/trips/:id/itinerary',
    url: (f) => `/api/trips/${f.tripId}/itinerary`,
    expected: [
      '415 UNSUPPORTED_MEDIA_TYPE',
      '415 UNSUPPORTED_MEDIA_TYPE',
      '415 UNSUPPORTED_MEDIA_TYPE',
      '415 UNSUPPORTED_MEDIA_TYPE',
      '415 UNSUPPORTED_MEDIA_TYPE',
      '415 UNSUPPORTED_MEDIA_TYPE',
    ],
  },
  {
    method: 'POST',
    path: '/api/trips/:id/itinerary/accept',
    url: (f) => `/api/trips/${f.tripId}/itinerary/accept`,
    expected: [
      '415 UNSUPPORTED_MEDIA_TYPE',
      '415 UNSUPPORTED_MEDIA_TYPE',
      '415 UNSUPPORTED_MEDIA_TYPE',
      '415 UNSUPPORTED_MEDIA_TYPE',
      '415 UNSUPPORTED_MEDIA_TYPE',
      '415 UNSUPPORTED_MEDIA_TYPE',
    ],
  },
  {
    method: 'POST',
    path: '/api/trips/:id/itinerary/reject',
    url: (f) => `/api/trips/${f.tripId}/itinerary/reject`,
    expected: [
      '415 UNSUPPORTED_MEDIA_TYPE',
      '415 UNSUPPORTED_MEDIA_TYPE',
      '415 UNSUPPORTED_MEDIA_TYPE',
      '415 UNSUPPORTED_MEDIA_TYPE',
      '415 UNSUPPORTED_MEDIA_TYPE',
      '415 UNSUPPORTED_MEDIA_TYPE',
    ],
  },

  {
    method: 'POST',
    path: '/api/trips/:id/destination',
    url: (f) => `/api/trips/${f.tripId}/destination`,
    body: { destinationSlug: 'nowhere' },
    expected: [
      '401',
      '404 NOT_FOUND',
      '403 FORBIDDEN',
      '403 FORBIDDEN',
      '409 ILLEGAL_TRANSITION',
      '404 NOT_FOUND',
    ],
  },
  // T21: the fixture trip is collecting preferences, so the organiser's
  // "Ask again" is an illegal event.
  {
    method: 'POST',
    path: '/api/trips/:id/reopen-shortlist',
    url: (f) => `/api/trips/${f.tripId}/reopen-shortlist`,
    body: {},
    expected: [
      '401',
      '404 NOT_FOUND',
      '403 FORBIDDEN',
      '403 FORBIDDEN',
      '409 ILLEGAL_TRANSITION',
      '404 NOT_FOUND',
    ],
  },

  // Collecting preferences: details are editable until the shortlist (0004 j),
  // and 1 submission is too few to close.
  {
    method: 'PATCH',
    path: '/api/trips/:id',
    url: (f) => `/api/trips/${f.tripId}`,
    body: { title: 'Renamed' },
    expected: ['401', '404 NOT_FOUND', '403 FORBIDDEN', '403 FORBIDDEN', '200', '404 NOT_FOUND'],
  },
  {
    method: 'POST',
    path: '/api/trips/:id/cancel',
    url: (f) => `/api/trips/${f.tripId}/cancel`,
    body: {},
    expected: ['401', '404 NOT_FOUND', '403 FORBIDDEN', '403 FORBIDDEN', '200', '404 NOT_FOUND'],
  },
  {
    method: 'POST',
    path: '/api/trips/:id/close-submissions',
    url: (f) => `/api/trips/${f.tripId}/close-submissions`,
    body: {},
    expected: [
      '401',
      '404 NOT_FOUND',
      '403 FORBIDDEN',
      '403 FORBIDDEN',
      '409 GUARD_FAILED',
      '404 NOT_FOUND',
    ],
  },
  {
    method: 'POST',
    path: '/api/trips/:id/invitations',
    url: (f) => `/api/trips/${f.tripId}/invitations`,
    body: {},
    expected: ['401', '404 NOT_FOUND', '403 FORBIDDEN', '403 FORBIDDEN', '200', '404 NOT_FOUND'],
  },
  {
    method: 'GET',
    path: '/api/trips/:id/invitations/active',
    url: (f) => `/api/trips/${f.tripId}/invitations/active`,
    expected: ['401', '404 NOT_FOUND', '403 FORBIDDEN', '403 FORBIDDEN', '200', '404 NOT_FOUND'],
  },
  {
    method: 'DELETE',
    path: '/api/trips/:id/invitations/active',
    url: (f) => `/api/trips/${f.tripId}/invitations/active`,
    expected: ['401', '404 NOT_FOUND', '403 FORBIDDEN', '403 FORBIDDEN', '204', '404 NOT_FOUND'],
  },
  {
    method: 'DELETE',
    path: '/api/trips/:id/members/:userId',
    url: (f) => `/api/trips/${f.tripId}/members/${f.memberId}`,
    expected: ['401', '404 NOT_FOUND', '403 FORBIDDEN', '403 FORBIDDEN', '204', '404 NOT_FOUND'],
  },

  // S1-7: administrator routes. Being an organiser is not enough.
  {
    method: 'GET',
    path: '/api/admin/catalogue/status',
    url: () => '/api/admin/catalogue/status',
    expected: ['401', '403 FORBIDDEN', '403 FORBIDDEN', '403 FORBIDDEN', '403 FORBIDDEN', '200'],
  },
  {
    method: 'POST',
    path: '/api/admin/catalogue/import',
    url: () => '/api/admin/catalogue/import',
    body: { files: CATALOGUE_FILES, dryRun: true },
    expected: ['401', '403 FORBIDDEN', '403 FORBIDDEN', '403 FORBIDDEN', '403 FORBIDDEN', '200'],
  },
];

let users: Users;
const results: { c: Case; actor: Actor; expected: string; got: string }[] = [];

beforeAll(async () => {
  await ensureHub(db, 'test-hub');
  const [organiser, member, excludedMember, nonMember] = await Promise.all(
    ['Matrix Organiser', 'Matrix Member', 'Matrix Excluded', 'Matrix Outsider'].map((n) =>
      createTestUser(app, n),
    ),
  );
  const admin = await createTestUser(app, 'Matrix Admin', ADMIN_EMAIL);
  users = {
    organiser: organiser!,
    member: member!,
    excludedMember: excludedMember!,
    admin,
    nonMember: nonMember!,
  };
});

afterAll(async () => {
  // On success, print the matrix summary per actor (the PR quotes it).
  if (results.length === CASES.length * ACTORS.length) {
    const lines = ACTORS.map((actor) => {
      const mine = results.filter((r) => r.actor === actor);
      const counts = new Map<string, number>();
      for (const r of mine)
        counts.set(r.got.split(' ')[0]!, (counts.get(r.got.split(' ')[0]!) ?? 0) + 1);
      const summary = [...counts]
        .sort()
        .map(([s, n]) => `${n}x${s}`)
        .join(' ');
      return `  ${actor.padEnd(15)} ${mine.length} cases: ${summary}`;
    });
    process.stdout.write(
      `\nAccess matrix: ${CASES.length} endpoints x ${ACTORS.length} actors\n${lines.join('\n')}\n`,
    );
  }
  await pool.end();
});

/** A fresh trip in collecting_preferences: member submitted, excluded removed. */
async function freshTrip(): Promise<Fixture> {
  const { organiser, member, excludedMember } = users;
  const { id: tripId } = await createTripAs(organiser.agent, { durationNights: 2 });
  const { token } = InvitationResponse.parse(
    (await organiser.agent.post(`/api/trips/${tripId}/invitations`).set(H).send({})).body,
  );
  for (const m of [member, excludedMember]) {
    await m.agent.post(`/api/invitations/${token}/accept`).set(H).send({});
  }
  await member.agent.put(`/api/trips/${tripId}/preferences/me`).set(H).send(PREFS);
  await organiser.agent.delete(`/api/trips/${tripId}/members/${excludedMember.userId}`).set(H);
  const { id: pastTripId } = PastTrip.parse(
    (
      await organiser.agent
        .post('/api/me/past-trips')
        .set(H)
        .send({ placeName: 'Organiser only', rating: 3 })
    ).body,
  );
  // Read from the table: this app's clock is fixed, so the organiser's list (30
  // newest, all with one timestamp) would not reliably hold this trip's row.
  const [joined] = await db
    .select({ id: notification.id })
    .from(notification)
    .where(and(eq(notification.userId, organiser.userId), eq(notification.tripId, tripId)))
    .limit(1);
  if (!joined) throw new Error('the organiser has no member_joined notification for the fixture');
  return { tripId, token, memberId: member.userId, pastTripId, notificationId: joined.id };
}

function call(actor: Actor, c: Case, f: Fixture) {
  const base = actor === 'anonymous' ? request(app) : users[actor].agent;
  const m = c.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
  const req = base[m](c.url(f)).set(H);
  return c.body ? req.send(c.body) : req;
}

describe('access matrix', () => {
  it('covers every inventory endpoint exactly once', () => {
    const covered = CASES.map((c) => `${c.method} ${c.path}`).sort();
    expect(covered).toEqual(ENDPOINTS.map((e) => `${e.method} ${e.path}`).sort());
  });

  it.each(CASES.map((c) => [`${c.method} ${c.path}`, c] as const))('%s', async (_name, c) => {
    const failures: string[] = [];
    for (const [i, actor] of ACTORS.entries()) {
      const fixture = await freshTrip();
      const res = await call(actor, c, fixture);
      const code = res.status >= 400 ? (res.body as ErrorEnvelope).error?.code : undefined;
      const expected = c.expected[i]!;
      const got = expected.includes(' ') && code ? `${res.status} ${code}` : String(res.status);
      results.push({ c, actor, expected, got });
      if (got !== expected) {
        failures.push(
          `${c.method} ${c.path} as ${actor}: expected ${expected}, got ${got}${code ? ` (${code})` : ''}`,
        );
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  it("an excluded member's GET preferences/me is 200 with preference null", async () => {
    const f = await freshTrip();
    const res = await users.excludedMember.agent
      .get(`/api/trips/${f.tripId}/preferences/me`)
      .set(H);
    expect(res.status).toBe(200);
    expect(MyPreferenceResponse.parse(res.body)).toEqual({ preference: null, submittedAt: null });
  });
});
