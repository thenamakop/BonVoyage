import type { Db } from '@bonvoyage/db';
import { ERROR_CODES } from '@bonvoyage/shared';
import express from 'express';
import { z } from 'zod';
import type { Auth } from '../auth/auth';
import { AppError } from '../http/errors';
import { getSessionUser, requireSession } from '../http/session';
import { getNotifications, readAllNotifications, readNotification } from './service';

// S5-3: the caller's own notifications. The Remind route is trip-scoped, so it
// lives with the trips routes (AGENTS.md 4) and calls ./service.

const uuid = z.uuid();

function parseId(value: unknown): string {
  const parsed = uuid.safeParse(value);
  if (!parsed.success) {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Some fields are invalid.', {
      id: 'must be a uuid',
    });
  }
  return parsed.data;
}

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

  router.get('/notifications', requireSession(auth), async (_req, res) => {
    const { userId } = getSessionUser(res);
    res.json(await getNotifications(db, userId));
  });

  // Registered before /notifications/:id/read so "read-all" is never read as an id.
  router.post('/notifications/read-all', requireSession(auth), async (_req, res) => {
    const { userId } = getSessionUser(res);
    await readAllNotifications(db, clock, userId);
    res.status(204).end();
  });

  router.post('/notifications/:id/read', requireSession(auth), async (req, res) => {
    const id = parseId(req.params.id);
    const { userId } = getSessionUser(res);
    await readNotification(db, clock, userId, id);
    res.status(204).end();
  });

  return router;
}
