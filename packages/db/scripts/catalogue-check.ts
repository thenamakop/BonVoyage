import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { DESTINATION_TYPES } from '@bonvoyage/shared';
import { loadCatalogue, type CatalogueIssue } from '../src/catalogue/load';

// S0-4: validates packages/db/catalogue and reports verification progress.
// Exit 1 on any error; --require a|b|c also fails on draft rows of that stage
// and every earlier stage.

const STAGES = {
  a: { name: 'A (hubs, destination identity)', due: '2026-10-18' },
  b: { name: 'B (destination costs, fares, cost rules)', due: '2026-10-25' },
  c: { name: 'C (POIs)', due: '2026-11-01' },
} as const;
type Stage = keyof typeof STAGES;
const STAGE_ORDER: Stage[] = ['a', 'b', 'c'];

const { values } = parseArgs({
  options: {
    require: { type: 'string' },
    today: { type: 'string' },
  },
  strict: true,
});

const today = values.today ?? new Date().toISOString().slice(0, 10);
const requireStage = values.require as Stage | undefined;
if (requireStage !== undefined && !(requireStage in STAGES)) {
  console.error('Usage: pnpm catalogue:check [--require a|b|c] [--today YYYY-MM-DD]');
  process.exit(2);
}

const dir = resolve(import.meta.dirname, '../catalogue');
const { hubs, destinations, fares, pois, costRules, issues } = loadCatalogue(dir, { today });

if (requireStage) {
  const upto = STAGE_ORDER.indexOf(requireStage);
  const draftIssues: CatalogueIssue[] = [];
  const drafts = (what: string, status: string, file: string) => {
    if (status === 'draft') {
      draftIssues.push({ file, severity: 'error', message: `${what} is still draft` });
    }
  };
  if (upto >= 0) {
    for (const h of hubs) drafts(`hub "${h.slug}"`, h.review_status, 'hubs.csv');
    for (const d of destinations)
      drafts(`destination "${d.slug}"`, d.review_status, 'destinations.csv');
  }
  if (upto >= 1) {
    for (const d of destinations)
      drafts(`destination "${d.slug}" costs`, d.cost_review_status, 'destinations.csv');
    for (const f of fares)
      drafts(
        `fare "${f.origin_hub} -> ${f.destination_slug}" (${f.mode})`,
        f.review_status,
        'fares.csv',
      );
    if (costRules) {
      for (const [key, entry] of Object.entries(costRules)) {
        drafts(`cost rule "${key}"`, entry.review_status, 'cost-rules.json');
      }
    }
  }
  if (upto >= 2) {
    for (const p of pois)
      drafts(`POI "${p.destination_slug}/${p.poi_key}"`, p.review_status, 'pois.csv');
  }
  issues.push(...draftIssues);
}

const byFile = new Map<string, CatalogueIssue[]>();
for (const issue of issues) {
  const list = byFile.get(issue.file) ?? [];
  list.push(issue);
  byFile.set(issue.file, list);
}
const counts = { error: 0, warning: 0, info: 0 };
for (const issue of issues) counts[issue.severity] += 1;

for (const file of ['hubs.csv', 'destinations.csv', 'fares.csv', 'pois.csv', 'cost-rules.json']) {
  const list = byFile.get(file) ?? [];
  if (list.length === 0) continue;
  console.log(`\n${file}`);
  for (const issue of list) {
    const where = issue.line !== undefined ? `line ${issue.line}` : (issue.column ?? '');
    console.log(`  ${issue.severity.toUpperCase().padEnd(7)} ${where.padEnd(9)} ${issue.message}`);
  }
}

const verified = (n: number, total: number) => `${n}/${total} verified`;
const stageCount = {
  a: {
    verified:
      hubs.filter((h) => h.review_status === 'verified').length +
      destinations.filter((d) => d.review_status === 'verified').length,
    total: hubs.length + destinations.length,
  },
  b: {
    verified:
      destinations.filter((d) => d.cost_review_status === 'verified').length +
      fares.filter((f) => f.review_status === 'verified').length +
      (costRules
        ? Object.values(costRules).filter((e) => e.review_status === 'verified').length
        : 0),
    total: destinations.length + fares.length + (costRules ? Object.keys(costRules).length : 0),
  },
  c: {
    verified: pois.filter((p) => p.review_status === 'verified').length,
    total: pois.length,
  },
};

console.log('\nVerification (a row counts once checked against its source):');
for (const stage of STAGE_ORDER) {
  console.log(
    `  Stage ${STAGES[stage].name.padEnd(48)} ${verified(stageCount[stage].verified, stageCount[stage].total).padEnd(16)} due ${STAGES[stage].due}`,
  );
}

console.log('\nCoverage:');
const typeCounts = new Map<string, number>();
for (const d of destinations)
  for (const t of d.types) typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
console.log(
  `  Destinations per type: ${DESTINATION_TYPES.map((t) => `${t} ${typeCounts.get(t) ?? 0}`).join(', ')}`,
);
const poiCounts = destinations.map((d) => pois.filter((p) => p.destination_slug === d.slug).length);
const sorted = [...poiCounts].sort((a, b) => a - b);
const median =
  sorted.length === 0
    ? 0
    : sorted.length % 2 === 1
      ? sorted[Math.floor(sorted.length / 2)]
      : ((sorted[sorted.length / 2 - 1] ?? 0) + (sorted[sorted.length / 2] ?? 0)) / 2;
console.log(`  POIs per destination: min ${sorted[0] ?? 0}, median ${median}`);
const fareCounts = new Map<string, number>();
for (const f of fares) {
  const key = `${f.origin_hub} ${f.mode}`;
  fareCounts.set(key, (fareCounts.get(key) ?? 0) + 1);
}
console.log(
  `  Fare rows per hub and mode: ${[...fareCounts.entries()].map(([k, n]) => `${k} ${n}`).join(', ')}`,
);

console.log(`\n${counts.error} error(s), ${counts.warning} warning(s), ${counts.info} info`);
process.exit(counts.error > 0 ? 1 : 0);
