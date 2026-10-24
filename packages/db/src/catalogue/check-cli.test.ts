import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { load } = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('./load', () => ({ loadCatalogue: load }));
const originalArgv = process.argv;
let lines: string[];
let errorLines: string[];

function catalogue(status: 'draft' | 'verified' = 'draft') {
  return {
    hubs: [{ slug: 'gurugram', review_status: status }],
    destinations: [
      {
        slug: 'mussoorie',
        types: ['hill_station'],
        review_status: status,
        cost_review_status: status,
      },
    ],
    fares: ['car', 'bus', 'train'].map((mode) => ({
      origin_hub: 'gurugram',
      destination_slug: 'mussoorie',
      mode,
      review_status: status,
    })),
    pois: [{ destination_slug: 'mussoorie', poi_key: 'view', review_status: status }],
    costRules: { fuel: { review_status: status } },
    issues: [],
  };
}

beforeEach(() => {
  vi.resetModules();
  load.mockReset().mockReturnValue(catalogue());
  lines = [];
  errorLines = [];
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    lines.push(args.join(' '));
  });
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    errorLines.push(args.join(' '));
  });
  vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`exit ${String(code)}`);
  });
});

afterEach(() => {
  process.argv = originalArgv;
  vi.restoreAllMocks();
});

async function check(stage?: string, exit = 1) {
  process.argv = [process.execPath, 'catalogue-check', ...(stage ? ['--require', stage] : [])];
  await expect(import('../../scripts/catalogue-check')).rejects.toThrow(`exit ${exit}`);
  return lines.join('\n');
}

it('reports four split stages and the amended deadlines', async () => {
  const output = await check(undefined, 0);
  expect(output).toMatch(/Stage A .*0\/2 verified.*2026-10-26/);
  expect(output).toMatch(/Stage B1 .*0\/3 verified.*2026-11-01/);
  expect(output).toMatch(/Stage B2 .*0\/2 verified.*2026-11-05/);
  expect(output).toMatch(/Stage C .*0\/1 verified.*2026-11-01/);
});

it.each([
  ['a', 2, false, false, false],
  ['b1', 5, true, false, false],
  ['b2', 7, true, true, false],
  ['b', 7, true, true, false],
  ['c', 8, true, true, true],
] as const)('requires %s and every earlier stage', async (stage, errors, b1, b2, c) => {
  const output = await check(stage);
  expect(output).toContain(`${errors} error(s)`);
  expect(output).toContain('hub "gurugram" is still draft');
  expect(output.includes('destination "mussoorie" costs is still draft')).toBe(b1);
  expect(output.includes('(car) is still draft')).toBe(b1);
  expect(output.includes('cost rule "fuel" is still draft')).toBe(b1);
  expect(output.includes('(bus) is still draft')).toBe(b2);
  expect(output.includes('(train) is still draft')).toBe(b2);
  expect(output.includes('POI "mussoorie/view" is still draft')).toBe(c);
});

it.each(['b1', 'b2', 'b', 'c'])('passes %s with verified fixture rows', async (stage) => {
  load.mockReturnValue(catalogue('verified'));
  const output = await check(stage, 0);
  expect(output).toContain('0 error(s)');
});

it('rejects an unknown stage with usage and exit 2', async () => {
  await check('unknown', 2);
  expect(errorLines).toEqual([expect.stringContaining('a|b1|b2|b|c')]);
  expect(load).not.toHaveBeenCalled();
});
