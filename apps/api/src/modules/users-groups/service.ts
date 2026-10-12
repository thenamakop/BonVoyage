import type { Db } from '@bonvoyage/db';
import type { Logger } from 'pino';
import { loadTripForMember, requireActiveMember, requireOrganiser } from '../../trips/access';
import { transitionTrip } from '../../trips/transition-trip';

// RUNBOOK B3: T15/T16. loadTripForMember returns the same 404 for a missing
// trip and a non-member, so a trip's existence is never revealed.
export async function cancelTrip(
  deps: { db: Db; logger: Logger; clock: () => Date },
  tripId: string,
  userId: string,
): Promise<{ id: string; status: string }> {
  const { membership } = await loadTripForMember(deps.db, tripId, userId);
  requireActiveMember(membership);
  requireOrganiser(membership);
  const outcome = await transitionTrip(deps, { tripId, event: 'cancelTrip', actorUserId: userId });
  return { id: tripId, status: outcome.to };
}
