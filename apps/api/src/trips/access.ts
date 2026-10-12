import type { Db } from '@bonvoyage/db';
import { trip, tripMember } from '@bonvoyage/db/schema';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { ERROR_CODES } from '@bonvoyage/shared';
import { AppError } from '../http/errors';

// The single access gate for every /api/trips/:id route (conventions rule 4).
// A missing trip and a non-member both get the same 404 so a trip's existence
// is never revealed; excluded members can read but not act.

export type TripRow = typeof trip.$inferSelect;
export type MembershipRow = typeof tripMember.$inferSelect;

const uuid = z.uuid();

export function parseTripId(value: unknown): string {
  const parsed = uuid.safeParse(value);
  if (!parsed.success) {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Some fields are invalid.', {
      id: 'must be a uuid',
    });
  }
  return parsed.data;
}

export async function loadTripForMember(
  db: Db,
  tripId: string,
  userId: string,
): Promise<{ trip: TripRow; membership: MembershipRow }> {
  const rows = await db
    .select({ trip, membership: tripMember })
    .from(trip)
    .innerJoin(tripMember, and(eq(tripMember.tripId, trip.id), eq(tripMember.userId, userId)))
    .where(eq(trip.id, tripId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Trip not found.');
  return row;
}

export function requireOrganiser(membership: MembershipRow): void {
  if (membership.role !== 'organiser') {
    throw new AppError(403, ERROR_CODES.FORBIDDEN, 'Only the organiser can do this.');
  }
}

export function requireActiveMember(membership: MembershipRow): void {
  if (membership.status === 'excluded') {
    throw new AppError(
      403,
      ERROR_CODES.FORBIDDEN,
      'You were removed from this trip, so you can only view it.',
    );
  }
}
