import type { Db } from '@bonvoyage/db';
import {
  ERROR_CODES,
  indiaDate,
  type AddPastTripInput,
  type PastTrip,
  type ProfileResponse,
  type UpdateProfileInput,
} from '@bonvoyage/shared';
import { z } from 'zod';
import { AppError } from '../http/errors';
import {
  deleteOwnPastTrip,
  findActiveDestination,
  findHomeHubSlug,
  findHubId,
  insertPastTrip,
  listPastTrips,
  upsertHomeHub,
  type PastTripRow,
} from './repository';

// The caller's own profile (S1-4): home city and past trips, which Sprint 2's
// scoring reads. Every query is keyed by the session user, never by input.

const invalid = (field: string, message: string) =>
  new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Some fields are invalid.', {
    [field]: message,
  });

function toPastTrip(row: PastTripRow): PastTrip {
  return {
    id: row.id,
    destination:
      row.destinationSlug && row.destinationName
        ? { slug: row.destinationSlug, name: row.destinationName }
        : null,
    // Catalogue picks use destination_id only; place_name is reserved for free-text trips.
    placeName: row.destinationSlug ? null : row.placeName,
    visitedOn: row.visitedOn,
    rating: row.rating,
  };
}

export async function getProfile(db: Db, userId: string): Promise<ProfileResponse> {
  const [homeHubSlug, rows] = await Promise.all([
    findHomeHubSlug(db, userId),
    listPastTrips(db, userId),
  ]);
  return { homeHubSlug, pastTrips: rows.map(toPastTrip) };
}

export async function updateProfile(
  db: Db,
  userId: string,
  input: UpdateProfileInput,
): Promise<ProfileResponse> {
  let hubId: string | null = null;
  if (input.homeHubSlug !== null) {
    hubId = (await findHubId(db, input.homeHubSlug)) ?? null;
    if (!hubId) throw invalid('homeHubSlug', 'Choose a city from the list.');
  }
  await upsertHomeHub(db, userId, hubId);
  return getProfile(db, userId);
}

export async function addPastTrip(
  { db, clock }: { db: Db; clock: () => Date },
  userId: string,
  input: AddPastTripInput,
): Promise<PastTrip> {
  if (input.visitedOn !== undefined && input.visitedOn > indiaDate(clock())) {
    throw invalid('visitedOn', 'The visit date cannot be in the future.');
  }
  let dest: { id: string; slug: string; name: string } | undefined;
  if (input.destinationSlug !== undefined) {
    dest = await findActiveDestination(db, input.destinationSlug);
    if (!dest) throw invalid('destinationSlug', 'Choose a destination from the list.');
  }
  // AddPastTripInput guarantees exactly one of destinationSlug and placeName.
  const placeName = input.placeName ?? null;
  const id = await insertPastTrip(db, {
    userId,
    destinationId: dest?.id ?? null,
    placeName,
    visitedOn: input.visitedOn ?? null,
    rating: input.rating,
  });
  return toPastTrip({
    id,
    placeName,
    visitedOn: input.visitedOn ?? null,
    rating: input.rating,
    destinationSlug: dest?.slug ?? null,
    destinationName: dest?.name ?? null,
  });
}

const uuid = z.uuid();

export async function removePastTrip(db: Db, userId: string, id: string): Promise<void> {
  // A malformed id and someone else's row get the same 404 as a missing one.
  const deleted = uuid.safeParse(id).success && (await deleteOwnPastTrip(db, userId, id));
  if (!deleted) throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Past trip not found.');
}
