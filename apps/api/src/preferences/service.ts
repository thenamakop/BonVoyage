import type { Db } from '@bonvoyage/db';
import {
  ERROR_CODES,
  indiaDate,
  nightsBetween,
  type MyPreferenceResponse,
  type Preference,
  type PreferenceInput,
  type SavePreferenceResponse,
} from '@bonvoyage/shared';
import type { Logger } from 'pino';
import { AppError } from '../http/errors';
import { loadTripForMember, requireActiveMember } from '../trips/access';
import { transitionTrip, type TransitionOutcome } from '../trips/transition-trip';
import {
  findMembership,
  findPreference,
  markSubmitted,
  upsertPreference,
  type PreferenceRow,
} from './repository';

interface Deps {
  db: Db;
  logger: Logger;
  clock: () => Date;
}

// Rule 7 (AGENTS.md 6): a preference is readable only by its owner. Every
// function here works on the caller's own trip_member row and nothing else.

function toPreference(row: PreferenceRow): Preference {
  return {
    destinationTypes: row.destinationTypes as Preference['destinationTypes'],
    activities: row.activities as Preference['activities'],
    climate: row.climate,
    travelStyle: row.travelStyle,
    budgetMinInr: row.budgetMinInr,
    budgetMaxInr: row.budgetMaxInr,
    dateStart: row.dateStart,
    dateEnd: row.dateEnd,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getMyPreference(
  db: Db,
  tripId: string,
  userId: string,
): Promise<MyPreferenceResponse> {
  const { membership } = await loadTripForMember(db, tripId, userId);
  // An excluded member's preference was deleted on removal; answer null either way.
  if (membership.status === 'excluded') return { preference: null, submittedAt: null };
  const row = await findPreference(db, membership.id);
  return {
    preference: row ? toPreference(row) : null,
    submittedAt: membership.submittedAt?.toISOString() ?? null,
  };
}

// Thrown inside the hook when the locked member row is already submitted
// although this call chose preferenceSubmitted: a double click whose first
// request won. The call is retried once as preferenceRevised.
class AlreadySubmitted extends Error {}

// PUT /api/trips/:id/preferences/me. The hook writes the preference (and the
// first submitted_at) after the trip row lock and before the guard context is
// built, so the caller already counts as submitted: that is what lets the last
// submission fire T3. A rejected event rolls the write back.
export async function saveMyPreference(
  deps: Deps,
  tripId: string,
  userId: string,
  input: PreferenceInput,
): Promise<SavePreferenceResponse> {
  const { db, clock } = deps;
  const { trip, membership } = await loadTripForMember(db, tripId, userId);
  requireActiveMember(membership);

  // Server-only checks: they need the clock and the trip (SRS 3.1.3).
  const fields: Record<string, string> = {};
  if (input.dateStart < indiaDate(clock())) {
    fields.dateStart = 'Choose a start date from today onwards.';
  }
  const n = trip.durationNights;
  if (nightsBetween(input.dateStart, input.dateEnd) < n) {
    fields.dateEnd = `Your dates must cover at least ${n} ${n === 1 ? 'night' : 'nights'} for this trip.`;
  }
  if (Object.keys(fields).length > 0) {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Some fields are invalid.', fields);
  }

  const run = (event: 'preferenceSubmitted' | 'preferenceRevised') =>
    transitionTrip(deps, {
      tripId,
      event,
      actorUserId: userId,
      beforeDecide: async (tx) => {
        // Re-read under the trip lock: a removal or a parallel submit may
        // have landed since loadTripForMember.
        const locked = await findMembership(tx, tripId, userId);
        if (!locked) throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Trip not found.');
        requireActiveMember(locked);
        if (event === 'preferenceSubmitted' && locked.submittedAt !== null) {
          throw new AlreadySubmitted();
        }
        const now = clock();
        await upsertPreference(tx, locked.id, input, now);
        if (event === 'preferenceSubmitted') await markSubmitted(tx, locked.id, now);
      },
    });

  let outcome: TransitionOutcome;
  if (membership.submittedAt === null) {
    try {
      outcome = await run('preferenceSubmitted');
    } catch (err) {
      if (!(err instanceof AlreadySubmitted)) throw err;
      outcome = await run('preferenceRevised');
    }
  } else {
    outcome = await run('preferenceRevised');
  }

  const fresh = await findMembership(db, tripId, userId);
  const row = fresh ? await findPreference(db, fresh.id) : undefined;
  if (!fresh?.submittedAt || !row) {
    throw new AppError(500, ERROR_CODES.INTERNAL, 'Something went wrong.');
  }
  return {
    preference: toPreference(row),
    submittedAt: fresh.submittedAt.toISOString(),
    transition: { transitionId: outcome.transitionId, kind: outcome.kind, to: outcome.to },
  };
}
