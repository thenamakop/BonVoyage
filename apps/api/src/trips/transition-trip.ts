import type { Db } from '@bonvoyage/db';
import { trip, tripMember, tripTransition } from '@bonvoyage/db/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';
import {
  nextState,
  type ActionName,
  type NextStateResult,
  type TripEvent,
} from '@bonvoyage/engine';
import type { TripStatus } from '@bonvoyage/shared';
import { ERROR_CODES, indiaDate } from '@bonvoyage/shared';
import type { Logger } from 'pino';
import { AppError } from '../http/errors';
import { notifyTransition } from '../notifications/notify';

// transitionTrip is the ONLY code path that changes trip.status (AGENTS.md
// rule 6). Handlers run inside the transaction, so they must be fast and
// database-only; slow work (language-model calls) happens in the calling
// service, outside the row lock.

interface Deps {
  db: Db;
  logger: Logger;
  clock: () => Date;
}

export interface LockedTrip {
  id: string;
  status: TripStatus;
  startDate: string | null;
}

interface Input {
  tripId: string;
  event: TripEvent;
  actorUserId: string;
  feasibleCount?: number;
  alternativesLeft?: number;
  /**
   * Work that must commit with the transition (S1-3: the first invitation
   * row for T2). Runs after the row lock and before the guard context is
   * built; a throw here, or a rejected event, rolls all of it back.
   */
  beforeDecide?: (tx: Tx, lockedTrip: LockedTrip) => Promise<void>;
}

export interface TransitionOutcome {
  transitionId: string;
  kind: 'external' | 'internal';
  from: TripStatus;
  to: TripStatus;
  actions: readonly ActionName[];
}

const REASON_TO_ERROR: Record<string, string> = {
  ILLEGAL_EVENT: ERROR_CODES.ILLEGAL_TRANSITION,
  GUARD_FAILED: ERROR_CODES.GUARD_FAILED,
  PREFERENCES_LOCKED: ERROR_CODES.PREFERENCES_LOCKED,
  TERMINAL_STATE: ERROR_CODES.TRIP_CLOSED,
};

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

function deferred(name: ActionName, sprint: string, logger: Logger) {
  return () => {
    logger.debug(`action ${name} deferred to ${sprint}`);
    return Promise.resolve();
  };
}

/** What one transition's handlers share: who acted, and who they just excluded. */
interface RunContext {
  transitionId: string;
  actorUserId: string;
  now: Date;
  excludedUserIds: string[];
}

// One entry for EVERY ActionName; satisfies makes a missing action a type error.
const ACTION_HANDLERS = (tx: Tx, tripId: string, logger: Logger, run: RunContext) =>
  ({
    // S1
    assignOrganiser: deferred('assignOrganiser', 'S1', logger),
    // E3: joining by link, not T2, tells the organiser (member_joined); nobody
    // else exists when the first link is made, so T2 notifies no one.
    sendInvitations: deferred('sendInvitations', 'member_joined (invitations service)', logger),
    updateProgress: deferred('updateProgress', 'S1', logger),
    // S5-3: in-app notifications, in this transaction (see notifications/notify.ts).
    notifyMembers: () => notifyTransition(tx, { tripId, ...run }),
    openSubmissionWindow: deferred('openSubmissionWindow', 'S1', logger),
    validateTripParameters: deferred('validateTripParameters', 'S1', logger),
    // S2 (S2-6): these stay no-ops on purpose. The group profile is computed on
    // read (0004 b), and the filtering, ranking and diagnostic are computed in
    // apps/api/src/recommendations before the lock; that service stores the run
    // and its items in beforeDecide, inside this same transaction (rule S7).
    computeGroupProfile: deferred('computeGroupProfile', 'apps/api/src/recommendations', logger),
    reportConflict: deferred('reportConflict', 'apps/api/src/recommendations', logger),
    filterByHardConstraints: deferred(
      'filterByHardConstraints',
      'apps/api/src/recommendations',
      logger,
    ),
    rankByGroupFit: deferred('rankByGroupFit', 'apps/api/src/recommendations', logger),
    saveRankedShortlist: deferred('saveRankedShortlist', 'apps/api/src/recommendations', logger),
    showEmptyShortlistDiagnostic: deferred(
      'showEmptyShortlistDiagnostic',
      'apps/api/src/recommendations',
      logger,
    ),
    // S3
    generateAndCostPackages: deferred('generateAndCostPackages', 'S3', logger),
    recomputeCost: deferred('recomputeCost', 'S3', logger),
    hidePackage: deferred('hidePackage', 'S3', logger),
    lockPackage: deferred('lockPackage', 'S3', logger),
    // S4
    assembleDayWisePlan: deferred('assembleDayWisePlan', 'S4', logger),
    revalidate: deferred('revalidate', 'S4', logger),
    archiveToTripHistory: deferred('archiveToTripHistory', 'S4', logger),
    requestRatings: deferred('requestRatings', 'S4', logger),
    releaseHolds: deferred('releaseHolds', 'S4', logger),
    // 0001 f: implemented now — active members who never submitted are excluded.
    excludeNonSubmitters: async () => {
      const excluded = await tx
        .update(tripMember)
        .set({ status: 'excluded' })
        .where(
          and(
            eq(tripMember.tripId, tripId),
            eq(tripMember.status, 'active'),
            isNull(tripMember.submittedAt),
          ),
        )
        .returning({ userId: tripMember.userId });
      // notifyMembers follows on T3b and tells these members they were left out.
      run.excludedUserIds.push(...excluded.map((m) => m.userId));
    },
  }) satisfies Record<ActionName, () => Promise<unknown>>;

