import type { Db } from '@bonvoyage/db';
import {
  budgetReviewAgainText,
  ERROR_CODES,
  notificationMessage,
  NotificationPayload,
  NOTIFICATIONS_PAGE,
  remindAgainText,
  REMIND_WINDOW_HOURS,
  type BudgetReviewResponse,
  type NotificationItem,
  type NotificationsResponse,
  type NotificationType,
  type RemindResponse,
} from '@bonvoyage/shared';
import { AppError, RateLimitError } from '../http/errors';
import { findMembership } from '../invitations/repository';
import { findLatestRun } from '../recommendations/repository';
import { loadTripForMember, requireActiveMember, requireOrganiser } from '../trips/access';
import { buildPayload } from './notify';
import {
  countUnread,
  findRecentBudgetReview,
  findRecentReminder,
  findTripHeader,
  findUserName,
  findUserNames,
  insertNotifications,
  listForUser,
  listMemberUserIds,
  listRecentReminders,
  lockBudgetReview,
  lockReminder,
  markAllRead,
  markRead,
  type NotificationRow,
} from './repository';

// S5-3 (decisions E3 and M4): reading your own notifications and the
// organiser's rate-limited reminder. No email, no push, no outside service.

const REMIND_WINDOW_MS = REMIND_WINDOW_HOURS * 3_600_000;

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

const notPending = (message: string) => new AppError(409, ERROR_CODES.MEMBER_NOT_PENDING, message);

/**
 * When each member reminded inside the window may next be reminded, so the trip
 * detail can tell the organiser after a reload (S5-3). A member not in the map
 * can be reminded now.
 */
export async function nextReminderTimes(
  db: Db,
  tripId: string,
  now: Date,
): Promise<Map<string, string>> {
  const recent = await listRecentReminders(db, tripId, new Date(now.getTime() - REMIND_WINDOW_MS));
  return new Map(
    [...recent].map(([userId, at]) => [
      userId,
      new Date(at.getTime() + REMIND_WINDOW_MS).toISOString(),
    ]),
  );
}

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
      new Date(now.getTime() - REMIND_WINDOW_MS),
    );
    if (last) {
      const targetName = await findUserName(tx, targetUserId);
      const again = new Date(last.getTime() + REMIND_WINDOW_MS);
      throw new RateLimitError(
        remindAgainText(targetName ?? '', again),
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
      canRemindAgainAt: new Date(now.getTime() + REMIND_WINDOW_MS).toISOString(),
    };
  });
}

/** The run document's suggestions, read loosely: only raisesBoth matters here. */
export function latestRunOffersRaisesBoth(doc: unknown): boolean {
  const suggestions = (
    doc as { diagnostic?: { suggestions?: { constraint?: string; raisesBoth?: boolean }[] } | null }
  )?.diagnostic?.suggestions;
  return (
    Array.isArray(suggestions) &&
    suggestions.some((s) => s.constraint === 'F5' && s.raisesBoth === true)
  );
}

/**
 * POST /api/trips/:id/budget-review (#163, option A): the organiser asks every
 * member to review their budget maximum when a raisesBoth suggestion is live.
 * One request per trip per rolling 24 hours, behind the same advisory-lock and
 * notification-row check as the per-member reminder. The notification names no
 * figure, so the organiser never learns a member's maximum.
 */
export async function requestBudgetReview(
  deps: { db: Db; clock: () => Date },
  tripId: string,
  organiserUserId: string,
): Promise<BudgetReviewResponse> {
  const { db, clock } = deps;
  const { membership } = await loadTripForMember(db, tripId, organiserUserId);
  requireActiveMember(membership);
  requireOrganiser(membership);

  return db.transaction(async (tx) => {
    await lockBudgetReview(tx, tripId);

    // Read under the lock: the run and the status may have moved since the
    // organiser's page loaded.
    const header = await findTripHeader(tx, tripId);
    // Members can only edit preferences in these two statuses (actions.ts).
    if (
      header?.status !== 'collecting_preferences' &&
      header?.status !== 'ready_for_recommendation'
    ) {
      throw new AppError(
        409,
        ERROR_CODES.ILLEGAL_TRANSITION,
        'Members can no longer review their budgets.',
      );
    }
    const run = await findLatestRun(tx, tripId);
    if (run?.kind !== 'diagnostic' || !latestRunOffersRaisesBoth(run.diagnostic)) {
      throw new AppError(
        409,
        ERROR_CODES.ILLEGAL_TRANSITION,
        'There is no suggestion that needs both budgets to move.',
      );
    }

    const now = clock();
    const last = await findRecentBudgetReview(
      tx,
      tripId,
      new Date(now.getTime() - REMIND_WINDOW_MS),
    );
    if (last) {
      const again = new Date(last.getTime() + REMIND_WINDOW_MS);
      throw new RateLimitError(
        budgetReviewAgainText(again),
        Math.max(1, Math.ceil((again.getTime() - now.getTime()) / 1000)),
      );
    }

    const recipients = (await listMemberUserIds(tx, tripId, 'active')).filter(
      (id) => id !== organiserUserId,
    );
    await insertNotifications(
      tx,
      recipients.map((userId) => ({
        userId,
        tripId,
        type: 'budget_review_requested',
        payload: buildPayload('budget_review_requested', tripId, header.title, organiserUserId),
        createdAt: now,
      })),
    );
    return {
      requestedAt: now.toISOString(),
      canRequestAgainAt: new Date(now.getTime() + REMIND_WINDOW_MS).toISOString(),
    };
  });
}

/** When the organiser may next send a budget-review request; null means now (#163). */
export async function nextBudgetReviewAt(
  db: Db,
  tripId: string,
  now: Date,
): Promise<string | null> {
  const last = await findRecentBudgetReview(db, tripId, new Date(now.getTime() - REMIND_WINDOW_MS));
  return last ? new Date(last.getTime() + REMIND_WINDOW_MS).toISOString() : null;
}
