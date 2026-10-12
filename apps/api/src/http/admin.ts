import { ERROR_CODES } from '@bonvoyage/shared';
import type { RequestHandler } from 'express';
import { AppError } from './errors';
import { getSessionUser } from './session';

// S1-7: the administrator role is an email allowlist (ADMIN_EMAILS), so it
// needs no database column. The list is lowercased when the env is parsed;
// the session email is lowercased here, so the match ignores case.

export function isAdmin(adminEmails: readonly string[], email: string): boolean {
  return adminEmails.includes(email.trim().toLowerCase());
}

/** Use after requireSession. */
export function requireAdmin(adminEmails: readonly string[]): RequestHandler {
  return (_req, res, next) => {
    if (!isAdmin(adminEmails, getSessionUser(res).email)) {
      next(new AppError(403, ERROR_CODES.FORBIDDEN, 'Only administrators can do this.'));
      return;
    }
    next();
  };
}
