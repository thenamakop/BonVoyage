import type { NotificationPayload, NotificationType } from '@bonvoyage/shared';
import type { Tx } from '../trips/transition-trip';
import {
  findOrganiserUserId,
  findTripTitle,
  findUserName,
  insertNotifications,
  listMemberUserIds,
  type NewNotification,
} from './repository';

// S5-3 (decision E3): the writes that go with a transition or a join. They run
// on the caller's transaction, so a rolled-back transition writes nothing.

/**
 * Transition id -> notification type. T3b, T14, T15 and T16 reach this through
 * the state machine's own notifyMembers action; T6>T7, T11, T12 and T21 have no
 * such action, and 0001's table stays as it is, so transitionTrip also looks
 * them up here.
 */
export const NOTIFYING_TRANSITIONS: Readonly<Record<string, NotificationType>> = {
  T3b: 'submissions_closed',
  'T6>T7': 'shortlist_ready',
  T11: 'package_chosen',
  T12: 'plan_ready',
  T14: 'trip_finalised',
  T15: 'trip_cancelled',
  T16: 'trip_cancelled',
  T21: 'shortlist_reopened',
};

/** Types whose sentence names the member who acted. */
const NAMES_ACTOR: ReadonlySet<NotificationType> = new Set([
  'member_joined',
  'preferences_reminder',
  'shortlist_reopened',
  'package_chosen',
  'trip_cancelled',
]);

/** The payload: trip id, title and the type's own fields, nothing a member entered. */
export function buildPayload(
  type: NotificationType,
  tripId: string,
  tripTitle: string,
  actorName: string | undefined,
  excluded = false,
): NotificationPayload {
  return {
    tripId,
    tripTitle,
    ...(NAMES_ACTOR.has(type) && actorName !== undefined ? { actorName } : {}),
    ...(excluded ? { excluded: true } : {}),
  };
}

interface TransitionInput {
  tripId: string;
  transitionId: string;
  actorUserId: string;
  /** Members this transition just excluded (T3b), who get the "not included" sentence. */
  excludedUserIds: readonly string[];
  now: Date;
}

/**
 * Every active member hears of a transition except the actor; T3b tells all of
 * them, the organiser included, and the members it just excluded as well. A
 * transition with no entry in NOTIFYING_TRANSITIONS writes nothing.
 */
export async function notifyTransition(tx: Tx, input: TransitionInput): Promise<void> {
  const type = NOTIFYING_TRANSITIONS[input.transitionId];
  if (!type) return;
  const { tripId, actorUserId, now } = input;
  const [title, actorName, active] = await Promise.all([
    findTripTitle(tx, tripId),
    findUserName(tx, actorUserId),
    listMemberUserIds(tx, tripId, 'active'),
  ]);
  if (title === undefined) return;
  const recipients =
    type === 'submissions_closed' ? active : active.filter((id) => id !== actorUserId);
  const row = (userId: string, excluded: boolean): NewNotification => ({
    userId,
    tripId,
    type,
    payload: buildPayload(type, tripId, title, actorName, excluded),
    createdAt: now,
  });
  await insertNotifications(tx, [
    ...recipients.map((id) => row(id, false)),
    ...(type === 'submissions_closed' ? input.excludedUserIds.map((id) => row(id, true)) : []),
  ]);
}

/** A member joined by link: the organiser hears of it (E3 replaces T2's trip_opened). */
export async function notifyMemberJoined(
  tx: Tx,
  input: { tripId: string; joinerUserId: string; now: Date },
): Promise<void> {
  const { tripId, joinerUserId, now } = input;
  const [title, joinerName, organiserId] = await Promise.all([
    findTripTitle(tx, tripId),
    findUserName(tx, joinerUserId),
    findOrganiserUserId(tx, tripId),
  ]);
  if (title === undefined || organiserId === undefined || organiserId === joinerUserId) return;
  await insertNotifications(tx, [
    {
      userId: organiserId,
      tripId,
      type: 'member_joined',
      payload: buildPayload('member_joined', tripId, title, joinerName),
      createdAt: now,
    },
  ]);
}