/**
 * Rejects an event the trip's current state cannot take, with the same 409 code
 * transitionTrip would give, before any slow work starts (S2-6). Guards are not
 * evaluated here; transitionTrip checks them under the lock.
 */
export function assertEventLegal(status: TripStatus, event: TripEvent, today: string): void {
  const result = nextState(status, event, {
    pendingCount: 0,
    submittedCount: 2,
    feasibleCount: 3,
    alternativesLeft: 1,
    today,
    startDate: null,
  });
  if (!result.ok && result.reason !== 'GUARD_FAILED') {
    // Safe: REASON_TO_ERROR has an entry for every reason nextState returns.
    throw new AppError(409, REASON_TO_ERROR[result.reason]!, result.message);
  }
}

export async function transitionTrip(
  { db, logger, clock }: Deps,
  { tripId, event, actorUserId, feasibleCount, alternativesLeft, beforeDecide }: Input,
): Promise<TransitionOutcome> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: trip.id,
        status: trip.status,
        startDate: trip.startDate,
      })
      .from(trip)
      .where(eq(trip.id, tripId))
      .for('update')
      .limit(1);
    const row = rows[0];
    if (!row) throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Trip not found.');

    if (beforeDecide) await beforeDecide(tx, row);

    const [counts] = await tx
      .select({
        pending: sql<number>`count(*) filter (where ${tripMember.submittedAt} is null)::int`,
        submitted: sql<number>`count(*) filter (where ${tripMember.submittedAt} is not null)::int`,
      })
      .from(tripMember)
      .where(and(eq(tripMember.tripId, tripId), eq(tripMember.status, 'active')));

    const result: NextStateResult = nextState(row.status, event, {
      pendingCount: counts?.pending ?? 0,
      submittedCount: counts?.submitted ?? 0,
      feasibleCount: feasibleCount ?? null,
      alternativesLeft: alternativesLeft ?? null,
      today: indiaDate(clock()),
      startDate: row.startDate,
    });

    if (!result.ok) {
      throw new AppError(409, REASON_TO_ERROR[result.reason]!, result.message);
    }

    if (result.kind === 'external') {
      await tx
        .update(trip)
        .set({ status: result.to, updatedAt: new Date() })
        .where(eq(trip.id, tripId));
    }
    await tx.insert(tripTransition).values({
      tripId,
      transitionId: result.transitionId,
      event,
      fromStatus: row.status,
      toStatus: result.to,
      actorUserId,
    });

    const run: RunContext = {
      transitionId: result.transitionId,
      actorUserId,
      now: clock(),
      excludedUserIds: [],
    };
    const handlers = ACTION_HANDLERS(tx, tripId, logger, run);
    for (const action of result.actions) {
      await handlers[action]();
    }
    // T6>T7, T11, T12 and T21 carry no notifyMembers action (E3): the API-side
    // map covers them, so 0001's table is unchanged. Never twice for one transition.
    if (!result.actions.includes('notifyMembers')) {
      await notifyTransition(tx, { tripId, ...run });
    }

    return {
      transitionId: result.transitionId,
      kind: result.kind,
      from: row.status,
      to: result.to,
      actions: result.actions,
    };
  });
}
