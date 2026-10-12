import type { Db } from '@bonvoyage/db';
import * as authSchema from '@bonvoyage/db/schema/auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth';

export interface AuthOptions {
  db: Db;
  secret: string;
  baseURL: string | { allowedHosts: string[] };
}

export function createAuth({ db, secret, baseURL }: AuthOptions) {
  return betterAuth({
    appName: 'BonVoyage',
    secret,
    baseURL,
    basePath: '/api/auth',
    database: drizzleAdapter(db, { provider: 'pg', schema: authSchema }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: true,
    },
    session: {
      expiresIn: 7 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
    },
    advanced: { cookiePrefix: 'bonvoyage' },
    telemetry: { enabled: false },
  });
}

export type Auth = ReturnType<typeof createAuth>;

// Vercel previews change host per deployment, so Better Auth trusts a host
// list rather than one baseURL; APP_URL's host is added when not covered.
export function baseUrlOptions(appUrl: string): { allowedHosts: string[] } {
  const hosts = ['localhost:5173', 'localhost:4000', '*.vercel.app'];
  const host = new URL(appUrl).host;
  if (!hosts.includes(host) && !host.endsWith('.vercel.app')) hosts.push(host);
  return { allowedHosts: hosts };
}
