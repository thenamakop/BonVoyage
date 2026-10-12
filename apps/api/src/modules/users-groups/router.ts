import type { Db } from '@bonvoyage/db';
import { eq } from 'drizzle-orm';
import express from 'express';
import { hub, userProfile } from '@bonvoyage/db/schema';
import type { Auth } from '../../auth/auth';
import { getSessionUser, requireSession } from '../../http/session';

export function createRouter({ db, auth }: { db: Db; auth: Auth }) {
  const router = express.Router();

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

  return router;
}
