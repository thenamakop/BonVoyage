import type { Db } from '@bonvoyage/db';
import { hub, trip } from '@bonvoyage/db/schema';
import { eq } from 'drizzle-orm';
import type { Express } from 'express';
import request from 'supertest';
import type { TripDetail, TripStatus } from '@bonvoyage/shared';

// Shared integration-test helpers (S1-2, reused by S1-3 to S1-7). Sign-up goes
// through the real Better Auth route with the Host/Origin headers it expects.

let seq = 0;

/** Headers Better Auth's origin checks accept in tests (same as the auth tests). */
const AUTH_HEADERS = { Host: 'localhost:5173', Origin: 'http://localhost:5173' };

/**
 * Sign up a fresh user and return a supertest agent carrying the session
 * cookie, plus the user's id and generated email. `name` is stored as-is.
 */
export async function createTestUser(
  app: Express,
  name = 'Test user',
): Promise<{ agent: request.Agent; userId: string; email: string }> {
  const agent = request.agent(app);
  const email = `t${Date.now().toString(36)}-${seq++}@test.bv`;
  await agent
    .post('/api/auth/sign-up/email')
    .set(AUTH_HEADERS)
    .send({ email, password: 'test-password-12+', name });
  const me = await agent.get('/api/me').set(AUTH_HEADERS);
  return { agent, userId: (me.body as { id: string }).id, email };
}

/**
 * Insert a catalogue hub if the slug is missing and return its row.
 * Coordinates are placeholders; reviewStatus stays 'draft'.
 */
export async function ensureHub(
  db: Db,
  slug: string,
): Promise<{ id: string; slug: string; name: string; state: string }> {
  const existing = await db.select().from(hub).where(eq(hub.slug, slug)).limit(1);
  if (existing[0]) return existing[0];
  const rows = await db
    .insert(hub)
    .values({
      slug,
      name: slug,
      state: 'Testland',
      lat: 28,
      lng: 77,
      collectedOn: '2026-10-12',
      reviewStatus: 'draft',
    })
    .returning();
  return rows[0]!;
}

/**
 * POST /api/trips as the agent and return the parsed TripDetail. The default
 * originHubSlug is 'test-hub', so call ensureHub(db, 'test-hub') first unless
 * overrides name a different slug.
 */
export async function createTripAs(
  agent: request.Agent,
  overrides: Partial<{
    title: string;
    originHubSlug: string;
    durationNights: number;
    budgetTotalInr: number;
    radiusKm: number;
  }> = {},
): Promise<TripDetail> {
  const res = await agent
    .post('/api/trips')
    .set(AUTH_HEADERS)
    .send({
      title: 'Test trip',
      originHubSlug: 'test-hub',
      durationNights: 2,
      budgetTotalInr: 20000,
      radiusKm: 300,
      ...overrides,
    });
  if (res.status !== 201) throw new Error(`createTripAs failed: ${JSON.stringify(res.body)}`);
  return res.body as TripDetail;
}

/**
 * Write trip.status directly. TEST SETUP ONLY: production code must go through
 * transitionTrip (AGENTS.md rule 6); tests use this to arrange states.
 */
export async function setTripStatus(db: Db, tripId: string, status: TripStatus) {
  await db.update(trip).set({ status }).where(eq(trip.id, tripId));
}
