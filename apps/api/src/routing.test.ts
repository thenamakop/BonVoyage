import { createDb } from '@bonvoyage/db';
import * as integrations from '@bonvoyage/integrations/routing';
import { pino } from 'pino';
import { afterAll, afterEach, assert, describe, expect, it, vi } from 'vitest';
import { createApp } from './app';
import { createAuth } from './auth/auth';
import * as modules from './modules';

const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const logger = pino({ level: 'silent' });
const auth = createAuth({
  db,
  secret: 'test-secret-test-secret-test-secret',
  baseURL: { allowedHosts: ['localhost:5173', 'localhost:4000', '*.vercel.app'] },
});
const clock = () => new Date('2026-11-01T06:30:00Z');
afterEach(() => vi.restoreAllMocks());
afterAll(() => pool.end());

describe('application routing dependency', () => {
  it('builds one default routing instance and passes it to API dependencies without doing provider work', () => {
    const factory = vi.spyOn(integrations, 'createRouting');
    const router = vi.spyOn(modules, 'createApiRouter');
    const query = vi.spyOn(pool, 'query');
    createApp({ db, pool, logger, auth, clock });
    expect(factory).toHaveBeenCalledTimes(1);
    const options = factory.mock.calls[0]?.[0];
    assert(options);
    expect(options.providers.map(({ name, cacheable }) => ({ name, cacheable }))).toEqual([
      { name: 'curated', cacheable: false },
      { name: 'estimate', cacheable: false },
    ]);
    expect(options.ttlDays).toBe(30);
    expect(options.clock).toBe(clock);
    expect(router).toHaveBeenCalledTimes(1);
    expect(typeof router.mock.calls[0]?.[0].routing.getDistances).toBe('function');
    expect(query).not.toHaveBeenCalled();
  });

  it('uses an injected fake without constructing or invoking default routing', () => {
    const factory = vi.spyOn(integrations, 'createRouting');
    const router = vi.spyOn(modules, 'createApiRouter');
    const routing = {
      getDistances: vi.fn<integrations.Routing['getDistances']>(() => Promise.resolve(new Map())),
    };
    createApp({ db, pool, logger, auth, clock, routing });
    expect(factory).not.toHaveBeenCalled();
    expect(router.mock.calls[0]?.[0].routing).toBe(routing);
    expect(routing.getDistances).not.toHaveBeenCalled();
  });
});
