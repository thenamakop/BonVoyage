import type { Db } from '@bonvoyage/db';
import type { Weights } from '@bonvoyage/engine';
import type { Routing } from '@bonvoyage/integrations/routing';
import type { LlmClient } from '@bonvoyage/integrations';
import {
  ChangePackageInput,
  ModifyItineraryInput,
  ChooseDestinationInput,
  CloseSubmissionsInput,
  CreateTripInput,
  PackageOpinionInput,
  PreferenceInput,
  RequestRecommendationsInput,
  UpdateTripInput,
  VoteInput,
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
import { remindMember } from '../notifications/service';
import { getMyPreference, saveMyPreference } from '../preferences/service';
import {
  chooseDestination,
  getGroupProfile,
  getLatestRecommendation,
  requestRecommendations,
  type RecommendationHooks,
} from '../recommendations/service';
import { castVote, withdrawVote } from '../recommendations/votes';
import {
  acceptItinerary,
  itineraryAlternatives,
  modifyItinerary,
  getItinerary,
  planItinerary,
  rejectItinerary,
} from '../itinerary/service';
import {
  changePackage,
  giveOpinion,
  listTripPackages,
  removePackage,
  selectPackage,
} from '../packages/service';
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
  reopenShortlist,
  updateTrip,
} from './service';

const MemberParams = z.object({ userId: z.string().min(1).max(200) });

