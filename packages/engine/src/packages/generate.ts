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

// 0005 b / 0004: the lowest value wins; a tie keeps the earlier mode in
// MODE_TIE_ORDER (train, then bus, then car).
function bestMode(input: PackageInput, value: (mode: TransportMode) => number): TransportMode {
  const modes = availableModes(input);
  let best = modes[0] as TransportMode;
  let bestValue = value(best);
  for (const mode of modes.slice(1)) {
    const candidate = value(mode);
    if (candidate < bestValue) {
      best = mode;
      bestValue = candidate;
    }
  }
  return best;
}

function cheapestMode(input: PackageInput): TransportMode {
  return bestMode(input, (mode) => farePerPerson(input, mode) as number);
}

function quickestMode(input: PackageInput): TransportMode {
  return bestMode(input, (mode) => durationMinutes(input, mode) as number);
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

/**
 * 0005 b's spec loop, shared by generatePackages and costablePackageCount so the
 * two cannot drift (#123). `build` returns null for a spec that cannot be built.
 */
function buildSpecs<T>(input: PackageInput, build: (spec: PackageSpec) => T | null): T[] {
  const cheapest = cheapestMode(input);
  const quickest = quickestMode(input);
  const specs: PackageSpec[] = [
    { label: 'Saver', mode: cheapest, tier: 'budget' },
    { label: 'Balanced', mode: cheapest, tier: 'mid' },
    { label: 'Quickest', mode: quickest, tier: 'mid' },
    { label: 'Comfort', mode: 'car', tier: 'premium' },
  ];

  const built = new Set<string>();
  const labels = new Set<string>();
  const results: T[] = [];
  for (const spec of specs) {
    // 0005 b row 3: if the Quickest (mode, mid) pair is already built, use
    // premium and relabel it Comfort.
    const effective: PackageSpec =
      spec.label === 'Quickest' && built.has(`${spec.mode}/${spec.tier}`)
        ? { label: 'Comfort', mode: spec.mode, tier: 'premium' }
        : spec;
    const effectivePair = `${effective.mode}/${effective.tier}`;
    if (built.has(effectivePair)) continue;
    // 0005 b: labels are unique; when Quickest became Comfort, row 4 is
    // "Comfort by car".
    const labelled: PackageSpec =
      effective.label === 'Comfort' && labels.has('Comfort')
        ? { ...effective, label: 'Comfort by car' }
        : effective;
    const result = build(labelled);
    if (result === null) continue;
    built.add(effectivePair);
    labels.add(labelled.label);
    results.push(result);
  }
  return results;
}

/** 0005 b: the note when fewer than 3 packages can be built; the one source of its words. */
export function packagesNote(destinationName: string, count: number): string | null {
  return count < 3 ? `Only ${count} packages could be costed for ${destinationName}` : null;
}

/**
 * #123: how many packages generatePackages would build, decided from mode
 * availability and stay-rate presence only (costPackage returns null for no
 * other reason), so a read needs no costing and no day planning.
 */
export function costablePackageCount(input: PackageInput): number {
  return buildSpecs(input, (spec) =>
    modeAvailable(input, spec.mode) && input.stay[spec.tier] !== null ? spec : null,
  ).length;
}

export function generatePackages(input: PackageInput): {
  packages: PackageDraft[];
  note: string | null;
} {
  const packages = buildSpecs(input, (spec) => costPackage(input, spec));
  return { packages, note: packagesNote(input.destinationName, packages.length) };
}
