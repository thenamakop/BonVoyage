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

// One entry for EVERY ActionName; satisfies makes a missing action a type error.
const ACTION_HANDLERS = (tx: Tx, tripId: string, logger: Logger) =>
  ({
    // S1
    assignOrganiser: deferred('assignOrganiser', 'S1', logger),
    sendInvitations: deferred('sendInvitations', 'S1', logger),
    updateProgress: deferred('updateProgress', 'S1', logger),
    notifyMembers: deferred('notifyMembers', 'S1', logger),
    openSubmissionWindow: deferred('openSubmissionWindow', 'S1', logger),
    validateTripParameters: deferred('validateTripParameters', 'S1', logger),
    // S2
    computeGroupProfile: deferred('computeGroupProfile', 'S2', logger),
    reportConflict: deferred('reportConflict', 'S2', logger),
    filterByHardConstraints: deferred('filterByHardConstraints', 'S2', logger),
    rankByGroupFit: deferred('rankByGroupFit', 'S2', logger),
    saveRankedShortlist: deferred('saveRankedShortlist', 'S2', logger),
    showEmptyShortlistDiagnostic: deferred('showEmptyShortlistDiagnostic', 'S2', logger),
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
      await tx
        .update(tripMember)
        .set({ status: 'excluded' })
        .where(
          and(
            eq(tripMember.tripId, tripId),
            eq(tripMember.status, 'active'),
            isNull(tripMember.submittedAt),
          ),
        );
    },
  }) satisfies Record<ActionName, () => Promise<unknown>>;

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

    const handlers = ACTION_HANDLERS(tx, tripId, logger);
    for (const action of result.actions) {
      await handlers[action]();
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
