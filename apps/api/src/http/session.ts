import { ERROR_CODES } from '@bonvoyage/shared';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request, RequestHandler, Response } from 'express';
import type { Auth } from '../auth/auth';
import { AppError } from './errors';

export interface SessionUser {
  userId: string;
  name: string;
  email: string;
}

const KEY = 'sessionUser';

export function requireSession(auth: Auth): RequestHandler {
  return async (req, res, next) => {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) {
      next(new AppError(401, ERROR_CODES.UNAUTHENTICATED, 'Sign in to continue.'));
      return;
    }
    res.locals[KEY] = {
      userId: session.user.id,
      name: session.user.name,
      email: session.user.email,
    } satisfies SessionUser;
    next();
  };
}

export function getSessionUser(res: Response): SessionUser {
  const user = res.locals[KEY] as SessionUser | undefined;
  if (!user) throw new Error('getSessionUser called without requireSession');
  return user;
}

/**
 * The signed-in user if there is one, else null. For the few public routes
 * that personalise their answer (GET /api/invitations/:token).
 */
export async function readOptionalSession(auth: Auth, req: Request): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) return null;
  return { userId: session.user.id, name: session.user.name, email: session.user.email };
}
