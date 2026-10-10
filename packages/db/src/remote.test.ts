import { describe, expect, it } from 'vitest';
import {
  assertDirectRemote,
  countPending,
  imageMajor,
  isRemoteTarget,
  pickRemoteUrl,
  serverMajor,
} from './remote';

const direct = 'postgres://u:p@ep-fake-123.ap-southeast-1.aws.neon.tech/db';
const pooled = 'postgres://u:p@ep-fake-123-pooler.ap-southeast-1.aws.neon.tech/db';

describe('pickRemoteUrl', () => {
  const file = { NEON_PREVIEW_DIRECT_URL: direct, NEON_PRODUCTION_DIRECT_URL: pooled };

  it('picks the variable for the target', () => {
    expect(pickRemoteUrl(file, 'preview')).toBe(direct);
    expect(pickRemoteUrl(file, 'production')).toBe(pooled);
  });

  it('names the missing variable without printing any value', () => {
    expect(() => pickRemoteUrl({}, 'preview')).toThrow('NEON_PREVIEW_DIRECT_URL is missing');
  });
});

describe('assertDirectRemote', () => {
  it('accepts a direct Neon host', () => {
    expect(() => assertDirectRemote(direct)).not.toThrow();
  });

  it('refuses a pooled host', () => {
    expect(() => assertDirectRemote(pooled)).toThrow('-pooler');
  });

  it.each(['localhost', '127.0.0.1', '[::1]'])('refuses the local host %s', (host) => {
    expect(() => assertDirectRemote(`postgres://u:p@${host}:5432/db`)).toThrow('local host');
  });

  it('refuses text that is not a URL', () => {
    expect(() => assertDirectRemote('not a url')).toThrow('not a valid URL');
  });
});

describe('versions and pending counts', () => {
  it('reads the image major from compose text', () => {
    expect(imageMajor('services:\n  db:\n    image: postgres:18-alpine\n')).toBe(18);
    expect(imageMajor('image: redis:7')).toBeNull();
  });

  it('reads the server major from server_version', () => {
    expect(serverMajor('18.1 (Debian)')).toBe(18);
    expect(serverMajor('')).toBeNull();
  });

  it('counts pending migrations and never goes negative', () => {
    expect(countPending(3, 1)).toBe(2);
    expect(countPending(0, 0)).toBe(0);
    expect(countPending(1, 2)).toBe(0);
  });

  it('recognises valid targets only', () => {
    expect(isRemoteTarget('preview')).toBe(true);
    expect(isRemoteTarget('staging')).toBe(false);
    expect(isRemoteTarget(undefined)).toBe(false);
  });
});
