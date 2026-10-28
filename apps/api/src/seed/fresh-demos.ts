import type { Db } from '@bonvoyage/db';
import { trip, tripMember } from '@bonvoyage/db/schema';
import { user } from '@bonvoyage/db/schema/auth';
import type { TripStatus } from '@bonvoyage/shared';
import { and, asc, eq, inArray, like, notLike } from 'drizzle-orm';

// S3-8: --fresh-demos. Each demo trip works once, so preview is reset by
// deleting every trip a demo user organises; the seed then builds them again.
// Everything a trip owns (members, preferences, runs, packages, cost lines,
// opinions, itineraries, items, decisions, notifications) cascades from trip.
// Demo users keep their accounts and password.

export const DEMO_EMAIL_DOMAIN = '@demo.bonvoyage.test';

export interface DeletedTrip {
  title: string;
  status: TripStatus;
}

/**
 * Delete every trip organised by a demo user, in one transaction. Refuses,
 * deleting nothing, when anyone outside the demo users belongs to one of them.
 */
export async function deleteDemoTrips(db: Db): Promise<DeletedTrip[]> {
  return db.transaction(async (tx) => {
    const demoTrips = await tx
      .select({ id: trip.id, title: trip.title, status: trip.status })
      .from(trip)
      .innerJoin(user, eq(user.id, trip.organiserId))
      .where(like(user.email, `%${DEMO_EMAIL_DOMAIN}`))
      .orderBy(asc(trip.createdAt));
    if (demoTrips.length === 0) return [];
    const ids = demoTrips.map((t) => t.id);

    const shared = await tx
      .selectDistinct({ title: trip.title })
      .from(tripMember)
      .innerJoin(trip, eq(trip.id, tripMember.tripId))
      .innerJoin(user, eq(user.id, tripMember.userId))
      .where(and(inArray(tripMember.tripId, ids), notLike(user.email, `%${DEMO_EMAIL_DOMAIN}`)));
    if (shared.length > 0) {
      throw new Error(
        `Refusing --fresh-demos: a non-demo user belongs to ${shared.map((s) => `"${s.title}"`).join(', ')}. Nothing was deleted.`,
      );
    }

    await tx.delete(trip).where(inArray(trip.id, ids));
    return demoTrips.map(({ title, status }) => ({ title, status }));
  });
}
