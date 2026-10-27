import { describe, expect, it } from 'vitest';
import { goldenInput } from './cost.test';
import { availableChoices, generatePackages } from './generate';

describe('generatePackages order', () => {
  it('builds Saver, Balanced, Quickest and Comfort in the 0005 b order', () => {
    const { packages, note } = generatePackages(goldenInput());
    expect(note).toBeNull();
    expect(packages.map((pkg) => `${pkg.label}/${pkg.transportMode}/${pkg.stayTier}`)).toEqual([
      'Saver/train/budget', // cheapest mode is train (400 < 550 < 2146)
      'Balanced/train/mid',
      'Quickest/car/mid', // quickest mode is car (270 < 300 < 390)
      'Comfort/car/premium',
    ]);
  });

  it('relabels Quickest to Comfort on premium when (mode, mid) is already built', () => {
    // Train is both cheapest and quickest: car is slower.
    const input = goldenInput();
    input.modes.car = { ...input.modes.car, durationMinutes: 500 };
    const { packages } = generatePackages(input);
    expect(packages.map((pkg) => `${pkg.label}/${pkg.transportMode}/${pkg.stayTier}`)).toEqual([
      'Saver/train/budget',
      'Balanced/train/mid',
      'Comfort/train/premium',
      'Comfort/car/premium',
    ]);
  });

  it('drops packages whose stay rate is missing', () => {
    const input = goldenInput({ stay: { budget: 900, mid: null, premium: 3000 } });
    const { packages, note } = generatePackages(input);
    // Balanced and Quickest need mid; only Saver and Comfort can be costed.
    expect(packages.map((pkg) => pkg.label)).toEqual(['Saver', 'Comfort']);
    expect(note).toBe('Only 2 packages could be costed for Rishikesh');
  });

  it('builds car packages only when no bus or train exists', () => {
    const input = goldenInput({ modes: { bus: null, train: null, car: goldenInput().modes.car } });
    const { packages, note } = generatePackages(input);
    expect(note).toBeNull();
    expect(packages.map((pkg) => `${pkg.label}/${pkg.transportMode}/${pkg.stayTier}`)).toEqual([
      'Saver/car/budget',
      'Balanced/car/mid',
      'Comfort/car/premium', // Quickest pair (car, mid) is built -> premium
    ]);
  });

  it('says when fewer than three packages can be costed', () => {
    const input = goldenInput({
      modes: { bus: null, train: null, car: goldenInput().modes.car },
      stay: { budget: 900, mid: null, premium: null },
    });
    const { packages, note } = generatePackages(input);
    expect(packages).toHaveLength(1);
    expect(note).toBe('Only 1 packages could be costed for Rishikesh');
  });
});

describe('availableChoices', () => {
  it('lists every costable (mode, tier) pair', () => {
    expect(availableChoices(goldenInput())).toEqual([
      { mode: 'train', tier: 'budget' },
      { mode: 'train', tier: 'mid' },
      { mode: 'train', tier: 'premium' },
      { mode: 'bus', tier: 'budget' },
      { mode: 'bus', tier: 'mid' },
      { mode: 'bus', tier: 'premium' },
      { mode: 'car', tier: 'budget' },
      { mode: 'car', tier: 'mid' },
      { mode: 'car', tier: 'premium' },
    ]);
  });

  it('omits unavailable modes and missing tiers', () => {
    const input = goldenInput({
      modes: { bus: null, train: goldenInput().modes.train, car: goldenInput().modes.car },
      stay: { budget: 900, mid: null, premium: 3000 },
    });
    expect(availableChoices(input)).toEqual([
      { mode: 'train', tier: 'budget' },
      { mode: 'train', tier: 'premium' },
      { mode: 'car', tier: 'budget' },
      { mode: 'car', tier: 'premium' },
    ]);
  });
});
