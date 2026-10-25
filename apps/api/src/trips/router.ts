import type { Db } from '@bonvoyage/db';
import type { Weights } from '@bonvoyage/engine';
import type { Routing } from '@bonvoyage/integrations/routing';
import {
  ChooseDestinationInput,
  CloseSubmissionsInput,
  CreateTripInput,
  PreferenceInput,
  RequestRecommendationsInput,
  UpdateTripInput,
} from '@bonvoyage/shared';
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
import { getMyPreference, saveMyPreference } from '../preferences/service';
import {
  chooseDestination,
  getGroupProfile,
  getLatestRecommendation,
  requestRecommendations,
  type RecommendationHooks,
} from '../recommendations/service';
import { parseOrThrow } from '../http/errors';
import { getSessionUser, requireSession } from '../http/session';
import { parseTripId } from './access';
import {
  cancelTrip,
  closeSubmissions,
  createTrip,
  getActivity,
  getDestinations,
  getHubs,
  getMyTrips,
  getTrip,
  updateTrip,
} from './service';

const MemberParams = z.object({ userId: z.string().min(1).max(200) });

export function createRouter({
  db,
  auth,
  clock = () => new Date(),
  routing,
  scoringWeights,
  recommendationHooks,
}: {
  db: Db;
  auth: Auth;
  clock?: () => Date;
  routing: Routing;
  scoringWeights: Weights;
  recommendationHooks?: RecommendationHooks;
}) {
  const router = express.Router();

  router.get('/hubs', requireSession(auth), async (_req, res) => {
    res.json(await getHubs(db));
  });

  router.get('/destinations', requireSession(auth), async (_req, res) => {
    res.json(await getDestinations(db));
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

  // S1-5: T3b and the dashboard's activity list.
  router.post('/trips/:id/close-submissions', requireSession(auth), async (req, res) => {
    const tripId = parseTripId(req.params.id);
    parseOrThrow(CloseSubmissionsInput, req.body ?? {});
    const { userId } = getSessionUser(res);
    res.json(await closeSubmissions({ db, logger: req.log, clock }, tripId, userId));
  });

  router.get('/trips/:id/activity', requireSession(auth), async (req, res) => {
    const tripId = parseTripId(req.params.id);
    const { userId } = getSessionUser(res);
    res.json(await getActivity(db, tripId, userId));
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

  // S1-4: the caller's own preference. The logic lives in ../preferences;
  // there is deliberately no route that reads another member's answers.
  router.get('/trips/:id/preferences/me', requireSession(auth), async (req, res) => {
    const tripId = parseTripId(req.params.id);
    const { userId } = getSessionUser(res);
    res.json(await getMyPreference(db, tripId, userId));
  });

  router.put('/trips/:id/preferences/me', requireSession(auth), async (req, res) => {
    const tripId = parseTripId(req.params.id);
    const input = parseOrThrow(PreferenceInput, req.body);
    const { userId } = getSessionUser(res);
    res.json(await saveMyPreference({ db, logger: req.log, clock }, tripId, userId, input));
  });

  // S2-6: recommendation runs, the group profile and the destination choice.
  // The logic lives in ../recommendations (AGENTS.md 4).
  router.post('/trips/:id/recommendations', requireSession(auth), async (req, res) => {
    const tripId = parseTripId(req.params.id);
    parseOrThrow(RequestRecommendationsInput, req.body ?? {});
    const { userId } = getSessionUser(res);
    res.json(
      await requestRecommendations(
        {
          db,
          logger: req.log,
          clock,
          routing,
          weights: scoringWeights,
          ...(recommendationHooks ? { hooks: recommendationHooks } : {}),
        },
        tripId,
        userId,
      ),
    );
  });

  router.get('/trips/:id/recommendations/latest', requireSession(auth), async (req, res) => {
    const tripId = parseTripId(req.params.id);
    const { userId } = getSessionUser(res);
    res.json(await getLatestRecommendation(db, tripId, userId));
  });

  router.get('/trips/:id/group-profile', requireSession(auth), async (req, res) => {
    const tripId = parseTripId(req.params.id);
    const { userId } = getSessionUser(res);
    res.json(await getGroupProfile(db, tripId, userId));
  });

  router.post('/trips/:id/destination', requireSession(auth), async (req, res) => {
    const tripId = parseTripId(req.params.id);
    const input = parseOrThrow(ChooseDestinationInput, req.body);
    const { userId } = getSessionUser(res);
    res.json(await chooseDestination({ db, logger: req.log, clock }, tripId, userId, input));
  });

  return router;
}
