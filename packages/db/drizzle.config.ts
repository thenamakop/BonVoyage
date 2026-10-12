import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { defineConfig } from 'drizzle-kit';

const configDir = dirname(fileURLToPath(import.meta.url));
const envFile = resolve(configDir, '../../.env');
if (existsSync(envFile)) {
  for (const [key, value] of Object.entries(parseEnv(readFileSync(envFile, 'utf8')))) {
    if (process.env[key] === undefined && value !== undefined) process.env[key] = value;
  }
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  casing: 'snake_case',
  strict: true,
  verbose: true,
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
});
