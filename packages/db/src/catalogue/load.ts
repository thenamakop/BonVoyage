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

interface RowWithLine {
  record: Record<string, string>;
  line: number;
}

function readCsv(file: string, dir: string, issues: CatalogueIssue[]): RowWithLine[] {
  const path = join(dir, file);
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
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

export function loadCatalogue(dir: string, opts: { today: string }): Catalogue {
  const issues: CatalogueIssue[] = [];
  const { today } = opts;

  const hubs = validateRows('hubs.csv', readCsv('hubs.csv', dir, issues), hubRow(today), issues);
  const destinations = validateRows(
    'destinations.csv',
    readCsv('destinations.csv', dir, issues),
    destinationRow(today),
    issues,
  );
  const fares = validateRows(
    'fares.csv',
    readCsv('fares.csv', dir, issues),
    fareRow(today),
    issues,
  );
  const pois = validateRows('pois.csv', readCsv('pois.csv', dir, issues), poiRow(today), issues);

  let costRules: CostRules | undefined;
  try {
    const result = costRulesFile(today).safeParse(
      JSON.parse(readFileSync(join(dir, 'cost-rules.json'), 'utf8')),
    );
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
