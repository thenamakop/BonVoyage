import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import type { z } from 'zod';
import {
  HEADERS,
  costRulesFile,
  destinationRow,
  fareRow,
  hubRow,
  poiRow,
  type CostRules,
  type DestinationRow,
  type FareRow,
  type HubRow,
  type PoiRow,
} from './schemas';
import { checkCatalogue } from './checks';

export interface CatalogueIssue {
  file: string;
  line?: number;
  column?: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface Catalogue {
  hubs: HubRow[];
  destinations: DestinationRow[];
  fares: FareRow[];
  pois: PoiRow[];
  costRules: CostRules | undefined;
  issues: CatalogueIssue[];
}

/**
 * The five catalogue files as text. undefined means the file could not be
 * read; parseCatalogue reports that as an error, as loadCatalogue always has.
 */
export interface CatalogueFiles {
  hubs: string | undefined;
  destinations: string | undefined;
  fares: string | undefined;
  pois: string | undefined;
  costRules: string | undefined;
}

interface RowWithLine {
  record: Record<string, string>;
  line: number;
}

function readCsv(file: string, text: string | undefined, issues: CatalogueIssue[]): RowWithLine[] {
  if (text === undefined) {
    issues.push({ file, severity: 'error', message: 'file not found or unreadable' });
    return [];
  }
  let rows: string[][];
  try {
    rows = parse(text, { bom: true, skipEmptyLines: true, relaxColumnCount: false });
  } catch (error) {
    issues.push({
      file,
      severity: 'error',
      message: `CSV parse error: ${error instanceof Error ? error.message : String(error)}`,
    });
    return [];
  }
  const [header, ...data] = rows;
  const expected = HEADERS[file.replace('.csv', '') as keyof typeof HEADERS];
  if (!header || header.join(',') !== expected) {
    issues.push({
      file,
      line: 1,
      severity: 'error',
      message: `header row differs from the spec; expected "${expected}"`,
    });
    return [];
  }
  const names = header;
  return data.map((cells, i) => ({
    line: i + 2,
    record: Object.fromEntries(names.map((n, j) => [n, cells[j] ?? ''])),
  }));
}

function validateRows<T>(
  file: string,
  rows: RowWithLine[],
  schema: z.ZodType<T>,
  issues: CatalogueIssue[],
): T[] {
  const out: T[] = [];
  for (const { record, line } of rows) {
    const result = schema.safeParse(record);
    if (result.success) {
      out.push(result.data);
    } else {
      for (const issue of result.error.issues) {
        issues.push({
          file,
          line,
          column: issue.path[0] === undefined ? undefined : String(issue.path[0]),
          severity: 'error',
          message: issue.message,
        });
      }
    }
  }
  return out;
}

/**
 * Every check catalogue:check and the importers run: headers, row validation
 * and the cross-file checks. Takes the files as text so the administrator
 * page (S1-7) can check uploaded files without touching the disk.
 */
export function parseCatalogue(files: CatalogueFiles, opts: { today: string }): Catalogue {
  const issues: CatalogueIssue[] = [];
  const { today } = opts;

  const hubs = validateRows(
    'hubs.csv',
    readCsv('hubs.csv', files.hubs, issues),
    hubRow(today),
    issues,
  );
  const destinations = validateRows(
    'destinations.csv',
    readCsv('destinations.csv', files.destinations, issues),
    destinationRow(today),
    issues,
  );
  const fares = validateRows(
    'fares.csv',
    readCsv('fares.csv', files.fares, issues),
    fareRow(today),
    issues,
  );
  const pois = validateRows(
    'pois.csv',
    readCsv('pois.csv', files.pois, issues),
    poiRow(today),
    issues,
  );

  let costRules: CostRules | undefined;
  try {
    if (files.costRules === undefined) throw new Error('file not found or unreadable');
    const result = costRulesFile(today).safeParse(JSON.parse(files.costRules));
    if (result.success) {
      costRules = result.data;
    } else {
      for (const issue of result.error.issues) {
        issues.push({
          file: 'cost-rules.json',
          column: issue.path.join('.') || undefined,
          severity: 'error',
          message: issue.message,
        });
      }
    }
  } catch (error) {
    issues.push({
      file: 'cost-rules.json',
      severity: 'error',
      message: `unreadable or invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  issues.push(...checkCatalogue({ hubs, destinations, fares, pois }));
  return { hubs, destinations, fares, pois, costRules, issues };
}

function readText(dir: string, file: string): string | undefined {
  try {
    return readFileSync(join(dir, file), 'utf8');
  } catch {
    return undefined;
  }
}

/** Reads the five files from a catalogue directory and parses them. */
export function loadCatalogue(dir: string, opts: { today: string }): Catalogue {
  return parseCatalogue(
    {
      hubs: readText(dir, 'hubs.csv'),
      destinations: readText(dir, 'destinations.csv'),
      fares: readText(dir, 'fares.csv'),
      pois: readText(dir, 'pois.csv'),
      costRules: readText(dir, 'cost-rules.json'),
    },
    opts,
  );
}
