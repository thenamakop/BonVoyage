import express from 'express';
import { router as filtering } from './filtering/router';
import { router as integration } from './integration/router';
import { router as itinerary } from './itinerary/router';
import { router as notifications } from './notifications/router';
import { router as packages } from './packages/router';
import { router as preferences } from './preferences/router';
import { router as recommendation } from './recommendation/router';
import { router as transportCost } from './transport-cost/router';
import { router as tripFeedback } from './trip-feedback/router';
import { router as users } from './users-groups/router';

export const apiRouter = express.Router();

apiRouter.use(users);
apiRouter.use(preferences);
apiRouter.use(filtering);
apiRouter.use(recommendation);
apiRouter.use(transportCost);
apiRouter.use(packages);
apiRouter.use(itinerary);
apiRouter.use(tripFeedback);
apiRouter.use(notifications);
apiRouter.use(integration);
