import type { Db } from '@bonvoyage/db';
import { destination, hub, pastTrip, trip, userProfile } from '@bonvoyage/db/schema';
import { user } from '@bonvoyage/db/schema/auth';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';

export async function findHomeHubSlug(db: Db, userId: string): Promise<string | null> {
  const rows = await db
    .select({ slug: hub.slug })
    .from(userProfile)
    .innerJoin(hub, eq(hub.id, userProfile.homeHubId))
    .where(eq(userProfile.userId, userId))
    .limit(1);
  return rows[0]?.slug ?? null;
}

export async function findHubId(db: Db, slug: string): Promise<string | undefined> {
  const rows = await db.select({ id: hub.id }).from(hub).where(eq(hub.slug, slug)).limit(1);
  return rows[0]?.id;
}

export async function upsertHomeHub(db: Db, userId: string, homeHubId: string | null) {
  await db
    .insert(userProfile)
    .values({ userId, homeHubId })
    .onConflictDoUpdate({ target: userProfile.userId, set: { homeHubId, updatedAt: new Date() } });
}

export interface PastTripRow {
  id: string;
  placeName: string | null;
  visitedOn: string | null;
  rating: number;
  destinationSlug: string | null;
  destinationName: string | null;
}

const pastTripColumns = {
  id: pastTrip.id,
  placeName: pastTrip.placeName,
  visitedOn: pastTrip.visitedOn,
  rating: pastTrip.rating,
  destinationSlug: destination.slug,
  destinationName: destination.name,
};

export async function listPastTrips(db: Db, userId: string): Promise<PastTripRow[]> {
  return db
    .select(pastTripColumns)
    .from(pastTrip)
    .leftJoin(destination, eq(destination.id, pastTrip.destinationId))
    .where(eq(pastTrip.userId, userId))
    .orderBy(sql`${pastTrip.visitedOn} desc nulls last`, desc(pastTrip.createdAt));
}

export async function findActiveDestination(
  db: Db,
  slug: string,
): Promise<{ id: string; slug: string; name: string } | undefined> {
  const rows = await db
    .select({ id: destination.id, slug: destination.slug, name: destination.name })
    .from(destination)
    .where(and(eq(destination.slug, slug), eq(destination.active, true)))
    .limit(1);
  return rows[0];
}

export async function insertPastTrip(
  db: Db,
  values: {
    userId: string;
    destinationId: string | null;
    placeName: string | null;
    visitedOn: string | null;
    rating: number;
  },
): Promise<string> {
  const rows = await db.insert(pastTrip).values(values).returning({ id: pastTrip.id });
  return rows[0]!.id;
}

/** Deletes only the caller's own row; returns false when nothing matched. */
export async function deleteOwnPastTrip(db: Db, userId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(pastTrip)
    .where(and(eq(pastTrip.id, id), eq(pastTrip.userId, userId)))
    .returning({ id: pastTrip.id });
  return rows.length > 0;
}

// #54 / 0005 j: trips the user organises that block or follow an account
// deletion. Planning statuses and in_progress block; finalised, completed and
// cancelled trips cascade with the user row.
export const DELETION_BLOCKING_STATUSES = [
  'draft',
  'collecting_preferences',
  'ready_for_recommendation',
  'shortlisted',
  'packages_proposed',
  'package_selected',
  'itinerary_proposed',
  'in_progress',
] as const;

export async function findBlockingTrips(
  db: Db,
  userId: string,
): Promise<{ id: string; title: string; status: string }[]> {
  return db
    .select({ id: trip.id, title: trip.title, status: trip.status })
    .from(trip)
    .where(
      and(eq(trip.organiserId, userId), inArray(trip.status, [...DELETION_BLOCKING_STATUSES])),
    );
}

// Sessions, accounts, user_profile, trip_member (+preferences), past_trip,
// package_decision, itinerary_decision, notification and the non-blocking
// organised trips all cascade from the user row.
export async function deleteUserRow(db: Db, userId: string): Promise<void> {
  await db.delete(user).where(eq(user.id, userId));
}
