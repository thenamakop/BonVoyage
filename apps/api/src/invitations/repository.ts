import type { Db } from '@bonvoyage/db';
import { invitation, preference, trip, tripMember, user, vote } from '@bonvoyage/db/schema';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import type { MembershipRow, TripRow } from '../trips/access';
import type { Tx } from '../trips/transition-trip';

export type InvitationRow = typeof invitation.$inferSelect;

export async function insertInvitation(
  tx: Tx,
  values: { tripId: string; token: string; createdBy: string; expiresAt: Date },
): Promise<InvitationRow> {
  const rows = await tx.insert(invitation).values(values).returning();
  return rows[0]!;
}

/** The trip's active invitation that has not expired at `now`, newest first. */
export async function findActiveInvitation(
  db: Db | Tx,
  tripId: string,
  now: Date,
): Promise<InvitationRow | undefined> {
  const rows = await db
    .select()
    .from(invitation)
    .where(
      and(
        eq(invitation.tripId, tripId),
        eq(invitation.status, 'active'),
        gt(invitation.expiresAt, now),
      ),
    )
    .orderBy(desc(invitation.createdAt))
    .limit(1);
  return rows[0];
}

export async function revokeActiveInvitations(db: Db, tripId: string): Promise<void> {
  await db
    .update(invitation)
    .set({ status: 'revoked' })
    .where(and(eq(invitation.tripId, tripId), eq(invitation.status, 'active')));
}

export async function findInvitationByToken(
  db: Db | Tx,
  token: string,
): Promise<InvitationRow | undefined> {
  const rows = await db.select().from(invitation).where(eq(invitation.token, token)).limit(1);
  return rows[0];
}

/** Trip title, status and organiser name for the public preview. */
export async function findPreviewTrip(
  db: Db,
  tripId: string,
): Promise<{ title: string; status: TripRow['status']; organiserName: string } | undefined> {
  const rows = await db
    .select({ title: trip.title, status: trip.status, organiserName: user.name })
    .from(trip)
    .innerJoin(user, eq(user.id, trip.organiserId))
    .where(eq(trip.id, tripId))
    .limit(1);
  return rows[0];
}

/** Lock the trip row FOR UPDATE and return it, so roster changes serialise. */
export async function lockTrip(tx: Tx, tripId: string): Promise<TripRow | undefined> {
  const rows = await tx.select().from(trip).where(eq(trip.id, tripId)).for('update').limit(1);
  return rows[0];
}

export async function findMembership(
  db: Db | Tx,
  tripId: string,
  userId: string,
): Promise<MembershipRow | undefined> {
  const rows = await db
    .select()
    .from(tripMember)
    .where(and(eq(tripMember.tripId, tripId), eq(tripMember.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function countActive(db: Db | Tx, tripId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(tripMember)
    .where(and(eq(tripMember.tripId, tripId), eq(tripMember.status, 'active')));
  return row?.n ?? 0;
}

export async function insertMember(tx: Tx, tripId: string, userId: string): Promise<void> {
  await tx.insert(tripMember).values({ tripId, userId, role: 'member', status: 'active' });
}

export async function deleteMembership(tx: Tx, membershipId: string): Promise<void> {
  await tx.delete(tripMember).where(eq(tripMember.id, membershipId));
}

/**
 * Exclude a member and drop their preference and votes so they never count (S1-3,
 * R18). A vote can be here from an earlier shortlist, after T21 and T6>T8. T3b needs no
 * such delete: it excludes only members who never submitted, and they cannot have voted.
 */
export async function excludeMember(tx: Tx, membershipId: string): Promise<void> {
  await tx
    .update(tripMember)
    .set({ status: 'excluded', submittedAt: null })
    .where(eq(tripMember.id, membershipId));
  await tx.delete(preference).where(eq(preference.tripMemberId, membershipId));
  await tx.delete(vote).where(eq(vote.tripMemberId, membershipId));
}
