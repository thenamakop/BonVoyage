import type { Db } from '@bonvoyage/db';
import { ERROR_CODES } from '@bonvoyage/shared';
import { eq } from 'drizzle-orm';
import express from 'express';
import { hub, userProfile } from '@bonvoyage/db/schema';
import { z } from 'zod';
import type { Auth } from '../../auth/auth';
import { AppError } from '../../http/errors';
import { getSessionUser, requireSession } from '../../http/session';
import { cancelTrip } from './service';

const tripIdSchema = z.uuid();

export function createRouter({ db, auth }: { db: Db; auth: Auth }) {
  const router = express.Router();
  const clock = () => new Date();

  router.get('/me', requireSession(auth), async (_req, res) => {
    const { userId, name, email } = getSessionUser(res);
    const rows = await db
      .select({ homeHubSlug: hub.slug })
      .from(userProfile)
      .leftJoin(hub, eq(userProfile.homeHubId, hub.id))
      .where(eq(userProfile.userId, userId))
      .limit(1);
    res.json({ id: userId, name, email, homeHubSlug: rows[0]?.homeHubSlug ?? null });
  });

  router.post('/trips/:id/cancel', requireSession(auth), async (req, res) => {
    const parsed = tripIdSchema.safeParse(req.params.id);
    if (!parsed.success) {
      throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Some fields are invalid.', {
        id: 'must be a uuid',
      });
    }
    const { userId } = getSessionUser(res);
    const result = await cancelTrip({ db, logger: req.log, clock }, parsed.data, userId);
    res.json(result);
  });

  return router;
}
