import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { build } from 'esbuild';

export interface BundleApiOptions {
  entry: string;
  outfile: string;
}

const requireBanner = [
  "import { createRequire as __createRequire } from 'node:module';",
  'const require = __createRequire(import.meta.url);',
].join('\n');

export async function bundleApi({ entry, outfile }: BundleApiOptions): Promise<void> {
  await build({
    entryPoints: [resolve(entry)],
    outfile: resolve(outfile),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    sourcemap: true,
    external: ['pg-native'],
    banner: { js: requireBanner },
    logLevel: 'info',
  });
}

if (isMain()) {
  const { values } = parseArgs({
    options: { entry: { type: 'string' }, out: { type: 'string' } },
  });
  if (!values.entry || !values.out) {
    console.error('Usage: tsx scripts/bundle-api.ts --entry <file> --out <file>');
    process.exit(1);
  }
  await bundleApi({ entry: values.entry, outfile: values.out });
}

function isMain(): boolean {
  const argv1 = process.argv[1];
  return argv1 !== undefined && import.meta.filename === resolve(argv1);
}
