import type { Db } from '@bonvoyage/db';
import { itinerary, itineraryItem, poi, tripPackage } from '@bonvoyage/db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { Tx } from '../trips/transition-trip';

type Reader = Db | Tx;

/** The trip's accepted package (there is at most one after T11). */
export async function findAcceptedPackage(db: Reader, tripId: string) {
  const rows = await db
    .select()
    .from(tripPackage)
    .where(and(eq(tripPackage.tripId, tripId), eq(tripPackage.status, 'accepted')))
    .limit(1);
  return rows[0];
}

/** Place key -> poi row, so "<slug>/<poi_key>" resolves to poi.id (S3-3). */
export async function listActivePois(db: Reader, destinationId: string) {
  return db.select().from(poi).where(eq(poi.destinationId, destinationId));
}

export async function latestItineraryForTrip(db: Reader, tripId: string) {
  const rows = await db
    .select({
      itinerary,
      packageLabel: tripPackage.label,
      packageStartDate: tripPackage.startDate,
    })
    .from(itinerary)
    .innerJoin(tripPackage, eq(tripPackage.id, itinerary.packageId))
    .where(eq(tripPackage.tripId, tripId))
    .orderBy(desc(itinerary.generatedAt))
    .limit(1);
  return rows[0];
}

export async function latestItinerarySummary(db: Reader, tripId: string) {
  const row = await latestItineraryForTrip(db, tripId);
  return row ? { version: row.itinerary.version, status: row.itinerary.status } : null;
}

export async function listItems(db: Reader, itineraryId: string) {
  return db
    .select({ item: itineraryItem, poi })
    .from(itineraryItem)
    .leftJoin(poi, eq(poi.id, itineraryItem.poiId))
    .where(eq(itineraryItem.itineraryId, itineraryId))
    .orderBy(itineraryItem.dayNumber, itineraryItem.position);
}

export async function nextVersion(tx: Tx, packageId: string): Promise<number> {
  const [row] = await tx
    .select({ max: sql<number | null>`max(${itinerary.version})` })
    .from(itinerary)
    .where(eq(itinerary.packageId, packageId));
  return (row?.max ?? 0) + 1;
}

export async function insertItinerary(
  tx: Tx,
  values: typeof itinerary.$inferInsert,
): Promise<{ id: string }> {
  const rows = await tx.insert(itinerary).values(values).returning({ id: itinerary.id });
  // Safe: an INSERT ... RETURNING of one row returns that row or throws.
  return rows[0]!;
}
