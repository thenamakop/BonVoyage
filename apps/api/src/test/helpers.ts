import type { Db } from '@bonvoyage/db';
import { costRule, destination, hub, trip } from '@bonvoyage/db/schema';
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
  /** Defaults to a fresh address; pass one when the app must know it up front (ADMIN_EMAILS). */
  email = `t${Date.now().toString(36)}-${seq++}@test.bv`,
): Promise<{ agent: request.Agent; userId: string; email: string }> {
  const agent = request.agent(app);
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

/** The real catalogue's car-cost inputs (packages/db/catalogue/cost-rules.json). */
const COST_RULES: Record<string, { value: number; unit: string }> = {
  fuel_price_inr_per_litre: { value: 102.12, unit: 'INR/litre' },
  car_km_per_litre: { value: 15, unit: 'km/litre' },
  toll_inr_per_km: { value: 1.6, unit: 'INR/km' },
  persons_per_car: { value: 4, unit: 'persons' },
  car_rental_inr_per_day: { value: 2500, unit: 'INR/day' },
};

/**
 * Insert the five cost rules when they are missing (S2-6). Existing rows, for
 * example from a real catalogue import, are left alone; the values match.
 */
export async function ensureCostRules(db: Db): Promise<void> {
  await db
    .insert(costRule)
    .values(
      Object.entries(COST_RULES).map(([key, { value, unit }]) => ({
        key,
        value,
        unit,
        collectedOn: '2026-10-12',
        reviewStatus: 'draft' as const,
      })),
    )
    .onConflictDoNothing({ target: costRule.key });
}

/** Insert a catalogue hub with real coordinates if the slug is missing (S2-6). */
export async function ensureHubAt(
  db: Db,
  slug: string,
  lat: number,
  lng: number,
): Promise<{ id: string; slug: string }> {
  const existing = await db.select().from(hub).where(eq(hub.slug, slug)).limit(1);
  if (existing[0]) return existing[0];
  const rows = await db
    .insert(hub)
    .values({
      slug,
      name: slug,
      state: 'Testland',
      lat,
      lng,
      collectedOn: '2026-10-12',
      reviewStatus: 'draft',
    })
    .returning();
  return rows[0]!;
}

export interface FixtureDestination {
  slug: string;
  lat: number;
  lng: number;
  types?: string[];
  activities?: string[];
  climate?: 'cold' | 'mild' | 'warm';
  bestMonths?: number[];
  minNights?: number;
  /** Null leaves the destination incomplete (no costs yet). */
  stayBudgetInr?: number | null;
  foodPerDayInr?: number;
  localPerDayInr?: number;
}

/** Insert a fixture destination if the slug is missing (S2-6). Costs default to complete. */
export async function ensureDestination(db: Db, d: FixtureDestination): Promise<string> {
  const existing = await db
    .select({ id: destination.id })
    .from(destination)
    .where(eq(destination.slug, d.slug))
    .limit(1);
  if (existing[0]) return existing[0].id;
  const incomplete = d.stayBudgetInr === null;
  const rows = await db
    .insert(destination)
    .values({
      slug: d.slug,
      name: `Name of ${d.slug}`,
      state: 'Testland',
      lat: d.lat,
      lng: d.lng,
      types: d.types ?? ['mountain'],
      activities: d.activities ?? ['trekking'],
      climate: d.climate ?? 'mild',
      bestMonths: d.bestMonths ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      minNights: d.minNights ?? 1,
      stayBudgetInr: incomplete ? null : (d.stayBudgetInr ?? 1500),
      stayMidInr: incomplete ? null : 3000,
      stayPremiumInr: incomplete ? null : 6000,
      foodPerDayInr: incomplete ? null : (d.foodPerDayInr ?? 500),
      localPerDayInr: incomplete ? null : (d.localPerDayInr ?? 300),
      collectedOn: '2026-10-12',
      reviewStatus: 'draft',
      costReviewStatus: 'draft',
    })
    .returning({ id: destination.id });
  return rows[0]!.id;
}
