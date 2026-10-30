import type { Db } from '@bonvoyage/db';
import { legalEvents } from '@bonvoyage/engine';
import { ERROR_CODES, type RunVotes, type VoteInput } from '@bonvoyage/shared';
import type { Logger } from 'pino';
import { AppError } from '../http/errors';
import { countActive } from '../invitations/repository';
import { loadTripForMember, requireActiveMember, type MembershipRow } from '../trips/access';
import { transitionTrip, type Tx } from '../trips/transition-trip';
import {
  deleteVote,
  findLatestRun,
  findRunItemDestination,
  listRunItems,
  listRunVotes,
  upsertVote,
  type VoteRow,
} from './repository';

// R18 (decision E4): members vote on the shortlist as I6, which changes no state. The
// vote informs the organiser's choice and never makes it (0005 h), so T9 reads nothing
// from here. Rows are read per member, and only counts and the caller's own vote leave.

interface Deps {
  db: Db;
  logger: Logger;
  clock: () => Date;
}

/** E4: with 2 eligible members the first vote stays hidden until the second is in. */
export function votesView(
  rows: readonly VoteRow[],
  slugs: readonly string[],
  eligible: number,
  callerTripMemberId: string,
): RunVotes {
  const mine = rows.find((row) => row.tripMemberId === callerTripMemberId)?.slug;
  const waiting = eligible === 2 && rows.length < 2;
  return {
    ...(waiting
      ? {}
      : {
          counts: Object.fromEntries(
            slugs.map((slug) => [slug, rows.filter((row) => row.slug === slug).length]),
          ),
        }),
    voted: rows.length,
    eligible,
    ...(mine ? { mine } : {}),
  };
}

export async function readRunVotes(
  db: Db,
  tripId: string,
  runId: string,
  slugs: readonly string[],
  callerTripMemberId: string,
): Promise<RunVotes> {
  const [rows, eligible] = await Promise.all([listRunVotes(db, runId), countActive(db, tripId)]);
  return votesView(rows, slugs, eligible, callerTripMemberId);
}

/**
 * Both writes run as I6 under the trip lock, so a vote cannot land after T9 or T21. The
 * roster cannot change while shortlisted (lockForRosterChange), so the membership read
 * before the lock still holds.
 */
async function changeVote(
  deps: Deps,
  tripId: string,
  userId: string,
  write: (tx: Tx, runId: string | undefined, membership: MembershipRow) => Promise<void>,
): Promise<RunVotes> {
  const { db } = deps;
  const { membership } = await loadTripForMember(db, tripId, userId);
  requireActiveMember(membership);
  await transitionTrip(deps, {
    tripId,
    event: 'voteCast',
    actorUserId: userId,
    beforeDecide: async (tx, locked) => {
      // Asked first, so a bad slug after T9 still reads as closed. The table decides.
      if (!legalEvents(locked.status).includes('voteCast')) {
        throw new AppError(409, ERROR_CODES.ILLEGAL_TRANSITION, 'Voting has closed.');
      }
      const run = await findLatestRun(tx, tripId);
      await write(tx, run?.kind === 'shortlist' ? run.id : undefined, membership);
    },
  });
  const run = await findLatestRun(db, tripId);
  if (!run) throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Trip not found.');
  const items = await listRunItems(db, run.id);
  return readRunVotes(
    db,
    tripId,
    run.id,
    items.map((item) => item.destination.slug),
    membership.id,
  );
}

// PUT /api/trips/:id/vote: an active member, while shortlisted.
export function castVote(
  deps: Deps,
  tripId: string,
  userId: string,
  input: VoteInput,
): Promise<RunVotes> {
  return changeVote(deps, tripId, userId, async (tx, runId, membership) => {
    const destinationId = runId
      ? await findRunItemDestination(tx, runId, input.destinationSlug)
      : undefined;
    if (!runId || !destinationId) {
      throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Some fields are invalid.', {
        destinationSlug: 'Choose a destination from the shortlist.',
      });
    }
    await upsertVote(tx, { runId, tripMemberId: membership.id, destinationId });
  });
}

// DELETE /api/trips/:id/vote: withdrawing a vote you never cast changes nothing.
export function withdrawVote(deps: Deps, tripId: string, userId: string): Promise<RunVotes> {
  return changeVote(deps, tripId, userId, async (tx, runId, membership) => {
    if (runId) await deleteVote(tx, runId, membership.id);
  });
}
