import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

const base = { DATABASE_URL: 'postgres://u:p@localhost:5433/db_test' };

describe('parseEnv APP_URL', () => {
  it('defaults to the local web address', () => {
    expect(parseEnv(base).APP_URL).toBe('http://localhost:5173');
  });

  it('defaults to https://VERCEL_URL when APP_URL is unset', () => {
    const env = parseEnv({
      ...base,
      VERCEL_URL: 'bonvoyage-abc.vercel.app',
      VERCEL_ENV: 'preview',
    });
    expect(env.APP_URL).toBe('https://bonvoyage-abc.vercel.app');
    expect(env.VERCEL_ENV).toBe('preview');
  });

  it('keeps an explicit APP_URL even when VERCEL_URL is set', () => {
    const env = parseEnv({
      ...base,
      APP_URL: 'https://bonvoyage.example.com',
      VERCEL_URL: 'bonvoyage-abc.vercel.app',
    });
    expect(env.APP_URL).toBe('https://bonvoyage.example.com');
  });
});
