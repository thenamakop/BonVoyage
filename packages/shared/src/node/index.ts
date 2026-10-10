import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseEnv } from 'node:util';

function findWorkspaceRoot(fromDir: string): string | null {
  let dir = fromDir;
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Loads the workspace-root .env without overwriting variables that are already set. */
export function loadRootEnv(fromDir: string): void {
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') return;
  const root = findWorkspaceRoot(fromDir);
  if (!root) return;
  const envFile = join(root, '.env');
  if (!existsSync(envFile)) return;
  for (const [key, value] of Object.entries(parseEnv(readFileSync(envFile, 'utf8')))) {
    if (process.env[key] === undefined && value !== undefined) process.env[key] = value;
  }
}
