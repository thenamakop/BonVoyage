import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FAIRNESS_LAMBDA, parseScoringConfig, SCORING_WEIGHTS } from './scoring';

// S2-6 step 1 (0004 h): the weights file is validated at start-up and a bad
// file fails fast with a message that names the file and the problem. S5-2b-2
// adds lambda (R17), 0 to 5.

describe('parseScoringConfig', () => {
  it('loads the shipped apps/api/config/scoring.json unchanged', () => {
    const file = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../../config/scoring.json'), 'utf8'),
    ) as Record<string, unknown>;
    const { lambda, ...weights } = file;
    expect(SCORING_WEIGHTS).toEqual(weights);
    expect(FAIRNESS_LAMBDA).toBe(lambda);
    expect(FAIRNESS_LAMBDA).toBe(1);
    expect(parseScoringConfig(file)).toEqual({ weights, lambda });
  });

  it('accepts zero weights and both ends of the lambda range', () => {
    expect(parseScoringConfig({ alpha: 1, beta: 0, gamma: 0, lambda: 0 })).toEqual({
      weights: { alpha: 1, beta: 0, gamma: 0 },
      lambda: 0,
    });
    expect(parseScoringConfig({ alpha: 1, beta: 0, gamma: 0, lambda: 5 }).lambda).toBe(5);
  });

  it.each([
    ['a negative weight', { alpha: 0.5, beta: -0.1, gamma: 0.2, lambda: 1 }, 'beta'],
    ['a missing weight', { alpha: 0.5, beta: 0.3, lambda: 1 }, 'gamma'],
    ['a weight given as text', { alpha: '0.5', beta: 0.3, gamma: 0.2, lambda: 1 }, 'alpha'],
    ['an unknown key', { alpha: 0.5, beta: 0.3, gamma: 0.2, lambda: 1, delta: 1 }, 'delta'],
    ['a non-finite weight', { alpha: Infinity, beta: 0.3, gamma: 0.2, lambda: 1 }, 'alpha'],
    ['a missing lambda', { alpha: 0.5, beta: 0.3, gamma: 0.2 }, 'lambda'],
    ['a negative lambda', { alpha: 0.5, beta: 0.3, gamma: 0.2, lambda: -0.5 }, 'lambda'],
    ['a lambda above 5', { alpha: 0.5, beta: 0.3, gamma: 0.2, lambda: 5.5 }, 'lambda'],
  ])('refuses %s with a clear message', (_label, value, field) => {
    expect(() => parseScoringConfig(value)).toThrow(/scoring\.json is invalid/);
    expect(() => parseScoringConfig(value)).toThrow(new RegExp(field));
  });

  it('refuses something that is not an object', () => {
    expect(() => parseScoringConfig(null)).toThrow(/Expected \{ "alpha": number >= 0/);
    expect(() => parseScoringConfig([0.5, 0.3, 0.2])).toThrow(/scoring\.json is invalid/);
  });
});
