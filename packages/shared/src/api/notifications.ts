import { z } from 'zod';
import { indiaDateTime } from '../time';

// S5-3 (decision E3, M4): in-app notifications and the organiser's reminder.
// A payload holds the trip id, the trip's title and the type's own fields
// only: never a preference, budget, date, score or vote.

export const NOTIFICATION_TYPES = [
  'member_joined',
  'preferences_reminder',
  'submissions_closed',
  'shortlist_ready',
  'shortlist_reopened',
  'package_chosen',
  'plan_ready',
  'trip_finalised',
  'trip_cancelled',
] as const;
export const NotificationType = z.enum(NOTIFICATION_TYPES);
export type NotificationType = z.infer<typeof NotificationType>;

/**
 * What is stored in notification.payload (server side only; never returned).
 * The actor is kept by id, and the name looked up when the list is read, so
 * a deleted account is never named.
 */
export const NotificationPayload = z.object({
  tripId: z.string(),
  tripTitle: z.string(),
  /** The member who joined, or the organiser who acted or reminded. */
  actorUserId: z.string().optional(),
  /** submissions_closed only: this member did not submit before preferences closed. */
  excluded: z.boolean().optional(),
});
export type NotificationPayload = z.infer<typeof NotificationPayload>;

/** The actor's words when their account no longer exists. */
export const FORMER_MEMBER = 'A former member';

/**
 * One sentence per type (the web renders it as sent). `actorName` is the actor's
 * current display name, or null once their account is gone.
 */
export function notificationMessage(
  type: NotificationType,
  payload: Pick<NotificationPayload, 'excluded'>,
  actorName: string | null,
): string {
  const actor = actorName ?? FORMER_MEMBER;
  switch (type) {
    case 'member_joined':
      return `${actor} joined the trip`;
    case 'preferences_reminder':
      return `${actor} asked you to add your preferences`;
    case 'submissions_closed':
      return payload.excluded
        ? 'You were not included because preferences closed before you submitted'
        : 'Preferences are closed. The trip is ready for recommendations';
    case 'shortlist_ready':
      return 'A shortlist of destinations is ready';
    case 'shortlist_reopened':
      return `${actor} asked for new recommendations`;
    case 'package_chosen':
      return `${actor} chose a package`;
    case 'plan_ready':
      return 'A day plan is ready to look at';
    case 'trip_finalised':
      return 'The trip is finalised';
    case 'trip_cancelled':
      return `${actor} cancelled the trip`;
  }
}

export const NotificationItem = z.object({
  id: z.string(),
  type: NotificationType,
  tripId: z.string().nullable(),
  tripTitle: z.string(),
  message: z.string(),
  createdAt: z.string(),
  /** null while unread. */
  readAt: z.string().nullable(),
});
export type NotificationItem = z.infer<typeof NotificationItem>;

/** GET /api/notifications: the caller's own, newest first, 30 at most. */
export const NOTIFICATIONS_PAGE = 30;
export const NotificationsResponse = z.object({
  items: z.array(NotificationItem),
  /** Every unread one, not only those in `items`. */
  unreadCount: z.number().int(),
});
export type NotificationsResponse = z.infer<typeof NotificationsResponse>;

/** A reminder may go to the same member once in this many hours (E3, a rolling window). */
export const REMIND_WINDOW_HOURS = 24;

/** The 429's message and the disabled Remind button's reason: one sentence, both places. */
export function remindAgainText(memberName: string, at: Date): string {
  const firstName = memberName.trim().split(/\s+/)[0] || 'this member';
  return `You can remind ${firstName} again after ${indiaDateTime(at)}`;
}

export const RemindResponse = z.object({
  remindedAt: z.string(),
  /** When the organiser may remind this member again. */
  canRemindAgainAt: z.string(),
});
export type RemindResponse = z.infer<typeof RemindResponse>;
