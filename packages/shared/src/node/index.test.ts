import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadRootEnv } from './index';

describe('loadRootEnv', () => {
  let dir: string;
  const touched = ['BV_TEST_NEW', 'BV_TEST_EXISTING'];
  let savedNodeEnv: string | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'bv-env-'));
    writeFileSync(join(dir, 'pnpm-workspace.yaml'), 'packages: []\n');
    writeFileSync(join(dir, '.env'), 'BV_TEST_NEW=from-file\nBV_TEST_EXISTING=from-file\n');
    savedNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    process.env.BV_TEST_EXISTING = 'from-process';
    delete process.env.BV_TEST_NEW;
  });

  afterEach(() => {
    for (const key of touched) delete process.env[key];
    if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = savedNodeEnv;
    rmSync(dir, { recursive: true, force: true });
  });

  it('sets missing keys and never overwrites existing ones', () => {
    const nested = join(dir, 'a', 'b');
    mkdirSync(nested, { recursive: true });
    loadRootEnv(nested);
    expect(process.env.BV_TEST_NEW).toBe('from-file');
    expect(process.env.BV_TEST_EXISTING).toBe('from-process');
  });

  it('does nothing in production', () => {
    process.env.NODE_ENV = 'production';
    loadRootEnv(dir);
    expect(process.env.BV_TEST_NEW).toBeUndefined();
  });
});
