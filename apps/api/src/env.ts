import { loadRootEnv } from '@bonvoyage/shared/node';
import { z } from 'zod';

loadRootEnv(import.meta.dirname);

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.url(),
  APP_URL: z.url().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  LIVE_APIS: z.enum(['on', 'off']).default('off'),
});

export type Env = z.infer<typeof EnvSchema>;

function parseEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (result.success) return result.data;
  for (const issue of result.error.issues) {
    const name = issue.path.join('.') || '(root)';
    process.stderr.write(`Invalid environment variable ${name}: ${issue.message}\n`);
  }
  process.exit(1);
}

export const env = parseEnv();
