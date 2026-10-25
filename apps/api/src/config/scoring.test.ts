import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseScoringWeights, SCORING_WEIGHTS } from './scoring';

// S2-6 step 1 (0004 h): the weights file is validated at start-up and a bad
// file fails fast with a message that names the file and the problem.

describe('parseScoringWeights', () => {
  it('loads the shipped apps/api/config/scoring.json unchanged', () => {
    const file: unknown = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../../config/scoring.json'), 'utf8'),
    );
    expect(SCORING_WEIGHTS).toEqual(file);
    expect(parseScoringWeights(file)).toEqual(file);
  });

  it('accepts zero weights', () => {
    expect(parseScoringWeights({ alpha: 1, beta: 0, gamma: 0 })).toEqual({
      alpha: 1,
      beta: 0,
      gamma: 0,
    });
  });

  it.each([
    ['a negative weight', { alpha: 0.5, beta: -0.1, gamma: 0.2 }, 'beta'],
    ['a missing weight', { alpha: 0.5, beta: 0.3 }, 'gamma'],
    ['a weight given as text', { alpha: '0.5', beta: 0.3, gamma: 0.2 }, 'alpha'],
    ['an unknown key', { alpha: 0.5, beta: 0.3, gamma: 0.2, delta: 1 }, 'delta'],
    ['a non-finite weight', { alpha: Infinity, beta: 0.3, gamma: 0.2 }, 'alpha'],
  ])('refuses %s with a clear message', (_label, value, field) => {
    expect(() => parseScoringWeights(value)).toThrow(/scoring\.json is invalid/);
    expect(() => parseScoringWeights(value)).toThrow(new RegExp(field));
  });

  it('refuses something that is not an object', () => {
    expect(() => parseScoringWeights(null)).toThrow(/Expected \{ "alpha": number >= 0/);
    expect(() => parseScoringWeights([0.5, 0.3, 0.2])).toThrow(/scoring\.json is invalid/);
  });
});
