import { randomBytes } from 'node:crypto';
import type { Db } from '@bonvoyage/db';
import {
  ERROR_CODES,
  INVITATION_TTL_DAYS,
  MAX_MEMBERS,
  type AcceptInvitationResponse,
  type ActiveInvitationResponse,
  type InvitationPreview,
  type InvitationResponse,
} from '@bonvoyage/shared';
import type { Logger } from 'pino';
import { AppError } from '../http/errors';
import { notifyMemberJoined } from '../notifications/notify';
import {
  loadTripForMember,
  requireActiveMember,
  requireOrganiser,
  type MembershipRow,
} from '../trips/access';
import { transitionTrip, type Tx } from '../trips/transition-trip';
import {
  countActive,
  deleteMembership,
  excludeMember,
  findActiveInvitation,
  findInvitationByToken,
  findMembership,
  findPreviewTrip,
  insertInvitation,
  insertMember,
  lockTrip,
  revokeActiveInvitations,
  type InvitationRow,
} from './repository';

interface Deps {
  db: Db;
  logger: Logger;
  clock: () => Date;
}

const DAY_MS = 86_400_000;

const notValid = () =>
  new AppError(404, ERROR_CODES.NOT_FOUND, 'This invitation link is not valid.');
const invitationsClosed = () =>
  new AppError(409, ERROR_CODES.INVITATIONS_CLOSED, 'This trip is no longer taking new members.');

function toResponse(row: InvitationRow): InvitationResponse {
  return { token: row.token, status: row.status, expiresAt: row.expiresAt.toISOString() };
}

function newInvitation(tripId: string, userId: string, now: Date) {
  return {
    tripId,
    token: randomBytes(24).toString('base64url'),
    createdBy: userId,
    expiresAt: new Date(now.getTime() + INVITATION_TTL_DAYS * DAY_MS),
  };
}

// Thrown inside the T2 hook when the locked trip is no longer a draft: a
// concurrent first click already fired T2, so this call falls through to the
// collecting_preferences branch and returns that call's link.
class AlreadyOpened extends Error {}

// POST /api/trips/:id/invitations. The first link of a draft trip is T2. The
// draft-or-collecting decision is made on the locked row, so two simultaneous
// first clicks end with one T2 row and the same token.
export async function createInvitation(
  deps: Deps,
  tripId: string,
  userId: string,
): Promise<{ created: boolean; invitation: InvitationResponse }> {
  const { db, clock } = deps;
  const { trip, membership } = await loadTripForMember(db, tripId, userId);
  requireActiveMember(membership);
  requireOrganiser(membership);

  if (trip.status === 'draft') {
    let inserted: InvitationRow | undefined;
    try {
      await transitionTrip(deps, {
        tripId,
        event: 'inviteMembers',
        actorUserId: userId,
        beforeDecide: async (tx, locked) => {
          if (locked.status !== 'draft') throw new AlreadyOpened();
          inserted = await insertInvitation(tx, newInvitation(tripId, userId, clock()));
        },
      });
    } catch (err) {
      if (!(err instanceof AlreadyOpened)) throw err;
    }
    if (inserted) return { created: true, invitation: toResponse(inserted) };
  }

  return db.transaction(async (tx) => {
    const locked = await lockTrip(tx, tripId);
    if (locked?.status !== 'collecting_preferences') throw invitationsClosed();
    const now = clock();
    const existing = await findActiveInvitation(tx, tripId, now);
    if (existing) return { created: false, invitation: toResponse(existing) };
    const row = await insertInvitation(tx, newInvitation(tripId, userId, now));
    return { created: true, invitation: toResponse(row) };
  });
}

export async function getActiveInvitation(
  { db, clock }: Deps,
  tripId: string,
  userId: string,
): Promise<ActiveInvitationResponse> {
  const { membership } = await loadTripForMember(db, tripId, userId);
  requireOrganiser(membership);
  const row = await findActiveInvitation(db, tripId, clock());
  return { invitation: row ? toResponse(row) : null };
}

export async function revokeInvitations(
  { db }: Deps,
  tripId: string,
  userId: string,
): Promise<void> {
  const { membership } = await loadTripForMember(db, tripId, userId);
  requireActiveMember(membership);
  requireOrganiser(membership);
  await revokeActiveInvitations(db, tripId);
}

