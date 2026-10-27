import type { StayTier, TransportMode } from '@bonvoyage/shared';
import {
  costPackage,
  farePerPerson,
  durationMinutes,
  modeAvailable,
  type PackageDraft,
  type PackageInput,
  type PackageSpec,
} from './cost';

// 0005 b: which packages to build, in order. Skips a (mode, tier) pair
// already built and a tier whose rate is missing.

const MODE_TIE_ORDER: TransportMode[] = ['train', 'bus', 'car'];
const TIER_ORDER: StayTier[] = ['budget', 'mid', 'premium'];

function availableModes(input: PackageInput): TransportMode[] {
  return MODE_TIE_ORDER.filter((mode) => modeAvailable(input, mode));
}

function cheapestMode(input: PackageInput): TransportMode {
  // Car is always available (0005 b), so there is a real starting value.
  let best: TransportMode = 'car';
  let bestFare = farePerPerson(input, 'car') as number;
  for (const mode of availableModes(input)) {
    const fare = farePerPerson(input, mode) as number;
    if (fare < bestFare) {
      best = mode;
      bestFare = fare;
    }
  }
  return best;
}

function quickestMode(input: PackageInput): TransportMode {
  let best: TransportMode = 'car';
  let bestMinutes = durationMinutes(input, 'car') as number;
  for (const mode of availableModes(input)) {
    const minutes = durationMinutes(input, mode) as number;
    if (minutes < bestMinutes) {
      best = mode;
      bestMinutes = minutes;
    }
  }
  return best;
}

// The (mode, tier) pairs that can be costed: an available mode (0005 b) and a
// stay rate that exists. For S3-3's Change action.
export function availableChoices(input: PackageInput): { mode: TransportMode; tier: StayTier }[] {
  const choices: { mode: TransportMode; tier: StayTier }[] = [];
  for (const mode of MODE_TIE_ORDER) {
    if (!modeAvailable(input, mode)) continue;
    for (const tier of TIER_ORDER) {
      if (input.stay[tier] !== null) choices.push({ mode, tier });
    }
  }
  return choices;
}

export function generatePackages(input: PackageInput): {
  packages: PackageDraft[];
  note: string | null;
} {
  const cheapest = cheapestMode(input);
  const quickest = quickestMode(input);
  const specs: PackageSpec[] = [
    { label: 'Saver', mode: cheapest, tier: 'budget' },
    { label: 'Balanced', mode: cheapest, tier: 'mid' },
    { label: 'Quickest', mode: quickest, tier: 'mid' },
    { label: 'Comfort', mode: 'car', tier: 'premium' },
  ];

  const built = new Set<string>();
  const packages: PackageDraft[] = [];
  for (const spec of specs) {
    // 0005 b row 3: if the Quickest (mode, mid) pair is already built, use
    // premium and relabel it Comfort.
    const effective: PackageSpec =
      spec.label === 'Quickest' && built.has(`${spec.mode}/${spec.tier}`)
        ? { label: 'Comfort', mode: spec.mode, tier: 'premium' }
        : spec;
    const effectivePair = `${effective.mode}/${effective.tier}`;
    if (built.has(effectivePair)) continue;
    const draft = costPackage(input, effective);
    if (draft === null) continue;
    built.add(effectivePair);
    packages.push(draft);
  }

  const note =
    packages.length < 3
      ? `Only ${packages.length} packages could be costed for ${input.destinationName}`
      : null;
  return { packages, note };
}
