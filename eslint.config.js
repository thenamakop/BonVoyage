import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/.vercel/**',
      'packages/db/migrations/**',
      'docs/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      eqeqeq: 'error',
      'no-console': 'warn',
    },
  },
  {
    files: ['scripts/**', '*/*/scripts/**'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    extends: [reactHooks.configs.flat.recommended],
    plugins: { 'react-refresh': reactRefresh },
    rules: {
      'react-refresh/only-export-components': 'warn',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: '@bonvoyage/db', message: 'The web app must not import server packages.' },
            {
              name: '@bonvoyage/integrations',
              message: 'The web app must not import server packages.',
            },
            { name: '@bonvoyage/shared/node', message: 'Node-only entry point.' },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [{ group: ['node:*'], message: 'The engine must stay pure (no I/O).' }],
          paths: [
            { name: 'pg', message: 'The engine must stay pure (no I/O).' },
            { name: 'drizzle-orm', message: 'The engine must stay pure (no I/O).' },
            { name: '@bonvoyage/db', message: 'The engine must stay pure (no I/O).' },
            { name: '@bonvoyage/integrations', message: 'The engine must stay pure (no I/O).' },
          ],
        },
      ],
    },
  },
  prettier,
);
