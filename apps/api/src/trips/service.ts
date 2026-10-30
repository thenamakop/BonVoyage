import type { Db } from '@bonvoyage/db';
import { itinerary, tripPackage, tripTransition } from '@bonvoyage/db/schema';
import { asc, eq } from 'drizzle-orm';
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
  findAcceptedPackage,
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
  restoreStartDate,
  updateTripFields,
  type HubRow,
  type MemberWithName,
  type Tx,
} from './repository';
import { nextReminderTimes } from '../notifications/service';
import { findLatestRun } from '../recommendations/repository';
import { latestItinerarySummary } from '../itinerary/repository';
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

/** The members Remind accepts (notifications/service.ts): active, not submitted, not the organiser. */
const isRemindable = ({ member }: MemberWithName) =>
  member.status === 'active' && member.submittedAt === null && member.role !== 'organiser';

function toDetail(
  row: TripRow,
  hubRow: HubRow,
  members: MemberWithName[],
  caller: MembershipRow,
  lastActivityAt: Date | null,
  selectedDestination: TripDetail['selectedDestination'],
  latestRecommendation: TripDetail['latestRecommendation'],
  selectedPackage: TripDetail['selectedPackage'],
  latestItinerary: TripDetail['latestItinerary'],
  reminders: ReadonlyMap<string, string> | null,
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
      ...(reminders && isRemindable(m)
        ? { canRemindAt: reminders.get(m.member.userId) ?? null }
        : {}),
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
      hasItinerary: latestItinerary !== null,
    }),
    lastActivityAt: lastActivityAt ? iso(lastActivityAt) : null,
    latestRecommendation,
    selectedPackage,
    latestItinerary,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

async function detailFor(
  db: Db,
  row: TripRow,
  caller: MembershipRow,
  now: Date,
): Promise<TripDetail> {
  const [
    hubRow,
    members,
    lastActivityAt,
    selectedDestination,
    latestRun,
    selectedPackage,
    latestItinerary,
  ] = await Promise.all([
    db.query.hub.findFirst({ where: (h, { eq }) => eq(h.id, row.originHubId) }),
    listMembersWithNames(db, row.id),
    newestTransitionAt(db, row.id),
    findSelectedDestination(db, row.selectedDestinationId),
    findLatestRun(db, row.id),
    findAcceptedPackage(db, row.id),
    latestItinerarySummary(db, row.id),
  ]);
  if (!hubRow) throw new AppError(500, ERROR_CODES.INTERNAL, 'Something went wrong.');
  // S5-3: only an acting organiser, while preferences are open, ever gets this;
  // it stays out of every other caller's response (V2).
  const reminders =
    caller.role === 'organiser' &&
    caller.status === 'active' &&
    row.status === 'collecting_preferences'
      ? await nextReminderTimes(db, row.id, now)
      : null;
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
    selectedPackage,
    latestItinerary,
    reminders,
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
  return detailFor(db, row, membership, clock());
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

export async function getTrip(
  db: Db,
  tripId: string,
  userId: string,
  clock: () => Date,
): Promise<TripDetail> {
  const { trip: row, membership } = await loadTripForMember(db, tripId, userId);
  return detailFor(db, row, membership, clock());
}

// PATCH /api/trips/:id — organiser only, until the shortlist is made (0004 j).
// The status is re-read under FOR UPDATE so an edit cannot race a transition.
export async function updateTrip(
  { db, clock }: Deps,
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
  return detailFor(db, row, fresh, clock());
}

// RUNBOOK B3: T15/T16. loadTripForMember returns the same 404 for a missing
// trip and a non-member, so a trip's existence is never revealed.
export async function cancelTrip(
  deps: { db: Db; logger: Logger; clock: () => Date },
  tripId: string,
  userId: string,
): Promise<{ id: string; status: string }> {
  const { trip: row, membership } = await loadTripForMember(deps.db, tripId, userId);
  requireActiveMember(membership);
  requireOrganiser(membership);
  // T16's guard needs the first day, which T14 stores. A trip finalised before it
  // did gets the date from its accepted package; with none, it is refused, never
  // allowed by default. The date is right whether or not T16 then passes.
  if (row.status === 'finalised' && row.startDate === null) {
    if (!(await restoreStartDate(deps.db, tripId))) {
      throw new AppError(
        409,
        ERROR_CODES.GUARD_FAILED,
        'This trip has no start date, so it cannot be cancelled.',
      );
    }
  }
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
  return getTrip(deps.db, tripId, userId, deps.clock);
}

// POST /api/trips/:id/reopen-shortlist: T21 "Ask again" (decision E1). The
// trip_transition row transitionTrip writes is the activity line. Nothing from
// the earlier run is cleared: selected_destination_id is already null in
// shortlisted (T10 clears it), the next T9 reads only the newest run, and
// earlier packages are all hidden, which the package reads skip.
export async function reopenShortlist(
  deps: { db: Db; logger: Logger; clock: () => Date },
  tripId: string,
  userId: string,
): Promise<TripDetail> {
  const { membership } = await loadTripForMember(deps.db, tripId, userId);
  requireActiveMember(membership);
  requireOrganiser(membership);
  await transitionTrip(deps, { tripId, event: 'shortlistReopened', actorUserId: userId });
  return getTrip(deps.db, tripId, userId, deps.clock);
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
  // T11/T12 summaries name what was chosen: the k-th packageAccepted pairs
  // with the k-th accepted package by time, and generateItinerary with the
  // k-th itinerary version, so "Asha planned the days (version 2)".
  const [acceptedPkgs, itineraries] = await Promise.all([
    db.query.tripPackage.findMany({
      where: (t, { eq, and: a }) => a(eq(t.tripId, tripId), eq(t.status, 'accepted')),
      orderBy: (t, { asc }) => asc(t.createdAt),
    }),
    db
      .select({ version: itinerary.version })
      .from(itinerary)
      .innerJoin(tripPackage, eq(tripPackage.id, itinerary.packageId))
      .where(eq(tripPackage.tripId, tripId))
      .orderBy(asc(itinerary.generatedAt)),
  ]);
  let acceptCount = 0;
  let planCount = 0;
  const chronological = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const detailById = new Map<string, string>();
  for (const r of chronological) {
    if (r.event === 'packageAccepted') {
      const label = acceptedPkgs[acceptCount]?.label;
      acceptCount += 1;
      if (label) detailById.set(r.id, label);
    } else if (r.event === 'generateItinerary') {
      const version = itineraries[planCount]?.version;
      planCount += 1;
      if (version !== undefined) detailById.set(r.id, `version ${version}`);
    }
  }
  return {
    items: rows.map((r) => ({
      id: r.id,
      transitionId: r.transitionId,
      event: r.event,
      fromStatus: r.fromStatus,
      toStatus: r.toStatus,
      actorName: r.actorName,
      createdAt: iso(r.createdAt),
      summary: summarizeEvent(r.event, r.actorName, detailById.get(r.id)),
    })),
  };
}
