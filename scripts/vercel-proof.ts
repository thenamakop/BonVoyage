import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const output = resolve(import.meta.dirname, '../.vercel/output');
const functionDir = resolve(output, 'functions/api.func');

rmSync(output, { recursive: true, force: true });
mkdirSync(resolve(output, 'static'), { recursive: true });
mkdirSync(functionDir, { recursive: true });

writeFileSync(resolve(output, 'static/index.html'), 'BonVoyage deploy proof\n');

writeFileSync(
  resolve(functionDir, 'index.mjs'),
  [
    'export default function handler(req, res) {',
    '  res.statusCode = 200;',
    "  res.setHeader('content-type', 'application/json');",
    '  res.end(JSON.stringify({ ok: true, url: req.url }));',
    '}',
    '',
  ].join('\n'),
);

writeFileSync(
  resolve(functionDir, '.vc-config.json'),
  JSON.stringify({
    runtime: 'nodejs24.x',
    handler: 'index.mjs',
    launcherType: 'Nodejs',
    shouldAddHelpers: false,
    shouldAddSourcemapSupport: true,
    regions: ['sin1'],
  }),
);

writeFileSync(
  resolve(output, 'config.json'),
  JSON.stringify({
    version: 3,
    routes: [
      { src: '^/api(?:/.*)?$', dest: '/api' },
      { handle: 'filesystem' },
      { src: '^/assets/.*$', status: 404 },
      { src: '^/.*$', dest: '/index.html' },
    ],
  }),
);
