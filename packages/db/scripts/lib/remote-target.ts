import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import {
  assertDirectRemote,
  isRemoteTarget,
  pickRemoteUrl,
  type RemoteTarget,
} from '../../src/remote';
import { isLocalHost } from '../../src/target';

// Shared target resolution for scripts that can reach Neon (migrate-remote,
// catalogue-import, seed). Loads .env.neon from the repo root and returns a
// validated direct URL, never a pooled or local one.

const repoRoot = resolve(import.meta.dirname, '../../../..');
const envFile = resolve(repoRoot, '.env.neon');

export function resolveRemoteTarget(target: string | undefined): {
  target: RemoteTarget;
  url: string;
} {
  if (!isRemoteTarget(target)) {
    throw new Error(`Unknown target "${target ?? ''}": expected preview or production.`);
  }
  if (!existsSync(envFile)) {
    throw new Error('.env.neon was not found at the repository root.');
  }
  const url = pickRemoteUrl(parseEnv(readFileSync(envFile, 'utf8')), target);
  assertDirectRemote(url);
  return { target, url };
}

export function requireLocalUrl(url: string | undefined, what: string): string {
  if (!url) throw new Error(`${what}: DATABASE_URL is not set.`);
  if (!isLocalHost(url)) {
    throw new Error(`${what}: DATABASE_URL must point at a local database.`);
  }
  return url;
}
