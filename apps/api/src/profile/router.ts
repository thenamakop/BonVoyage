import type { Db } from '@bonvoyage/db';
import { AddPastTripInput, DeleteAccountInput, UpdateProfileInput } from '@bonvoyage/shared';
import express from 'express';
import { z } from 'zod';
import type { Auth } from '../auth/auth';
import { parseOrThrow } from '../http/errors';
import { getSessionUser, requireSession } from '../http/session';
import { fromNodeHeaders } from 'better-auth/node';
import { addPastTrip, deleteAccount, getProfile, removePastTrip, updateProfile } from './service';

const PastTripParams = z.object({ id: z.string().min(1) });

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

  router.get('/me/profile', requireSession(auth), async (_req, res) => {
    const { userId } = getSessionUser(res);
    res.json(await getProfile(db, userId));
  });

  router.patch('/me/profile', requireSession(auth), async (req, res) => {
    const input = parseOrThrow(UpdateProfileInput, req.body);
    const { userId } = getSessionUser(res);
    res.json(await updateProfile(db, userId, input));
  });

  // #54: delete the caller's account. The session cookie is cleared; the old
  // cookie gets a 401 because its session row is gone.
  router.delete('/me/profile', requireSession(auth), async (req, res) => {
    const input = parseOrThrow(DeleteAccountInput, req.body);
    const session = getSessionUser(res);
    await deleteAccount(
      { db, auth },
      { userId: session.userId, email: session.email },
      input,
      fromNodeHeaders(req.headers),
    );
    for (const name of ['bonvoyage.session_token', '__Secure-bonvoyage.session_token']) {
      res.clearCookie(name, { path: '/', httpOnly: true, sameSite: 'lax' });
    }
    res.json({ deleted: true });
  });

  router.post('/me/past-trips', requireSession(auth), async (req, res) => {
    const input = parseOrThrow(AddPastTripInput, req.body);
    const { userId } = getSessionUser(res);
    res.status(201).json(await addPastTrip({ db, clock }, userId, input));
  });

  router.delete('/me/past-trips/:id', requireSession(auth), async (req, res) => {
    const { id } = parseOrThrow(PastTripParams, req.params);
    const { userId } = getSessionUser(res);
    await removePastTrip(db, userId, id);
    res.status(204).end();
  });

  return router;
}
