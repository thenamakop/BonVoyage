import type { Db } from '@bonvoyage/db';
import { ERROR_CODES } from '@bonvoyage/shared';
import type { Logger } from 'pino';
import { AppError } from '../../http/errors';
import { transitionTrip } from '../../trips/transition-trip';
import { findMember } from './repository';

// RUNBOOK B3: T15/T16. Membership is checked first so a non-member gets a 404
// that does not reveal the trip exists; a non-organiser member gets 403.
export async function cancelTrip(
  deps: { db: Db; logger: Logger; clock: () => Date },
  tripId: string,
  userId: string,
): Promise<{ id: string; status: string }> {
  const member = await findMember(deps.db, tripId, userId);
  if (!member || member.status !== 'active') {
    throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Trip not found.');
  }
  if (member.role !== 'organiser') {
    throw new AppError(403, ERROR_CODES.FORBIDDEN, 'Only the organiser can cancel this trip.');
  }
  const outcome = await transitionTrip(deps, { tripId, event: 'cancelTrip', actorUserId: userId });
  return { id: tripId, status: outcome.to };
}
