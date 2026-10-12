import type { Db } from '@bonvoyage/db';
import { CreateTripInput, UpdateTripInput } from '@bonvoyage/shared';
import express from 'express';
import { z } from 'zod';
import type { Auth } from '../auth/auth';
import {
  createInvitation,
  getActiveInvitation,
  leaveTrip,
  removeMember,
  revokeInvitations,
} from '../invitations/service';
import { parseOrThrow } from '../http/errors';
import { getSessionUser, requireSession } from '../http/session';
import { parseTripId } from './access';
import { cancelTrip, createTrip, getHubs, getMyTrips, getTrip, updateTrip } from './service';

const MemberParams = z.object({ userId: z.string().min(1).max(200) });

export function createRouter({
  db,
  auth,
  clock = () => new Date(),
}: {
  db: Db;
  auth: Auth;
  clock?: () => Date;
}) {
  const router = express.Router();

  router.get('/hubs', requireSession(auth), async (_req, res) => {
    res.json(await getHubs(db));
  });

  router.post('/trips', requireSession(auth), async (req, res) => {
    const input = parseOrThrow(CreateTripInput, req.body);
    const { userId } = getSessionUser(res);
    const detail = await createTrip({ db, clock }, userId, input);
    res.status(201).json(detail);
  });

  router.get('/me/trips', requireSession(auth), async (_req, res) => {
    const { userId } = getSessionUser(res);
    res.json(await getMyTrips(db, userId));
  });

  router.get('/trips/:id', requireSession(auth), async (req, res) => {
    const tripId = parseTripId(req.params.id);
    const { userId } = getSessionUser(res);
    res.json(await getTrip(db, tripId, userId));
  });

  router.patch('/trips/:id', requireSession(auth), async (req, res) => {
    const tripId = parseTripId(req.params.id);
    const input = parseOrThrow(UpdateTripInput, req.body);
    const { userId } = getSessionUser(res);
    res.json(await updateTrip({ db, clock }, tripId, userId, input));
  });

  router.post('/trips/:id/cancel', requireSession(auth), async (req, res) => {
    const tripId = parseTripId(req.params.id);
    const { userId } = getSessionUser(res);
    const result = await cancelTrip({ db, logger: req.log, clock }, tripId, userId);
    res.json(result);
  });

  // S1-3: the invitation link and the roster. The logic lives in
  // ../invitations; trip-scoped routes are registered here (AGENTS.md 4).
  router.post('/trips/:id/invitations', requireSession(auth), async (req, res) => {
    const tripId = parseTripId(req.params.id);
    const { userId } = getSessionUser(res);
    const result = await createInvitation({ db, logger: req.log, clock }, tripId, userId);
    res.status(result.created ? 201 : 200).json(result.invitation);
  });

  router.get('/trips/:id/invitations/active', requireSession(auth), async (req, res) => {
    const tripId = parseTripId(req.params.id);
    const { userId } = getSessionUser(res);
    res.json(await getActiveInvitation({ db, logger: req.log, clock }, tripId, userId));
  });

  router.delete('/trips/:id/invitations/active', requireSession(auth), async (req, res) => {
    const tripId = parseTripId(req.params.id);
    const { userId } = getSessionUser(res);
    await revokeInvitations({ db, logger: req.log, clock }, tripId, userId);
    res.status(204).end();
  });

  // Registered before /members/:userId: user ids are text, so "me" would match it.
  router.delete('/trips/:id/members/me', requireSession(auth), async (req, res) => {
    const tripId = parseTripId(req.params.id);
    const { userId } = getSessionUser(res);
    await leaveTrip({ db, logger: req.log, clock }, tripId, userId);
    res.status(204).end();
  });

  router.delete('/trips/:id/members/:userId', requireSession(auth), async (req, res) => {
    const tripId = parseTripId(req.params.id);
    const target = parseOrThrow(MemberParams, req.params);
    const { userId } = getSessionUser(res);
    await removeMember({ db, logger: req.log, clock }, tripId, userId, target.userId);
    res.status(204).end();
  });

  return router;
}
