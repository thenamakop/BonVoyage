import { createDb } from '@bonvoyage/db';
import { destination } from '@bonvoyage/db/schema';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import {
  DestinationsResponse,
  PastTrip,
  ProfileResponse,
  type ErrorEnvelope,
} from '@bonvoyage/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { createAuth } from '../auth/auth';
import { createTestUser, ensureHub } from '../test/helpers';

// S1-4: the caller's profile (home city, past trips) and GET /api/destinations.
// The clock is fixed at 1 Nov 2026 (India) for the visited-date rule.

const logger = pino({ level: 'silent' });
const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const auth = createAuth({
  db,
  secret: 'test-secret-test-secret-test-secret',
  baseURL: { allowedHosts: ['localhost:5173', 'localhost:4000', '*.vercel.app'] },
});
const app = createApp({ db, pool, logger, auth, clock: () => new Date('2026-11-01T06:30:00Z') });
const H = { Host: 'localhost:5173', Origin: 'http://localhost:5173' };

/** A catalogue destination for these tests (the test database has no catalogue). */
async function ensureDestination(slug: string, name: string, active = true) {
  const existing = await db.select().from(destination).where(eq(destination.slug, slug)).limit(1);
  if (existing[0]) return;
  await db.insert(destination).values({
    slug,
    name,
    state: 'Uttarakhand',
    lat: 30.1,
    lng: 78.3,
    types: ['spiritual'],
    activities: ['rafting'],
    climate: 'mild',
    bestMonths: [10, 11],
    minNights: 2,
    collectedOn: '2026-10-12',
    reviewStatus: 'draft',
    costReviewStatus: 'draft',
    active,
  });
}

beforeAll(async () => {
  await ensureHub(db, 'test-hub');
  await ensureDestination('test-rishikesh', 'Test Rishikesh');
  await ensureDestination('test-closed', 'Test Closed', false);
});

afterAll(async () => {
  await pool.end();
});

const fieldsOf = (res: request.Response) => (res.body as ErrorEnvelope).error.fields ?? {};

describe('GET and PATCH /api/me/profile', () => {
  it('starts empty, sets the home city, clears it with null', async () => {
    const { agent } = await createTestUser(app);
    const empty = await agent.get('/api/me/profile').set(H);
    expect(ProfileResponse.parse(empty.body)).toEqual({ homeHubSlug: null, pastTrips: [] });

    const set = await agent.patch('/api/me/profile').set(H).send({ homeHubSlug: 'test-hub' });
    expect(set.status).toBe(200);
    expect(ProfileResponse.parse(set.body).homeHubSlug).toBe('test-hub');
    const me = await agent.get('/api/me').set(H);
    expect((me.body as { homeHubSlug: string }).homeHubSlug).toBe('test-hub');

    const cleared = await agent.patch('/api/me/profile').set(H).send({ homeHubSlug: null });
    expect(ProfileResponse.parse(cleared.body).homeHubSlug).toBeNull();
  });

  it('400 fields.homeHubSlug for an unknown hub', async () => {
    const { agent } = await createTestUser(app);
    const res = await agent.patch('/api/me/profile').set(H).send({ homeHubSlug: 'atlantis' });
    expect(res.status).toBe(400);
    expect(fieldsOf(res)).toEqual({ homeHubSlug: 'Choose a city from the list.' });
    const after = ProfileResponse.parse((await agent.get('/api/me/profile').set(H)).body);
    expect(after.homeHubSlug).toBeNull();
  });

  it('401 without a session on GET and PATCH', async () => {
    expect((await request(app).get('/api/me/profile').set(H)).status).toBe(401);
    expect(
      (await request(app).patch('/api/me/profile').set(H).send({ homeHubSlug: null })).status,
    ).toBe(401);
  });
});

