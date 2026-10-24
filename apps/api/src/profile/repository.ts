import type { Db } from '@bonvoyage/db';
import { destination, hub, pastTrip, userProfile } from '@bonvoyage/db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';

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
