import { describe, expect, it } from 'vitest';
import { safeNext } from './safe-next';

describe('safeNext', () => {
  it('keeps a normal in-app path', () => {
    expect(safeNext('/trips/abc')).toBe('/trips/abc');
    expect(safeNext('/trips?tab=mine')).toBe('/trips?tab=mine');
  });

  it('rejects protocol-relative and backslash paths', () => {
    expect(safeNext('//evil.com')).toBe('/trips');
    expect(safeNext('/\\evil.com')).toBe('/trips');
  });

  it('rejects absolute URLs and schemes', () => {
    expect(safeNext('https://evil.com')).toBe('/trips');
    expect(safeNext('javascript:alert(1)')).toBe('/trips');
  });

  it('rejects empty, missing and non-slash values', () => {
    expect(safeNext('')).toBe('/trips');
    expect(safeNext(null)).toBe('/trips');
    expect(safeNext(undefined)).toBe('/trips');
    expect(safeNext('trips')).toBe('/trips');
  });
});