describe('POST and DELETE /api/me/past-trips', () => {
  it('201 for a catalogue destination and for a free place name; listed in the profile', async () => {
    const { agent } = await createTestUser(app);
    const a = await agent
      .post('/api/me/past-trips')
      .set(H)
      .send({ destinationSlug: 'test-rishikesh', visitedOn: '2025-03-10', rating: 4 });
    expect(a.status).toBe(201);
    expect(PastTrip.parse(a.body)).toMatchObject({
      destination: { slug: 'test-rishikesh', name: 'Test Rishikesh' },
      placeName: null,
      visitedOn: '2025-03-10',
      rating: 4,
    });
    const b = await agent
      .post('/api/me/past-trips')
      .set(H)
      .send({ placeName: 'Chopta', rating: 5 });
    expect(PastTrip.parse(b.body)).toMatchObject({ destination: null, placeName: 'Chopta' });
    const profile = ProfileResponse.parse((await agent.get('/api/me/profile').set(H)).body);
    expect(profile.pastTrips.map((t) => t.rating)).toEqual([4, 5]);
  });

  it.each([
    [
      'both destinationSlug and placeName',
      { destinationSlug: 'test-rishikesh', placeName: 'X', rating: 4 },
      'placeName',
      'Choose a destination or name the place, not both.',
    ],
    ['rating 6', { placeName: 'X', rating: 6 }, 'rating', 'Choose a rating from 1 to 5.'],
    [
      'an unknown destinationSlug',
      { destinationSlug: 'nowhere', rating: 3 },
      'destinationSlug',
      'Choose a destination from the list.',
    ],
    [
      'an inactive destination',
      { destinationSlug: 'test-closed', rating: 3 },
      'destinationSlug',
      'Choose a destination from the list.',
    ],
    [
      'a visit date after today',
      { placeName: 'X', visitedOn: '2026-11-02', rating: 3 },
      'visitedOn',
      'The visit date cannot be in the future.',
    ],
  ])('400 for %s; nothing saved', async (_name, body, field, message) => {
    const { agent } = await createTestUser(app);
    const res = await agent.post('/api/me/past-trips').set(H).send(body);
    expect(res.status).toBe(400);
    expect(fieldsOf(res)).toEqual({ [field]: message });
    const after = ProfileResponse.parse((await agent.get('/api/me/profile').set(H)).body);
    expect(after.pastTrips).toEqual([]);
  });

  it("204 for your own row; 404 for someone else's row, a missing id or a malformed id", async () => {
    const owner = await createTestUser(app);
    const other = await createTestUser(app);
    const { id } = PastTrip.parse(
      (
        await owner.agent
          .post('/api/me/past-trips')
          .set(H)
          .send({ placeName: 'Mussoorie', rating: 4 })
      ).body,
    );
    const stolen = await other.agent.delete(`/api/me/past-trips/${id}`).set(H);
    expect(stolen.status).toBe(404);
    expect((await other.agent.delete('/api/me/past-trips/not-a-uuid').set(H)).status).toBe(404);
    expect((await owner.agent.delete(`/api/me/past-trips/${id}`).set(H)).status).toBe(204);
    expect((await owner.agent.delete(`/api/me/past-trips/${id}`).set(H)).status).toBe(404);
    expect((await request(app).delete(`/api/me/past-trips/${id}`).set(H)).status).toBe(401);
  });
});

describe('GET /api/destinations', () => {
  it('lists active destinations by name, without inactive ones; 401 without a session', async () => {
    const { agent } = await createTestUser(app);
    const res = await agent.get('/api/destinations').set(H);
    expect(res.status).toBe(200);
    const { destinations } = DestinationsResponse.parse(res.body);
    const slugs = destinations.map((d) => d.slug);
    expect(slugs).toContain('test-rishikesh');
    expect(slugs).not.toContain('test-closed');
    const names = destinations.map((d) => d.name);
    expect([...names].sort((x, y) => x.localeCompare(y))).toEqual(names);
    expect((await request(app).get('/api/destinations').set(H)).status).toBe(401);
  });
});