// GET /api/invitations/:token is public. State order (spec): revoked,
// expired, closed, full, open.
export async function previewInvitation(
  { db, clock }: Deps,
  token: string,
  viewerUserId: string | null,
): Promise<InvitationPreview> {
  const inv = await findInvitationByToken(db, token);
  if (!inv) throw notValid();
  const trip = await findPreviewTrip(db, inv.tripId);
  if (!trip) throw notValid();
  const [memberCount, viewer] = await Promise.all([
    countActive(db, inv.tripId),
    viewerUserId ? findMembership(db, inv.tripId, viewerUserId) : Promise.resolve(undefined),
  ]);

  let state: InvitationPreview['state'];
  if (inv.status === 'revoked') state = 'revoked';
  else if (inv.expiresAt <= clock()) state = 'expired';
  else if (trip.status !== 'collecting_preferences') state = 'closed';
  else if (memberCount >= MAX_MEMBERS) state = 'full';
  else state = 'open';

  return {
    tripTitle: trip.title,
    organiserName: trip.organiserName,
    memberCount,
    maxMembers: MAX_MEMBERS,
    state,
    alreadyMember: viewer?.status === 'active',
  };
}

// POST /api/invitations/:token/accept. Joining is not a state-machine event;
// the trip row lock serialises joins so the 8-member cap holds under races.
export async function acceptInvitation(
  { db, clock }: Deps,
  token: string,
  userId: string,
): Promise<AcceptInvitationResponse> {
  return db.transaction(async (tx) => {
    const inv = await findInvitationByToken(tx, token);
    if (!inv) throw notValid();
    const trip = await lockTrip(tx, inv.tripId);
    if (!trip) throw notValid();

    if (inv.status === 'revoked' || inv.expiresAt <= clock()) {
      throw new AppError(
        410,
        ERROR_CODES.INVITATION_EXPIRED,
        'This link has expired or was turned off. Ask the organiser for a new one.',
      );
    }
    if (trip.status !== 'collecting_preferences') throw invitationsClosed();

    const existing = await findMembership(tx, trip.id, userId);
    if (existing?.status === 'active') return { tripId: trip.id };
    if (existing?.status === 'excluded') {
      throw new AppError(
        409,
        ERROR_CODES.MEMBER_EXCLUDED,
        'You were removed from this trip. Ask the organiser if you think this is a mistake.',
      );
    }
    if ((await countActive(tx, trip.id)) >= MAX_MEMBERS) {
      throw new AppError(
        422,
        ERROR_CODES.TRIP_FULL,
        `This trip already has ${MAX_MEMBERS} members.`,
      );
    }
    await insertMember(tx, trip.id, userId);
    // E3: the organiser hears of a join, in this transaction (replaces T2's trip_opened).
    await notifyMemberJoined(tx, { tripId: trip.id, joinerUserId: userId, now: clock() });
    return { tripId: trip.id };
  });
}

// Leave and remove both lock the trip, re-read the caller's membership under
// the lock (so a removal and a leave cannot interleave), and refuse once
// preferences have closed.
async function lockForRosterChange(tx: Tx, tripId: string, userId: string): Promise<MembershipRow> {
  const trip = await lockTrip(tx, tripId);
  const caller = trip ? await findMembership(tx, tripId, userId) : undefined;
  if (!trip || !caller) throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Trip not found.');
  requireActiveMember(caller);
  if (trip.status !== 'draft' && trip.status !== 'collecting_preferences') {
    throw new AppError(
      409,
      ERROR_CODES.TRIP_LOCKED,
      'Members cannot change after preferences close.',
    );
  }
  return caller;
}

// DELETE /api/trips/:id/members/me. The row goes (and the preference with it,
// by cascade) so the trip leaves the member's list.
export async function leaveTrip({ db }: Deps, tripId: string, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const caller = await lockForRosterChange(tx, tripId, userId);
    if (caller.role === 'organiser') {
      throw new AppError(
        422,
        ERROR_CODES.ORGANISER_CANNOT_LEAVE,
        'Organisers cannot leave. Cancel the trip instead.',
      );
    }
    await deleteMembership(tx, caller.id);
  });
}

// DELETE /api/trips/:id/members/:userId. The member stays as excluded so they
// can still read the trip (conventions rule 4); their preference is deleted
// so it never counts.
export async function removeMember(
  { db }: Deps,
  tripId: string,
  userId: string,
  targetUserId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const caller = await lockForRosterChange(tx, tripId, userId);
    requireOrganiser(caller);
    const target = await findMembership(tx, tripId, targetUserId);
    if (!target) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'That person is not a member of this trip.');
    }
    if (target.role === 'organiser') {
      throw new AppError(
        422,
        ERROR_CODES.CANNOT_REMOVE_ORGANISER,
        'The organiser cannot be removed from the trip.',
      );
    }
    await excludeMember(tx, target.id);
  });
}
