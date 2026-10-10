import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const output = resolve(import.meta.dirname, '../.vercel/output');
const bundle = resolve(output, 'functions/api.func/index.mjs');

interface Check {
  name: string;
  ok: boolean;
  detail?: string;
}

const checks: Check[] = [];
function record(name: string, ok: boolean, detail?: string): void {
  checks.push({ name, ok, ...(detail === undefined ? {} : { detail }) });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${!ok && detail ? ` (${detail})` : ''}`);
}

interface Reply {
  status: number;
  headers: Headers;
  text: string;
}

async function get(base: string, path: string): Promise<Reply> {
  const res = await fetch(`${base}${path}`);
  return { status: res.status, headers: res.headers, text: await res.text() };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

async function main(): Promise<void> {
  process.env.LOG_LEVEL ??= 'silent';
  const mod = (await import(pathToFileURL(bundle).href)) as {
    default: (req: IncomingMessage, res: ServerResponse) => void;
  };
  const handler: RequestListener = (req, res) => {
    mod.default(req, res);
  };
  const server = createServer(handler);
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    const health = await get(base, '/api/health');
    record('GET /api/health returns 200', health.status === 200, String(health.status));
    record(
      'GET /api/health body is {"status":"ok","db":"ok"}',
      health.text === '{"status":"ok","db":"ok"}',
      health.text,
    );
    record('GET /api/health has an x-request-id header', health.headers.has('x-request-id'));

    const nope = await get(base, '/api/nope');
    const body = parseJson(nope.text) as { error?: { code?: string } } | undefined;
    record('GET /api/nope returns 404', nope.status === 404, String(nope.status));
    record('GET /api/nope has error.code NOT_FOUND', body?.error?.code === 'NOT_FOUND', nope.text);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(() => done()));
  }

  record('static/index.html exists', existsSync(resolve(output, 'static/index.html')));
  const config = parseJson(readFileSync(resolve(output, 'config.json'), 'utf8')) as
    { routes?: { src?: string; dest?: string }[] } | undefined;
  const first = config?.routes?.[0];
  record(
    'first route in config.json is the /api route',
    first?.src === '^/api(?:/.*)?$' && first.dest === '/api',
  );
}

try {
  await main();
} catch (error) {
  record('smoke test ran', false, error instanceof Error ? error.message : String(error));
}

const failed = checks.filter((check) => !check.ok).length;
console.log(failed === 0 ? 'Smoke test passed.' : `Smoke test failed: ${failed} check(s).`);
// The bundled function keeps its database pool open, so exit explicitly.
process.exit(failed === 0 ? 0 : 1);
