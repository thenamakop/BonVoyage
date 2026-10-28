import { loadRootEnv } from '@bonvoyage/shared/node';
import { z } from 'zod';

loadRootEnv(import.meta.dirname);

const LOCAL_APP_URL = 'http://localhost:5173';

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(32),
    SEED_DEMO_PASSWORD: z.string().optional(),
    APP_URL: z.url().optional(),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    LIVE_APIS: z.enum(['on', 'off']).default('off'),
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL: z.string().optional(),
    // #121 (D4): model calls allowed per India day; 0 means none, so the
    // catalogue templates word every day plan.
    GEMINI_DAILY_LIMIT: z.coerce.number().int().min(0).default(0),
    VERCEL: z.string().optional(),
    VERCEL_ENV: z.enum(['production', 'preview', 'development']).optional(),
    VERCEL_URL: z.string().min(1).optional(),
    // S1-7: comma-separated administrator emails; empty means nobody.
    ADMIN_EMAILS: z
      .string()
      .optional()
      .transform((list) =>
        (list ?? '')
          .split(',')
          .map((e) => e.trim().toLowerCase())
          .filter((e) => e.length > 0),
      ),
  })
  .transform((value) => ({
    ...value,
    APP_URL: value.APP_URL ?? (value.VERCEL_URL ? `https://${value.VERCEL_URL}` : LOCAL_APP_URL),
  }));

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = EnvSchema.safeParse(source);
  if (result.success) return result.data;
  for (const issue of result.error.issues) {
    const name = issue.path.join('.') || '(root)';
    process.stderr.write(`Invalid environment variable ${name}: ${issue.message}\n`);
  }
  process.exit(1);
}

export const env = parseEnv(process.env);
