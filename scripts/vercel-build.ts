import { spawnSync } from 'node:child_process';
import { cp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { bundleApi } from './bundle-api';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, '.vercel/output');
const functionDir = resolve(output, 'functions/api.func');
const bundle = resolve(functionDir, 'index.mjs');

async function countFiles(dir: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    total += entry.isDirectory() ? await countFiles(resolve(dir, entry.name)) : 1;
  }
  return total;
}

function buildWeb(): void {
  const result = spawnSync('pnpm --filter @bonvoyage/web build', {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) throw new Error('The web build failed.');
}

async function main(): Promise<void> {
  await rm(output, { recursive: true, force: true });

  buildWeb();
  await mkdir(output, { recursive: true });
  await cp(resolve(root, 'apps/web/dist'), resolve(output, 'static'), { recursive: true });

  await mkdir(functionDir, { recursive: true });
  await bundleApi({ entry: resolve(root, 'apps/api/src/vercel-entry.ts'), outfile: bundle });

  await writeFile(
    resolve(functionDir, '.vc-config.json'),
    JSON.stringify({
      runtime: 'nodejs24.x',
      handler: 'index.mjs',
      launcherType: 'Nodejs',
      shouldAddHelpers: false,
      shouldAddSourcemapSupport: true,
      regions: ['sin1'],
      maxDuration: 60,
    }),
  );

  await writeFile(
    resolve(output, 'config.json'),
    JSON.stringify({
      version: 3,
      routes: [
        { src: '^/api(?:/.*)?$', dest: '/api' },
        {
          src: '^/assets/(.*)$',
          headers: { 'cache-control': 'public, max-age=31536000, immutable' },
          continue: true,
        },
        { handle: 'filesystem' },
        { src: '^/assets/.*$', status: 404 },
        { src: '^/.*$', dest: '/index.html' },
      ],
    }),
  );

  const size = (await stat(bundle)).size;
  const staticFiles = await countFiles(resolve(output, 'static'));
  console.log(`index.mjs: ${(size / 1024 / 1024).toFixed(2)} MB (${size} bytes)`);
  console.log(`static files: ${staticFiles}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
