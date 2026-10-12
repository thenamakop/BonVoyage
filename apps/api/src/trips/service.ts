import type { Db } from '@bonvoyage/db';
import { tripTransition } from '@bonvoyage/db/schema';
import { legalEvents, nextState } from '@bonvoyage/engine';
import type {
  CreateTripInput,
  HubsResponse,
  TripDetail,
  TripsResponse,
  UpdateTripInput,
} from '@bonvoyage/shared';
import { ERROR_CODES } from '@bonvoyage/shared';
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
  insertOrganiserMember,
  insertTrip,
  listHubs,
  listMembersWithNames,
  listMembershipTrips,
  lockTripStatus,
  updateTripFields,
  type HubRow,
  type MemberWithName,
  type Tx,
} from './repository';

interface Deps {
  db: Db;
  clock: () => Date;
}

const iso = (d: Date) => d.toISOString();

function toDetail(
  row: TripRow,
  hubRow: HubRow,
  members: MemberWithName[],
  caller: MembershipRow,
): TripDetail {
  const organiser = members.find((m) => m.member.role === 'organiser');
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    originHub: { slug: hubRow.slug, name: hubRow.name, state: hubRow.state },
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
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

async function detailFor(db: Db, row: TripRow, caller: MembershipRow): Promise<TripDetail> {
  const [hubRow, members] = await Promise.all([
    db.query.hub.findFirst({ where: (h, { eq }) => eq(h.id, row.originHubId) }),
    listMembersWithNames(db, row.id),
  ]);
  if (!hubRow) throw new AppError(500, ERROR_CODES.INTERNAL, 'Something went wrong.');
  return toDetail(row, hubRow, members, caller);
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

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(clock());
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

// PATCH /api/trips/:id — organiser only, and only while the trip is a draft.
// The status is re-read under FOR UPDATE so an edit cannot race T2.
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
    if (status !== 'draft') {
      throw new AppError(
        409,
        ERROR_CODES.TRIP_NOT_EDITABLE,
        'Trip details can be changed only before anyone is invited.',
      );
    }
    await updateTripFields(tx, tripId, patch);
  });

  const { trip: row, membership: fresh } = await loadTripForMember(db, tripId, userId);
  return detailFor(db, row, fresh);
}
