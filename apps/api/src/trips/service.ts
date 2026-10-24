import type { Db } from '@bonvoyage/db';
import { tripTransition } from '@bonvoyage/db/schema';
import { legalEvents, nextState } from '@bonvoyage/engine';
import {
  MAX_MEMBERS,
  summarizeEvent,
  type ActivityResponse,
  type CreateTripInput,
  type DestinationsResponse,
  type HubsResponse,
  type TripDetail,
  type TripProgress,
  type TripsResponse,
  type UpdateTripInput,
} from '@bonvoyage/shared';
import { ERROR_CODES, indiaDate } from '@bonvoyage/shared';
import type { Logger } from 'pino';
import { AppError } from '../http/errors';
import {
  loadTripForMember,
  requireActiveMember,
  requireOrganiser,
  type MembershipRow,
  type TripRow,
} from './access';
import {
  countActiveMembers,
  findHubBySlug,
  findSelectedDestination,
  insertOrganiserMember,
  insertTrip,
  listActivity,
  listActiveDestinations,
  listHubs,
  listMembersWithNames,
  listMembershipTrips,
  lockTripStatus,
  newestTransitionAt,
  updateTripFields,
  type HubRow,
  type MemberWithName,
  type Tx,
} from './repository';
import { findLatestRun } from '../recommendations/repository';
import { tripActions } from './actions';
import { transitionTrip } from './transition-trip';

interface Deps {
  db: Db;
  clock: () => Date;
}

const iso = (d: Date) => d.toISOString();

/** 0004 j: trip parameters stay editable until the shortlist is made. */
export const EDITABLE_STATUSES: readonly TripRow['status'][] = [
  'draft',
  'collecting_preferences',
  'ready_for_recommendation',
];

function progressOf(members: MemberWithName[]): TripProgress {
  const active = members.filter((m) => m.member.status === 'active');
  const submitted = active.filter((m) => m.member.submittedAt !== null).length;
  return {
    activeCount: active.length,
    submittedCount: submitted,
    pendingCount: active.length - submitted,
    excludedCount: members.length - active.length,
    maxMembers: MAX_MEMBERS,
  };
}

function toDetail(
  row: TripRow,
  hubRow: HubRow,
  members: MemberWithName[],
  caller: MembershipRow,
  lastActivityAt: Date | null,
  selectedDestination: TripDetail['selectedDestination'],
  latestRecommendation: TripDetail['latestRecommendation'],
): TripDetail {
  const organiser = members.find((m) => m.member.role === 'organiser');
  const progress = progressOf(members);
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    originHub: { slug: hubRow.slug, name: hubRow.name, state: hubRow.state },
    selectedDestination,
    durationNights: row.durationNights,
    budgetTotalInr: row.budgetTotalInr,
    radiusKm: row.radiusKm,
    startDate: row.startDate,
    endDate: row.endDate,
    organiser: {
      userId: organiser?.member.userId ?? row.organiserId,
      name: organiser?.name ?? '',
    },
    members: members.map((m) => ({
      userId: m.member.userId,
      name: m.name,
      role: m.member.role,
      status: m.member.status,
      submitted: m.member.submittedAt !== null,
      joinedAt: iso(m.member.joinedAt),
    })),
    myRole: caller.role,
    myStatus: caller.status,
    legalEvents: legalEvents(row.status),
    progress,
    availableActions: tripActions({
      status: row.status,
      myRole: caller.role,
      myStatus: caller.status,
      mySubmitted: caller.submittedAt !== null,
      progress,
      hasRecommendation: latestRecommendation !== null,
    }),
    lastActivityAt: lastActivityAt ? iso(lastActivityAt) : null,
    latestRecommendation,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

async function detailFor(db: Db, row: TripRow, caller: MembershipRow): Promise<TripDetail> {
  const [hubRow, members, lastActivityAt, selectedDestination, latestRun] = await Promise.all([
    db.query.hub.findFirst({ where: (h, { eq }) => eq(h.id, row.originHubId) }),
    listMembersWithNames(db, row.id),
    newestTransitionAt(db, row.id),
    findSelectedDestination(db, row.selectedDestinationId),
    findLatestRun(db, row.id),
  ]);
  if (!hubRow) throw new AppError(500, ERROR_CODES.INTERNAL, 'Something went wrong.');
  const latestRecommendation = latestRun
    ? {
        round: latestRun.round,
        kind: latestRun.kind,
        feasibleCount: latestRun.feasibleCount,
        createdAt: iso(latestRun.createdAt),
      }
    : null;
  return toDetail(
    row,
    hubRow,
    members,
    caller,
    lastActivityAt,
    selectedDestination,
    latestRecommendation,
  );
}

export async function getDestinations(db: Db): Promise<DestinationsResponse> {
  return { destinations: await listActiveDestinations(db) };
}

export async function getHubs(db: Db): Promise<HubsResponse> {
  const rows = await listHubs(db);
  return { hubs: rows.map(({ slug, name, state }) => ({ slug, name, state })) };
}

// POST /api/trips — T1. createTrip is the one transition written outside
// transitionTrip (conventions rule 5), so the trip row, the organiser member
// and the T1 audit row all land in this one transaction.
export async function createTrip(
  { db, clock }: Deps,
  userId: string,
  input: CreateTripInput,
): Promise<TripDetail> {
  const hubRow = await findHubBySlug(db, input.originHubSlug);
  if (!hubRow) {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Some fields are invalid.', {
      originHubSlug: 'Choose a starting city from the list.',
    });
  }

  const today = indiaDate(clock());
  const created = await db.transaction(async (tx: Tx) => {
    const result = nextState('initial', 'createTrip', {
      pendingCount: 0,
      submittedCount: 0,
      feasibleCount: null,
      alternativesLeft: null,
      today,
      startDate: null,
    });
    if (!result.ok || result.kind !== 'external') {
      throw new Error('T1 must be an external transition; the state machine is broken.');
    }
    const row = await insertTrip(tx, {
      title: input.title,
      organiserId: userId,
      originHubId: hubRow.id,
      durationNights: input.durationNights,
      budgetTotalInr: input.budgetTotalInr,
      radiusKm: input.radiusKm,
      status: result.to,
    });
    await insertOrganiserMember(tx, row.id, userId);
    await tx.insert(tripTransition).values({
      tripId: row.id,
      transitionId: result.transitionId,
      event: 'createTrip',
      fromStatus: null,
      toStatus: result.to,
      actorUserId: userId,
    });
    return row;
  });

  const { trip: row, membership } = await loadTripForMember(db, created.id, userId);
  return detailFor(db, row, membership);
}

