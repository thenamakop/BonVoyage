import { createDb } from '@bonvoyage/db';
import { pino } from 'pino';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { createAuth } from '../auth/auth';
import { ENDPOINTS } from '../test/endpoint-inventory';

// S1-6 step 1: the inventory and the routes Express actually registered must
// match exactly, so a new endpoint cannot skip the access matrix.

const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const auth = createAuth({
  db,
  secret: 'test-secret-test-secret-test-secret',
  baseURL: 'http://localhost:4000',
});
const app = createApp({ db, pool, logger: pino({ level: 'silent' }), auth });

afterAll(async () => {
  await pool.end();
});

interface Layer {
  name?: string;
  slash?: boolean;
  matchers?: ((path: string) => { path: string } | false)[];
  route?: { path: string; methods: Record<string, boolean> };
  handle?: { stack?: Layer[] };
}

// Express 5 keeps a router's mount path only inside its matcher, so the prefix
// is found by asking the matcher about a probe path. Every API route lives
// under /api (AGENTS.md 3), so /api is the only prefix to probe.
function mountPrefix(layer: Layer): string {
  if (layer.slash) return '';
  const hit = layer.matchers?.[0]?.('/api/probe');
  if (hit && hit.path === '/api') return '/api';
  throw new Error('a router is mounted somewhere other than / or /api');
}

function collect(stack: Layer[], prefix: string, out: string[]) {
  for (const layer of stack) {
    if (layer.route) {
      for (const [method, on] of Object.entries(layer.route.methods)) {
        if (on && method !== '_all')
          out.push(`${method.toUpperCase()} ${prefix}${layer.route.path}`);
        if (on && method === '_all') out.push(`ALL ${prefix}${layer.route.path}`);
      }
    } else if (layer.handle?.stack) {
      collect(layer.handle.stack, prefix + mountPrefix(layer), out);
    }
  }
}

describe('registered routes', () => {
  it('match the endpoint inventory exactly (Better Auth excluded)', () => {
    const registered: string[] = [];
    collect((app as unknown as { router: { stack: Layer[] } }).router.stack, '', registered);
    const actual = registered.filter((r) => !r.includes('/api/auth/')).sort();
    const expected = ENDPOINTS.map((e) => `${e.method} ${e.path}`).sort();

    const missingFromInventory = actual.filter((r) => !expected.includes(r));
    const notRegistered = expected.filter((r) => !actual.includes(r));
    expect({ missingFromInventory, notRegistered }).toEqual({
      missingFromInventory: [],
      notRegistered: [],
    });
    expect(new Set(actual).size).toBe(actual.length);
    // Better Auth is mounted (Express 5's app.all registers each method).
    expect(registered).toContain('POST /api/auth/*splat');
    expect(actual).toHaveLength(24);
  });
});
