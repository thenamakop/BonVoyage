import type { Db } from '@bonvoyage/db';
import { CatalogueImportInput } from '@bonvoyage/shared';
import express from 'express';
import type { Auth } from '../auth/auth';
import { requireAdmin } from '../http/admin';
import { parseOrThrow } from '../http/errors';
import { getSessionUser, requireSession } from '../http/session';
import { catalogueStatus, importCatalogueFiles } from './service';

// S1-7: administrator routes. The 2 MB body parser for the import is mounted
// in app.ts, ahead of the global parser, so it applies before this router.

export function createRouter({
  db,
  auth,
  adminEmails,
  clock = () => new Date(),
}: {
  db: Db;
  auth: Auth;
  adminEmails: readonly string[];
  clock?: () => Date;
}) {
  const router = express.Router();
  const admin = [requireSession(auth), requireAdmin(adminEmails)];

  router.post('/admin/catalogue/import', ...admin, async (req, res) => {
    const input = parseOrThrow(CatalogueImportInput, req.body);
    const { userId } = getSessionUser(res);
    res.json(await importCatalogueFiles({ db, logger: req.log, clock }, userId, input));
  });

  router.get('/admin/catalogue/status', ...admin, async (_req, res) => {
    res.json(await catalogueStatus(db));
  });

  return router;
}
