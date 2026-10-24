import type { Db } from '@bonvoyage/db';
import { destination, hub, trip, tripMember, tripTransition, user } from '@bonvoyage/db/schema';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { MembershipRow, TripRow } from './access';

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export type HubRow = typeof hub.$inferSelect;

export async function findHubBySlug(db: Db | Tx, slug: string): Promise<HubRow | undefined> {
  const rows = await db.select().from(hub).where(eq(hub.slug, slug)).limit(1);
  return rows[0];
}

export async function listHubs(db: Db): Promise<HubRow[]> {
  return db.select().from(hub).orderBy(asc(hub.name));
}

export async function listActiveDestinations(db: Db) {
  return db
    .select({ slug: destination.slug, name: destination.name, state: destination.state })
    .from(destination)
    .where(eq(destination.active, true))
    .orderBy(asc(destination.name));
}

export async function findSelectedDestination(db: Db, id: string | null) {
  if (id === null) return null;
  const rows = await db
    .select({ slug: destination.slug, name: destination.name, state: destination.state })
    .from(destination)
    .where(eq(destination.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function insertTrip(
  tx: Tx,
  values: {
    title: string;
    organiserId: string;
    originHubId: string;
    durationNights: number;
    budgetTotalInr: number;
    radiusKm: number;
    status: TripRow['status'];
  },
): Promise<TripRow> {
  const rows = await tx.insert(trip).values(values).returning();
  return rows[0]!;
}

export async function insertOrganiserMember(tx: Tx, tripId: string, userId: string) {
  await tx.insert(tripMember).values({ tripId, userId, role: 'organiser', status: 'active' });
}

export interface MemberWithName {
  member: MembershipRow;
  name: string;
}

export async function listMembersWithNames(db: Db, tripId: string): Promise<MemberWithName[]> {
  const rows = await db
    .select({ member: tripMember, name: user.name })
    .from(tripMember)
    .innerJoin(user, eq(user.id, tripMember.userId))
    .where(eq(tripMember.tripId, tripId))
    .orderBy(asc(tripMember.joinedAt));
  return rows;
}

export interface TripListRow {
  trip: TripRow;
  hub: HubRow;
  membership: MembershipRow;
}

export async function listMembershipTrips(db: Db, userId: string): Promise<TripListRow[]> {
  return db
    .select({ trip, hub, membership: tripMember })
    .from(tripMember)
    .innerJoin(trip, eq(trip.id, tripMember.tripId))
    .innerJoin(hub, eq(hub.id, trip.originHubId))
    .where(eq(tripMember.userId, userId))
    .orderBy(desc(trip.updatedAt));
}

export async function countActiveMembers(db: Db, tripIds: string[]): Promise<Map<string, number>> {
  if (tripIds.length === 0) return new Map();
  const rows = await db
    .select({
      tripId: tripMember.tripId,
      n: sql<number>`count(*)::int`,
    })
    .from(tripMember)
    .where(and(inArray(tripMember.tripId, tripIds), eq(tripMember.status, 'active')))
    .groupBy(tripMember.tripId);
  return new Map(rows.map((r) => [r.tripId, r.n]));
}

/** created_at of the trip's newest transition row, or null. */
export async function newestTransitionAt(db: Db, tripId: string): Promise<Date | null> {
  const rows = await db
    .select({ at: tripTransition.createdAt })
    .from(tripTransition)
    .where(eq(tripTransition.tripId, tripId))
    .orderBy(desc(tripTransition.createdAt))
    .limit(1);
  return rows[0]?.at ?? null;
}

export interface ActivityRow {
  id: string;
  transitionId: string;
  event: string;
  fromStatus: TripRow['status'] | null;
  toStatus: TripRow['status'];
  createdAt: Date;
  actorName: string | null;
}

/** The newest transition rows with the actor's name; emails are never selected. */
export async function listActivity(db: Db, tripId: string, limit: number): Promise<ActivityRow[]> {
  return db
    .select({
      id: tripTransition.id,
      transitionId: tripTransition.transitionId,
      event: tripTransition.event,
      fromStatus: tripTransition.fromStatus,
      toStatus: tripTransition.toStatus,
      createdAt: tripTransition.createdAt,
      actorName: user.name,
    })
    .from(tripTransition)
    .leftJoin(user, eq(user.id, tripTransition.actorUserId))
    .where(eq(tripTransition.tripId, tripId))
    .orderBy(desc(tripTransition.createdAt), desc(tripTransition.id))
    .limit(limit);
}

export async function lockTripStatus(
  tx: Tx,
  tripId: string,
): Promise<TripRow['status'] | undefined> {
  const rows = await tx
    .select({ status: trip.status })
    .from(trip)
    .where(eq(trip.id, tripId))
    .for('update')
    .limit(1);
  return rows[0]?.status;
}

export async function updateTripFields(
  tx: Tx,
  tripId: string,
  patch: Partial<{
    title: string;
    originHubId: string;
    durationNights: number;
    budgetTotalInr: number;
    radiusKm: number;
  }>,
) {
  await tx
    .update(trip)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(trip.id, tripId));
}
