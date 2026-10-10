import { afterAll, describe, expect, it } from 'vitest';
import { createDb, probeDb } from '../src/client';

const url = process.env.DATABASE_URL ?? '';

describe('probeDb', () => {
  const live = createDb(url);
  const dead = createDb('postgres://bonvoyage:bonvoyage@127.0.0.1:1/x');

  afterAll(async () => {
    await live.pool.end();
    await dead.pool.end();
  });

  it('resolves true on the test database', async () => {
    expect(await probeDb(live.pool)).toBe(true);
  });

  it('does not crash when an idle client errors', () => {
    expect(() => dead.pool.emit('error', new Error('connection terminated'))).not.toThrow();
  });

  it('resolves false within 3 seconds when nothing listens', async () => {
    const started = Date.now();
    expect(await probeDb(dead.pool)).toBe(false);
    expect(Date.now() - started).toBeLessThan(3_000);
  });
});
