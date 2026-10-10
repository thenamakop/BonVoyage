import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const envFile = resolve(import.meta.dirname, '.env');
if (existsSync(envFile)) {
  for (const [key, value] of Object.entries(parseEnv(readFileSync(envFile, 'utf8')))) {
    if (process.env[key] === undefined && value !== undefined) process.env[key] = value;
  }
}

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? 'postgres://bonvoyage:bonvoyage@localhost:5433/bonvoyage_test';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
    projects: [
      {
        test: {
          name: 'unit',
          include: ['packages/*/src/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'web',
          root: 'apps/web',
          environment: 'jsdom',
          setupFiles: ['./src/test-setup.ts'],
          include: ['src/**/*.test.{ts,tsx}'],
        },
      },
      {
        test: {
          name: 'integration',
          include: ['apps/api/src/**/*.test.ts', 'packages/db/test/**/*.test.ts'],
          environment: 'node',
          fileParallelism: false,
          globalSetup: ['packages/db/test/global-setup.ts'],
          env: {
            DATABASE_URL: testDatabaseUrl,
            LIVE_APIS: 'off',
            LOG_LEVEL: 'silent',
          },
        },
      },
    ],
  },
});
