import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { aggregate } from './metrics';
import { csvReport, markdownReport } from './report';
import { runEvaluation } from './runner';

const started = performance.now();
const { values } = parseArgs({
  options: {
    scenarios: { type: 'string', default: '500' },
    seed: { type: 'string', default: '20261029' },
    'output-dir': { type: 'string', default: 'docs/evaluation' },
  },
});
function integer(value: string, name: string, min: number, max: number) {
  const parsed = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(parsed) || parsed < min || parsed > max)
    throw new Error(`${name} must be an integer from ${min} to ${max}.`);
  return parsed;
}
const count = integer(values.scenarios, 'scenarios', 1, 100000);
const seed = integer(values.seed, 'seed', 0, 4294967295);
const date = new Date().toISOString().slice(0, 10);
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const dirty =
  execFileSync('git', ['status', '--porcelain', '--', 'scripts/eval'], { encoding: 'utf8' }).trim()
    .length > 0;
const run = runEvaluation(count, seed, date);
const milliseconds = performance.now() - started;
const command = `pnpm eval${process.argv
  .slice(2)
  .map((arg) => ` ${JSON.stringify(arg)}`)
  .join('')}`;
const directory = resolve(values['output-dir']);
mkdirSync(directory, { recursive: true });
const base = resolve(directory, `results-${date}`);
writeFileSync(`${base}.csv`, csvReport(run));
writeFileSync(`${base}.md`, markdownReport(run, { date, commit, command, milliseconds, dirty }));
const metrics = aggregate(run);
console.log(
  `Evaluation: ${count} scenarios, seed ${seed}, ${(milliseconds / 1000).toFixed(3)} seconds`,
);
for (const [key, check] of Object.entries(metrics.checks))
  console.log(
    `${key}: ${check.passed}/${check.total}${check.total ? ` (${((100 * check.passed) / check.total).toFixed(2)}%)` : ' (not exercised)'}`,
  );
console.log(`Diagnostics: ${metrics.diagnostics}/${count}`);
console.log(`Results: ${base}.md and ${base}.csv`);
const defects = run.results.flatMap((r) =>
  r.defects.map((defect) => `seed=${seed}, index=${r.scenario.index}: ${defect}`),
);
if (defects.length) {
  console.error(defects.join('\n'));
  process.exitCode = 1;
}
