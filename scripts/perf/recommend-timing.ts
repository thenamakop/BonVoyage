import { createHillsCopies, demoEmail } from '../../apps/api/src/seed/timing-copies';
import { requireLocalUrl } from '../../packages/db/scripts/lib/remote-target';
import { loadRootEnv } from '../../packages/shared/src/node/index';

// S2-8 (R15): pnpm perf:recommend, with pnpm dev running. Makes 5 fresh copies
// of the hills demo in the LOCAL database, asks for recommendations on each as
// Asha through the running API, prints min, median and max, then cancels the
// copies. Never runs against Neon; never prints the password.

const BASE = 'http://localhost:5173';
const RUNS = 5;
const HEADERS = { origin: BASE, 'content-type': 'application/json' };

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

loadRootEnv(import.meta.dirname);
let url: string;
try {
  url = requireLocalUrl(process.env.DATABASE_URL, 'perf:recommend');
} catch (error) {
  fail(error instanceof Error ? error.message : 'DATABASE_URL must point at a local database.');
}
const password = process.env.SEED_DEMO_PASSWORD;
if (!password) fail('SEED_DEMO_PASSWORD is not set.');

const health = await fetch(`${BASE}/api/health`).catch(() => null);
if (!health?.ok) fail(`The API is not answering at ${BASE}: start pnpm dev first.`);

const signIn = await fetch(`${BASE}/api/auth/sign-in/email`, {
  method: 'POST',
  headers: HEADERS,
  body: JSON.stringify({ email: demoEmail('Asha'), password }),
});
if (!signIn.ok)
  fail(`Signing in as ${demoEmail('Asha')} failed (${signIn.status}): run pnpm db:seed.`);
const cookie = signIn.headers
  .getSetCookie()
  .map((c) => c.split(';')[0])
  .join('; ');

const copies = await createHillsCopies(url, RUNS, Date.now().toString(36));
const timings: number[] = [];
let cancelled = 0;
try {
  for (const tripId of copies.tripIds) {
    const started = performance.now();
    const res = await fetch(`${BASE}/api/trips/${tripId}/recommendations`, {
      method: 'POST',
      headers: { ...HEADERS, cookie },
      body: '{}',
    });
    const ms = Math.round(performance.now() - started);
    const body = (await res.json()) as { run?: { kind?: string; feasibleCount?: number } };
    if (!res.ok || body.run?.kind !== 'shortlist') {
      throw new Error(`Run ${timings.length + 1} did not give a shortlist (${res.status}).`);
    }
    timings.push(ms);
    console.log(
      `  run ${timings.length}: ${ms} ms (shortlist, ${body.run.feasibleCount ?? '?'} feasible)`,
    );
  }
} finally {
  for (const tripId of copies.tripIds) {
    const res = await fetch(`${BASE}/api/trips/${tripId}/cancel`, {
      method: 'POST',
      headers: { ...HEADERS, cookie },
      body: '{}',
    });
    if (res.ok) cancelled++;
  }
  await copies.close();
}

const sorted = [...timings].sort((a, b) => a - b);
const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
console.log(
  `R15 recommendation timing over ${sorted.length} runs: min ${sorted[0]} ms, median ${median} ms, max ${sorted.at(-1)} ms (target under 10,000 ms; test budget 2,000 ms)`,
);
console.log(`Cancelled ${cancelled} of ${copies.tripIds.length} timing copies.`);