export function createRouter({
  db,
  auth,
  clock = () => new Date(),
  routing,
  scoringWeights,
  fairnessLambda,
  recommendationHooks,
  llm,
  wordingTimeoutMs,
}: {
  db: Db;
  auth: Auth;
  clock?: () => Date;
  routing: Routing;
  scoringWeights: Weights;
  fairnessLambda: number;
  recommendationHooks?: RecommendationHooks;
  llm?: LlmClient;
  wordingTimeoutMs?: number;
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
    res.json(await getTrip(db, tripId, userId, clock));
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

  // S5-3 (E3): the organiser reminds a member who has not submitted. The logic
  // and the 24-hour limit live in ../notifications.
  router.post('/trips/:id/members/:userId/remind', requireSession(auth), async (req, res) => {
    const tripId = parseTripId(req.params.id);
    const target = parseOrThrow(MemberParams, req.params);
    const { userId } = getSessionUser(res);
    res.status(201).json(await remindMember({ db, clock }, tripId, userId, target.userId));
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
          lambda: fairnessLambda,
          ...(recommendationHooks ? { hooks: recommendationHooks } : {}),
        },
        tripId,
        userId,
      ),
    );
  });

  // S5-2b-1: T21 "Ask again", back to ready_for_recommendation for a new round.
  router.post('/trips/:id/reopen-shortlist', requireSession(auth), async (req, res) => {
    const tripId = parseTripId(req.params.id);
    parseOrThrow(z.strictObject({}), req.body ?? {});
    const { userId } = getSessionUser(res);
    res.json(await reopenShortlist({ db, logger: req.log, clock }, tripId, userId));
  });

  // S5-4 (R18): a member's vote on the shortlist, I6. The logic lives in ../recommendations.
  router.put('/trips/:id/vote', requireSession(auth), async (req, res) => {
    const tripId = parseTripId(req.params.id);
    const input = parseOrThrow(VoteInput, req.body);
    const { userId } = getSessionUser(res);
    res.json(await castVote({ db, logger: req.log, clock }, tripId, userId, input));
  });

  router.delete('/trips/:id/vote', requireSession(auth), async (req, res) => {
    const tripId = parseTripId(req.params.id);
    const { userId } = getSessionUser(res);
    res.json(await withdrawVote({ db, logger: req.log, clock }, tripId, userId));
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

  // S3-3: the packages built by T9, member opinions and the organiser's
  // choose / remove / change (T10, T11, I3, I4).
  const PackageParams = z.object({ id: z.string(), packageId: z.string() });
  router.get('/trips/:id/packages', requireSession(auth), async (req, res) => {
    const tripId = parseTripId(req.params.id);
    const { userId } = getSessionUser(res);
    res.json(await listTripPackages(db, tripId, userId));
  });

  router.put('/trips/:id/packages/:packageId/opinion', requireSession(auth), async (req, res) => {
    const { id: tripId, packageId } = parseOrThrow(PackageParams, req.params);
    const { decision } = parseOrThrow(PackageOpinionInput, req.body);
    const { userId } = getSessionUser(res);
    res.json(
      await giveOpinion({ db, logger: req.log, clock }, tripId, packageId, userId, decision),
    );
  });

  router.post('/trips/:id/packages/:packageId/select', requireSession(auth), async (req, res) => {
    const { id: tripId, packageId } = parseOrThrow(PackageParams, req.params);
    const { userId } = getSessionUser(res);
    res.json(await selectPackage({ db, logger: req.log, clock }, tripId, packageId, userId));
  });

  router.post('/trips/:id/packages/:packageId/remove', requireSession(auth), async (req, res) => {
    const { id: tripId, packageId } = parseOrThrow(PackageParams, req.params);
    const { userId } = getSessionUser(res);
    res.json(await removePackage({ db, logger: req.log, clock }, tripId, packageId, userId));
  });

  router.patch('/trips/:id/packages/:packageId', requireSession(auth), async (req, res) => {
    const { id: tripId, packageId } = parseOrThrow(PackageParams, req.params);
    const input = parseOrThrow(ChangePackageInput, req.body);
    const { userId } = getSessionUser(res);
    res.json(await changePackage({ db, logger: req.log, clock }, tripId, packageId, userId, input));
  });

  // S3-6: the day plan built from the accepted package (T12 to T14).
  router.post('/trips/:id/itinerary', requireSession(auth), async (req, res) => {
    const tripId = parseTripId(req.params.id);
    parseOrThrow(z.strictObject({}), req.body ?? {});
    const { userId } = getSessionUser(res);
    res.json(
      await planItinerary(
        { db, logger: req.log, clock, ...(llm ? { llm } : {}), wordingTimeoutMs },
        tripId,
        userId,
      ),
    );
  });

  router.get('/trips/:id/itinerary', requireSession(auth), async (req, res) => {
    const tripId = parseTripId(req.params.id);
    const { userId } = getSessionUser(res);
    res.json(await getItinerary(db, tripId, userId));
  });

  router.post('/trips/:id/itinerary/accept', requireSession(auth), async (req, res) => {
    const tripId = parseTripId(req.params.id);
    const { userId } = getSessionUser(res);
    res.json(await acceptItinerary({ db, logger: req.log, clock }, tripId, userId));
  });

  router.post('/trips/:id/itinerary/reject', requireSession(auth), async (req, res) => {
    const tripId = parseTripId(req.params.id);
    const { userId } = getSessionUser(res);
    res.json(await rejectItinerary({ db, logger: req.log, clock }, tripId, userId));
  });

  const ItemParams = z.object({ id: z.string(), itemId: z.string().min(1) });
  router.get(
    '/trips/:id/itinerary/items/:itemId/alternatives',
    requireSession(auth),
    async (req, res) => {
      const { id, itemId } = parseOrThrow(ItemParams, req.params);
      const { userId } = getSessionUser(res);
      res.json(await itineraryAlternatives({ db, logger: req.log, clock }, id, itemId, userId));
    },
  );
  router.patch('/trips/:id/itinerary/items/:itemId', requireSession(auth), async (req, res) => {
    const { id, itemId } = parseOrThrow(ItemParams, req.params);
    const change = parseOrThrow(ModifyItineraryInput, req.body);
    const { userId } = getSessionUser(res);
    res.json(await modifyItinerary({ db, logger: req.log, clock }, id, itemId, userId, change));
  });

  return router;
}
