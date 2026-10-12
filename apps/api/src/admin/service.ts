import {
  CATALOGUE_STAGES,
  CATALOGUE_STAGE_ORDER,
  importParsedCatalogue,
  parseCatalogue,
  type Db,
  type CatalogueIssue as DbIssue,
} from '@bonvoyage/db';
import {
  ERROR_CODES,
  indiaDate,
  type CatalogueCounts,
  type CatalogueImportInput,
  type CatalogueImportResponse,
  type CatalogueIssue,
  type CatalogueStatusResponse,
  type StageProgress,
} from '@bonvoyage/shared';
import type { Logger } from 'pino';
import { AppError } from '../http/errors';
import { destinationsNotIn, lastUpdatedAt, stageCounts, tableCounts } from './repository';

// S1-7: administrator catalogue re-import. Writes exactly what the files say
// (never deletes a row, never decides review_status) and reports what a real
// import would change before anything is written.

interface Deps {
  db: Db;
  logger: Logger;
  clock: () => Date;
}

const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 } as const;

function toIssue(i: DbIssue): CatalogueIssue {
  return {
    file: i.file,
    line: i.line ?? null,
    ...(i.column === undefined ? {} : { column: i.column }),
    severity: i.severity,
    message: i.message,
  };
}

async function stagesOf(db: Parameters<typeof stageCounts>[0]): Promise<StageProgress[]> {
  const counts = await stageCounts(db);
  return CATALOGUE_STAGE_ORDER.map((stage) => ({
    stage,
    verified: counts[stage].verified,
    total: counts[stage].total,
    dueDate: CATALOGUE_STAGES[stage].due,
  }));
}

// Thrown at the end of a dry run's transaction so that it rolls back on purpose.
class DryRunRollback extends Error {}

export async function importCatalogueFiles(
  { db, logger, clock }: Deps,
  adminUserId: string,
  input: CatalogueImportInput,
): Promise<CatalogueImportResponse> {
  const parsed = parseCatalogue(input.files, { today: indiaDate(clock()) });
  const issues = parsed.issues
    .map(toIssue)
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  if (issues.some((i) => i.severity === 'error')) {
    throw new AppError(
      422,
      ERROR_CODES.CATALOGUE_INVALID,
      'The files have errors. Fix them and check again.',
      undefined,
      { issues },
    );
  }

  let response: CatalogueImportResponse | undefined;
  try {
    await db.transaction(async (tx) => {
      const raw = await importParsedCatalogue(tx, parsed);
      const counts = Object.fromEntries(
        Object.entries(raw).map(([table, c]) => [
          table,
          { inserted: c.inserted, updated: c.updated },
        ]),
      ) as CatalogueCounts;
      response = {
        dryRun: input.dryRun,
        issues,
        counts,
        // Read inside the transaction, so a dry run shows the state an import would leave.
        stages: await stagesOf(tx),
        notInFiles: await destinationsNotIn(
          tx,
          parsed.destinations.map((d) => d.slug),
        ),
      };
      if (input.dryRun) throw new DryRunRollback();
    });
  } catch (err) {
    if (!(err instanceof DryRunRollback)) throw err;
  }
  if (!response) throw new AppError(500, ERROR_CODES.INTERNAL, 'Something went wrong.');

  // Who and what, never the file contents.
  logger.info({ adminUserId, dryRun: input.dryRun, counts: response.counts }, 'catalogue import');
  return response;
}

export async function catalogueStatus(db: Db): Promise<CatalogueStatusResponse> {
  const [tables, stages, updated] = await Promise.all([
    tableCounts(db),
    stagesOf(db),
    lastUpdatedAt(db),
  ]);
  return { tables, stages, lastUpdatedAt: updated ? updated.toISOString() : null };
}
