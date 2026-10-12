import type { Db } from '@bonvoyage/db';
import { CreateTripInput, UpdateTripInput } from '@bonvoyage/shared';
import express from 'express';
import type { Auth } from '../auth/auth';
import { parseOrThrow } from '../http/errors';
import { getSessionUser, requireSession } from '../http/session';
import { parseTripId } from './access';
import { cancelTrip, createTrip, getHubs, getMyTrips, getTrip, updateTrip } from './service';

export function createRouter({ db, auth }: { db: Db; auth: Auth }) {
  const router = express.Router();
  const clock = () => new Date();

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

  return router;
}
