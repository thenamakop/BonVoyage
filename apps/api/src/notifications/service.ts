import type { Db } from '@bonvoyage/db';
import {
  ERROR_CODES,
  indiaDateTime,
  notificationMessage,
  NotificationPayload,
  NOTIFICATIONS_PAGE,
  REMIND_WINDOW_HOURS,
  type NotificationItem,
  type NotificationsResponse,
  type NotificationType,
  type RemindResponse,
} from '@bonvoyage/shared';
import { AppError, RateLimitError } from '../http/errors';
import { findMembership } from '../invitations/repository';
import { loadTripForMember, requireActiveMember, requireOrganiser } from '../trips/access';
import { buildPayload } from './notify';
import {
  countUnread,
  findRecentReminder,
  findTripHeader,
  findUserName,
  findUserNames,
  insertNotifications,
  listForUser,
  lockReminder,
  markAllRead,
  markRead,
  type NotificationRow,
} from './repository';

// S5-3 (decisions E3 and M4): reading your own notifications and the
// organiser's rate-limited reminder. No email, no push, no outside service.

const HOUR_MS = 3_600_000;

/**
 * The response item. The actor's id stays in the payload, server side: only the
 * sentence built from their current name leaves (null once the account is gone).
 */
function toItem(
  row: NotificationRow,
  payload: NotificationPayload,
  names: ReadonlyMap<string, string>,
): NotificationItem {
  // The column holds the type as text; the writers only ever store a known one.
  const type = row.type as NotificationType;
  const actorName = payload.actorUserId ? (names.get(payload.actorUserId) ?? null) : null;
  return {
    id: row.id,
    type,
    tripId: row.tripId,
    tripTitle: payload.tripTitle,
    message: notificationMessage(type, payload, actorName),
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
  };
}

// GET /api/notifications: your own only, newest first. Names are looked up
// now, in one query for the page, so a renamed or deleted account reads right.
export async function getNotifications(db: Db, userId: string): Promise<NotificationsResponse> {
  const [rows, unreadCount] = await Promise.all([
    listForUser(db, userId, NOTIFICATIONS_PAGE),
    countUnread(db, userId),
  ]);
  const payloads = rows.map((row) => NotificationPayload.parse(row.payload));
  const actorIds = [...new Set(payloads.flatMap((p) => (p.actorUserId ? [p.actorUserId] : [])))];
  const names = await findUserNames(db, actorIds);
  return {
    // Safe: payloads was mapped from rows, so index i exists.
    items: rows.map((row, i) => toItem(row, payloads[i]!, names)),
    unreadCount,
  };
}

// POST /api/notifications/:id/read. Someone else's id is a 404, the same as an
// id that does not exist, so one user can never learn another's ids.
export async function readNotification(
  db: Db,
  clock: () => Date,
  userId: string,
  id: string,
): Promise<void> {
  if (!(await markRead(db, id, userId, clock()))) {
    throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Notification not found.');
  }
}

export async function readAllNotifications(
  db: Db,
  clock: () => Date,
  userId: string,
): Promise<void> {
  await markAllRead(db, userId, clock());
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

const notPending = (message: string) => new AppError(409, ERROR_CODES.MEMBER_NOT_PENDING, message);

// POST /api/trips/:id/members/:userId/remind: the organiser nudges a member who
// has not submitted, once per member per rolling 24 hours (E3). The check reads
// the notification table itself, behind an advisory lock on (trip, member), so
// two quick clicks cannot both pass.
export async function remindMember(
  deps: { db: Db; clock: () => Date },
  tripId: string,
  organiserUserId: string,
  targetUserId: string,
): Promise<RemindResponse> {
  const { db, clock } = deps;
  const { membership } = await loadTripForMember(db, tripId, organiserUserId);
  requireActiveMember(membership);
  requireOrganiser(membership);

  return db.transaction(async (tx) => {
    await lockReminder(tx, tripId, targetUserId);

    // Everything below is read under the lock: the member may have submitted, or
    // the trip may have moved on, since the organiser's page loaded.
    const target = await findMembership(tx, tripId, targetUserId);
    if (!target) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'That person is not a member of this trip.');
    }
    if (target.userId === organiserUserId) {
      throw notPending('You can remind other members, not yourself.');
    }
    if (target.status !== 'active') throw notPending('That person is no longer in the trip.');
    if (target.submittedAt !== null) {
      throw notPending('That person has already added their preferences.');
    }
    const header = await findTripHeader(tx, tripId);
    if (header?.status !== 'collecting_preferences') {
      throw notPending('Preferences are no longer being collected.');
    }

    const now = clock();
    const last = await findRecentReminder(
      tx,
      tripId,
      targetUserId,
      new Date(now.getTime() - REMIND_WINDOW_HOURS * HOUR_MS),
    );
    if (last) {
      const targetName = await findUserName(tx, targetUserId);
      const again = new Date(last.getTime() + REMIND_WINDOW_HOURS * HOUR_MS);
      throw new RateLimitError(
        `You can remind ${firstName(targetName ?? 'this member')} again after ${indiaDateTime(again)}`,
        Math.max(1, Math.ceil((again.getTime() - now.getTime()) / 1000)),
      );
    }

    await insertNotifications(tx, [
      {
        userId: targetUserId,
        tripId,
        type: 'preferences_reminder',
        payload: buildPayload('preferences_reminder', tripId, header.title, organiserUserId),
        createdAt: now,
      },
    ]);
    return {
      remindedAt: now.toISOString(),
      canRemindAgainAt: new Date(now.getTime() + REMIND_WINDOW_HOURS * HOUR_MS).toISOString(),
    };
  });
}