export async function getMyTrips(db: Db, userId: string): Promise<TripsResponse> {
  const rows = await listMembershipTrips(db, userId);
  const counts = await countActiveMembers(
    db,
    rows.map((r) => r.trip.id),
  );
  return {
    trips: rows.map((r) => ({
      id: r.trip.id,
      title: r.trip.title,
      status: r.trip.status,
      originHub: { slug: r.hub.slug, name: r.hub.name, state: r.hub.state },
      durationNights: r.trip.durationNights,
      budgetTotalInr: r.trip.budgetTotalInr,
      memberCount: counts.get(r.trip.id) ?? 0,
      myRole: r.membership.role,
      updatedAt: iso(r.trip.updatedAt),
    })),
  };
}

export async function getTrip(db: Db, tripId: string, userId: string): Promise<TripDetail> {
  const { trip: row, membership } = await loadTripForMember(db, tripId, userId);
  return detailFor(db, row, membership);
}

// PATCH /api/trips/:id — organiser only, until the shortlist is made (0004 j).
// The status is re-read under FOR UPDATE so an edit cannot race a transition.
export async function updateTrip(
  { db }: Deps,
  tripId: string,
  userId: string,
  input: UpdateTripInput,
): Promise<TripDetail> {
  const { membership } = await loadTripForMember(db, tripId, userId);
  requireActiveMember(membership);
  requireOrganiser(membership);

  const patch: Parameters<typeof updateTripFields>[2] = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.durationNights !== undefined) patch.durationNights = input.durationNights;
  if (input.budgetTotalInr !== undefined) patch.budgetTotalInr = input.budgetTotalInr;
  if (input.radiusKm !== undefined) patch.radiusKm = input.radiusKm;
  if (input.originHubSlug !== undefined) {
    const hubRow = await findHubBySlug(db, input.originHubSlug);
    if (!hubRow) {
      throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Some fields are invalid.', {
        originHubSlug: 'Choose a starting city from the list.',
      });
    }
    patch.originHubId = hubRow.id;
  }

  await db.transaction(async (tx) => {
    const status = await lockTripStatus(tx, tripId);
    if (!status || !EDITABLE_STATUSES.includes(status)) {
      throw new AppError(
        409,
        ERROR_CODES.TRIP_NOT_EDITABLE,
        'Trip details can be changed until the shortlist is made.',
      );
    }
    await updateTripFields(tx, tripId, patch);
  });

  const { trip: row, membership: fresh } = await loadTripForMember(db, tripId, userId);
  return detailFor(db, row, fresh);
}

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

// POST /api/trips/:id/close-submissions: T3b. transitionTrip's
// excludeNonSubmitters action excludes every active member who has not
// submitted (0001 f); GUARD_FAILED and ILLEGAL_TRANSITION surface as 409.
export async function closeSubmissions(
  deps: { db: Db; logger: Logger; clock: () => Date },
  tripId: string,
  userId: string,
): Promise<TripDetail> {
  const { membership } = await loadTripForMember(deps.db, tripId, userId);
  requireActiveMember(membership);
  requireOrganiser(membership);
  await transitionTrip(deps, { tripId, event: 'closeSubmissions', actorUserId: userId });
  return getTrip(deps.db, tripId, userId);
}

const ACTIVITY_LIMIT = 20;

// GET /api/trips/:id/activity: any member, excluded included (they can read).
export async function getActivity(
  db: Db,
  tripId: string,
  userId: string,
): Promise<ActivityResponse> {
  await loadTripForMember(db, tripId, userId);
  const rows = await listActivity(db, tripId, ACTIVITY_LIMIT);
  return {
    items: rows.map((r) => ({
      id: r.id,
      transitionId: r.transitionId,
      event: r.event,
      fromStatus: r.fromStatus,
      toStatus: r.toStatus,
      actorName: r.actorName,
      createdAt: iso(r.createdAt),
      summary: summarizeEvent(r.event, r.actorName),
    })),
  };
}
