import type { Db } from '@bonvoyage/db';
import { notification, trip, tripMember, user } from '@bonvoyage/db/schema';
import { and, desc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import type { Tx } from '../trips/transition-trip';

// S5-3: the queries behind in-app notifications. Every function takes the
// caller's transaction where a write must commit with a transition.

export type NotificationRow = typeof notification.$inferSelect;
export type NewNotification = typeof notification.$inferInsert;

export async function insertNotifications(
  tx: Db | Tx,
  rows: readonly NewNotification[],
): Promise<void> {
  if (rows.length === 0) return;
  await tx.insert(notification).values([...rows]);
}

/** The trip's title (for the payload) and status. */
export async function findTripHeader(
  tx: Db | Tx,
  tripId: string,
): Promise<{ title: string; status: typeof trip.$inferSelect.status } | undefined> {
  const rows = await tx
    .select({ title: trip.title, status: trip.status })
    .from(trip)
    .where(eq(trip.id, tripId));
  return rows[0];
}

/** The trip's title, for the payload. */
export async function findTripTitle(tx: Db | Tx, tripId: string): Promise<string | undefined> {
  return (await findTripHeader(tx, tripId))?.title;
}

export async function findUserName(tx: Db | Tx, userId: string): Promise<string | undefined> {
  const rows = await tx.select({ name: user.name }).from(user).where(eq(user.id, userId));
  return rows[0]?.name;
}

/** Display names for a page of notifications, in one query; a deleted user is simply absent. */
export async function findUserNames(
  db: Db,
  userIds: readonly string[],
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(inArray(user.id, [...userIds]));
  return new Map(rows.map((r) => [r.id, r.name]));
}

/** User ids of the trip's members with this status, oldest member first. */
export async function listMemberUserIds(
  tx: Db | Tx,
  tripId: string,
  status: 'active' | 'excluded',
): Promise<string[]> {
  const rows = await tx
    .select({ userId: tripMember.userId })
    .from(tripMember)
    .where(and(eq(tripMember.tripId, tripId), eq(tripMember.status, status)))
    .orderBy(tripMember.joinedAt, tripMember.id);
  return rows.map((r) => r.userId);
}

export async function findOrganiserUserId(
  tx: Db | Tx,
  tripId: string,
): Promise<string | undefined> {
  const rows = await tx
    .select({ userId: tripMember.userId })
    .from(tripMember)
    .where(
      and(
        eq(tripMember.tripId, tripId),
        eq(tripMember.role, 'organiser'),
        eq(tripMember.status, 'active'),
      ),
    )
    .limit(1);
  return rows[0]?.userId;
}

export async function listForUser(
  db: Db,
  userId: string,
  limit: number,
): Promise<NotificationRow[]> {
  return db
    .select()
    .from(notification)
    .where(eq(notification.userId, userId))
    .orderBy(desc(notification.createdAt), desc(notification.id))
    .limit(limit);
}

export async function countUnread(db: Db, userId: string): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notification)
    .where(and(eq(notification.userId, userId), isNull(notification.readAt)));
  return rows[0]?.n ?? 0;
}

/** False when the row is not this user's (or does not exist). Already read stays as it was. */
export async function markRead(db: Db, id: string, userId: string, now: Date): Promise<boolean> {
  const rows = await db
    .update(notification)
    .set({ readAt: sql`coalesce(${notification.readAt}, ${now.toISOString()}::timestamptz)` })
    .where(and(eq(notification.id, id), eq(notification.userId, userId)))
    .returning({ id: notification.id });
  return rows.length > 0;
}

export async function markAllRead(db: Db, userId: string, now: Date): Promise<void> {
  await db
    .update(notification)
    .set({ readAt: now })
    .where(and(eq(notification.userId, userId), isNull(notification.readAt)));
}

/**
 * Serialises reminders to one member of one trip until the transaction ends, so
 * two quick clicks cannot both pass the 24-hour check (decision E3).
 */
export async function lockReminder(tx: Tx, tripId: string, userId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${tripId}), hashtext(${userId}))`);
}

/** The newest reminder for this member on this trip at or after `since`. */
export async function findRecentReminder(
  tx: Tx,
  tripId: string,
  userId: string,
  since: Date,
): Promise<Date | undefined> {
  const rows = await tx
    .select({ createdAt: notification.createdAt })
    .from(notification)
    .where(
      and(
        eq(notification.tripId, tripId),
        eq(notification.userId, userId),
        eq(notification.type, 'preferences_reminder'),
        // Strictly after: a reminder exactly 24 hours old no longer counts.
        gt(notification.createdAt, since),
      ),
    )
    .orderBy(desc(notification.createdAt))
    .limit(1);
  return rows[0]?.createdAt;
}
