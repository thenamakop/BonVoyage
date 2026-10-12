import { ERROR_CODES } from '@bonvoyage/shared';
import type { RequestHandler } from 'express';
import { AppError } from './errors';

// S1-6: every write under /api must be JSON. A cross-site HTML form can only
// send form-encoded or text/plain bodies, so it is refused here, before any
// route or session lookup runs (alongside Better Auth's SameSite cookies).
// Mounted after /api/auth, which reads its own bodies. DELETE needs no body.

const WRITES = new Set(['POST', 'PUT', 'PATCH']);

export const requireJson: RequestHandler = (req, _res, next) => {
  // req.is() is null for a request with no body at all; that is refused too,
  // so body-less writes send {} with the JSON header.
  if (WRITES.has(req.method) && !req.is('application/json')) {
    next(
      new AppError(
        415,
        ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
        'Send JSON with the header Content-Type: application/json.',
      ),
    );
    return;
  }
  next();
};
