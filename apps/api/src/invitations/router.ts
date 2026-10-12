import type { Db } from '@bonvoyage/db';
import { ERROR_CODES } from '@bonvoyage/shared';
import express from 'express';
import type { Auth } from '../auth/auth';
import { AppError } from '../http/errors';
import { getSessionUser, readOptionalSession, requireSession } from '../http/session';
import { acceptInvitation, previewInvitation } from './service';

// Token routes (S1-3). A token is base64url; anything else cannot be a link we
// issued, so it gets the same 404 as an unknown token.
const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;

function parseToken(value: unknown): string {
  if (typeof value !== 'string' || !TOKEN.test(value)) {
    throw new AppError(404, ERROR_CODES.NOT_FOUND, 'This invitation link is not valid.');
  }
  return value;
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

  // Public (conventions rule 3); the session is read only to fill alreadyMember.
  router.get('/invitations/:token', async (req, res) => {
    const token = parseToken(req.params.token);
    const viewer = await readOptionalSession(auth, req);
    res.json(
      await previewInvitation({ db, logger: req.log, clock }, token, viewer?.userId ?? null),
    );
  });

  router.post('/invitations/:token/accept', requireSession(auth), async (req, res) => {
    const token = parseToken(req.params.token);
    const { userId } = getSessionUser(res);
    res.json(await acceptInvitation({ db, logger: req.log, clock }, token, userId));
  });

  return router;
}
