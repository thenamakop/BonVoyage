import { z } from 'zod';

// Administrator catalogue re-import (S1-7). The import writes exactly what the
// files say: it never deletes a row and never decides review_status itself
// (decision 0002: only Maulik marks rows verified).

const fileText = z.string().max(1_000_000, 'Each file must be under 1,000,000 characters.');

export const CatalogueFiles = z.object({
  hubs: fileText,
  destinations: fileText,
  fares: fileText,
  pois: fileText,
  costRules: fileText,
});
export type CatalogueFiles = z.infer<typeof CatalogueFiles>;

export const CatalogueImportInput = z.object({
  files: CatalogueFiles,
  /** true: check and count only, then roll back; nothing is written. */
  dryRun: z.boolean(),
});
export type CatalogueImportInput = z.infer<typeof CatalogueImportInput>;

export const CatalogueIssue = z.object({
  file: z.string(),
  /** 1-based line in the file; null for a whole-file or cross-file issue. */
  line: z.number().int().nullable(),
  column: z.string().optional(),
  severity: z.enum(['error', 'warning', 'info']),
  message: z.string(),
});
export type CatalogueIssue = z.infer<typeof CatalogueIssue>;

export const CATALOGUE_TABLE_NAMES = [
  'hub',
  'destination',
  'poi',
  'fare_fallback',
  'cost_rule',
] as const;
export const CatalogueTableName = z.enum(CATALOGUE_TABLE_NAMES);
export type CatalogueTableName = z.infer<typeof CatalogueTableName>;

const tableCount = z.object({ inserted: z.number().int(), updated: z.number().int() });
export const CatalogueCounts = z.object({
  hub: tableCount,
  destination: tableCount,
  poi: tableCount,
  fare_fallback: tableCount,
  cost_rule: tableCount,
});
export type CatalogueCounts = z.infer<typeof CatalogueCounts>;

export const StageProgress = z.object({
  stage: z.enum(['a', 'b', 'c']),
  verified: z.number().int(),
  total: z.number().int(),
  /** YYYY-MM-DD */
  dueDate: z.string(),
});
export type StageProgress = z.infer<typeof StageProgress>;

export const CatalogueImportResponse = z.object({
  dryRun: z.boolean(),
  /** Warnings and info only: a file set with errors is refused with 422. */
  issues: z.array(CatalogueIssue),
  counts: CatalogueCounts,
  stages: z.array(StageProgress),
  /** Destination slugs in the database that the files no longer contain (never deleted). */
  notInFiles: z.array(z.string()),
});
export type CatalogueImportResponse = z.infer<typeof CatalogueImportResponse>;

export const CatalogueStatusResponse = z.object({
  tables: z.object({
    hub: z.number().int(),
    destination: z.number().int(),
    poi: z.number().int(),
    fare_fallback: z.number().int(),
    cost_rule: z.number().int(),
  }),
  stages: z.array(StageProgress),
  lastUpdatedAt: z.string().nullable(),
});
export type CatalogueStatusResponse = z.infer<typeof CatalogueStatusResponse>;

/** The 422 CATALOGUE_INVALID envelope carries every issue in error.details. */
export const CatalogueInvalidDetails = z.object({ issues: z.array(CatalogueIssue) });
export type CatalogueInvalidDetails = z.infer<typeof CatalogueInvalidDetails>;
