import { isLocalHost } from './target';

export type RemoteTarget = 'preview' | 'production';

const URL_KEYS: Record<RemoteTarget, string> = {
  preview: 'NEON_PREVIEW_DIRECT_URL',
  production: 'NEON_PRODUCTION_DIRECT_URL',
};

export function isRemoteTarget(value: string | undefined): value is RemoteTarget {
  return value === 'preview' || value === 'production';
}

export function remoteUrlKey(target: RemoteTarget): string {
  return URL_KEYS[target];
}

export function pickRemoteUrl(
  envFromFile: Record<string, string | undefined>,
  target: RemoteTarget,
): string {
  const key = URL_KEYS[target];
  const value = envFromFile[key];
  if (!value) throw new Error(`${key} is missing from .env.neon.`);
  return value;
}

export function assertDirectRemote(url: string): void {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error('The connection string is not a valid URL.');
  }
  if (isLocalHost(url)) {
    throw new Error('Refusing a local host: migrate:remote is for Neon only.');
  }
  if (hostname.includes('-pooler')) {
    throw new Error('Refusing a pooled host: migrations need a DIRECT connection (no -pooler).');
  }
}

export function imageMajor(composeText: string): number | null {
  const match = /image:\s*postgres:(\d+)/.exec(composeText);
  return match?.[1] ? Number(match[1]) : null;
}

export function serverMajor(serverVersion: string): number | null {
  const match = /^(\d+)/.exec(serverVersion);
  return match?.[1] ? Number(match[1]) : null;
}

export function countPending(journalEntries: number, recorded: number): number {
  return Math.max(0, journalEntries - recorded);
}
