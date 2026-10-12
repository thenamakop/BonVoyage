import type { Db } from '@bonvoyage/db';
import express from 'express';
import type { Auth } from '../auth/auth';
import { router as filtering } from './filtering/router';
import { router as integration } from './integration/router';
import { router as itinerary } from './itinerary/router';
import { router as notifications } from './notifications/router';
import { router as packages } from './packages/router';
import { router as preferences } from './preferences/router';
import { router as recommendation } from './recommendation/router';
import { router as transportCost } from './transport-cost/router';
import { router as tripFeedback } from './trip-feedback/router';
import { createRouter as invitations } from '../invitations/router';
import { createRouter as profile } from '../profile/router';
import { createRouter as trips } from '../trips/router';
import { createRouter as usersGroups } from './users-groups/router';

export function createApiRouter(deps: { db: Db; auth: Auth; clock?: () => Date }) {
  const apiRouter = express.Router();

  apiRouter.use(usersGroups({ db: deps.db, auth: deps.auth }));
  apiRouter.use(trips(deps));
  apiRouter.use(invitations(deps));
  apiRouter.use(profile(deps));
  apiRouter.use(preferences);
  apiRouter.use(filtering);
  apiRouter.use(recommendation);
  apiRouter.use(transportCost);
  apiRouter.use(packages);
  apiRouter.use(itinerary);
  apiRouter.use(tripFeedback);
  apiRouter.use(notifications);
  apiRouter.use(integration);

  return apiRouter;
}
