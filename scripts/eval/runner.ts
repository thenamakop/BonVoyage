import {
  buildDiagnostic,
  buildFactSheet,
  durationMinutes,
  evaluateCandidate,
  fairnessWeights,
  farePerPerson,
  feasibilityContext,
  generatePackages,
  groupProfile,
  memberDeficits,
  planDays,
  rankDestinations,
  SHORTLIST_SIZE,
  toPackageInput,
  validateItinerary,
  type CandidateFacts,
  type FairnessRound,
  type RankedDestination,
  type Weights,
} from '@bonvoyage/engine';
import { ItineraryOutput } from '@bonvoyage/shared';
import { readFileSync } from 'node:fs';
import { generateScenario, type Scenario } from './generator';
import { readCatalogue, scenarioFacts, type EvaluationCatalogue } from './catalogue';

export const METHODS = ['gfs', 'average', 'least-misery'] as const;
export type Method = (typeof METHODS)[number];
export interface Check {
  passed: number;
  total: number;
}
export interface FairnessResult {
  lambda: number;
  spread: number;
  repeatLeast: boolean;
}
export interface ScenarioResult {
  scenario: Scenario;
  feasibleCount: number;
  binding: string | null;
  checks: {
    constraints: Check;
    packages: Check;
    affordability: Check;
    plans: Check;
    budgetRerun: Check;
  };
  choices: Partial<Record<Method, RankedDestination>>;
  fairness: FairnessResult[];
  defects: string[];
}
export interface EvaluationRun {
  seed: number;
  results: ScenarioResult[];
  weights: Weights;
  lambda: number;
}

export function independentConstraints(facts: CandidateFacts, scenario: Scenario): boolean {
  const { destination: d, costRules: r } = facts;
  const n = scenario.members.length;
  const first = scenario.members[0];
  if (!first) return false;
  const start = scenario.members.reduce(
    (s, m) => (m.dateStart > s ? m.dateStart : s),
    first.dateStart,
  );
  const end = scenario.members.reduce((s, m) => (m.dateEnd < s ? m.dateEnd : s), first.dateEnd);
  const days = (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
  const months = new Set<number>();
  for (let date = Date.parse(start); date <= Date.parse(end); date += 86400000)
    months.add(new Date(date).getUTCMonth() + 1);
  const car =
    (Math.ceil(n / r.personsPerCar) *
      (facts.distanceKm * (r.fuelPriceInrPerLitre / r.carKmPerLitre + r.tollInrPerKm) +
        (r.carRentalInrPerDay * (scenario.durationNights + 1)) / 2)) /
    n;
  const fare = Math.min(car, facts.fares.busInr ?? Infinity, facts.fares.trainInr ?? Infinity);
  const cost = Math.ceil(
    n * 2 * fare +
      Math.ceil(n / 2) * scenario.durationNights * d.stayBudgetInr +
      n * (scenario.durationNights + 1) * (d.foodPerDayInr + d.localPerDayInr),
  );
  const cap = Math.min(
    scenario.budgetTotalInr,
    n * Math.min(...scenario.members.map((m) => m.budgetMaxInr)),
  );
  return (
    facts.distanceKm <= scenario.radiusKm &&
    scenario.durationNights >= d.minNights &&
    days >= scenario.durationNights + 1 &&
    d.bestMonths.some((m) => months.has(m)) &&
    cost <= cap
  );
}

export function fairnessRounds(
  scenario: Scenario,
  destinations: CandidateFacts['destination'][],
  weights: Weights,
  lambda: number,
): FairnessResult {
  const ids = scenario.members.map((m) => m.memberId);
  const history: FairnessRound[] = [];
  const sums = new Map(ids.map((id) => [id, 0]));
  const least = new Map(ids.map((id) => [id, 0]));
  let remaining = [...destinations];
  for (let round = 0; round < 3; round++) {
    const memberWeights = fairnessWeights(memberDeficits(history, ids), lambda);
    const top = rankDestinations(scenario.members, remaining, weights, memberWeights)[0];
    if (!top) throw new Error('Three-round cohort requires at least three feasible destinations.');
    history.push({
      topChoiceScores: Object.fromEntries(top.memberScores.map((m) => [m.memberId, m.score])),
    });
    for (const { memberId, score } of top.memberScores) {
      sums.set(memberId, (sums.get(memberId) ?? 0) + score);
      if (Math.abs(score - top.min) < 1e-12) least.set(memberId, (least.get(memberId) ?? 0) + 1);
    }
    remaining = remaining.filter((d) => d.id !== top.destinationId);
  }
  const cumulative = [...sums.values()];
  return {
    lambda,
    spread: Math.max(...cumulative) - Math.min(...cumulative),
    repeatLeast: [...least.values()].some((count) => count >= 2),
  };
}

export function evaluateScenario(
  data: EvaluationCatalogue,
  scenario: Scenario,
  weights: Weights,
  lambdas: number[],
): ScenarioResult {
  const profile = groupProfile(scenario.members, scenario);
  const ctx = feasibilityContext(scenario, profile);
  if (!ctx) throw new Error('Generator produced a blocking availability conflict.');
  const candidates = scenarioFacts(data, scenario);
  const evaluations = candidates.map(({ facts }) => evaluateCandidate(facts, ctx));
  const feasible = candidates.filter((_, i) => evaluations[i]?.feasible);
  const diagnostic = buildDiagnostic({ evaluations, ctx, profile, incomplete: data.incomplete });
  const shortlisted = feasible.length >= SHORTLIST_SIZE;
  const result: ScenarioResult = {
    scenario,
    feasibleCount: feasible.length,
    binding: shortlisted ? null : diagnostic.bindingConstraint,
    checks: {
      constraints: { passed: 0, total: 0 },
      packages: { passed: 0, total: 0 },
      affordability: { passed: 0, total: 0 },
      plans: { passed: 0, total: 0 },
      budgetRerun: { passed: 0, total: 0 },
    },
    choices: {},
    fairness: [],
    defects: [],
  };
  const check = (name: keyof ScenarioResult['checks'], ok: boolean, detail: string) => {
    result.checks[name].total++;
    if (ok) result.checks[name].passed++;
    else result.defects.push(`${name}: ${detail}`);
  };
  if (shortlisted) {
    for (const { facts } of feasible)
      check('constraints', independentConstraints(facts, scenario), facts.destination.slug);
    const methodWeights: Record<Method, Weights> = {
      gfs: weights,
      average: { alpha: 1, beta: 0, gamma: 0 },
      'least-misery': { alpha: 0, beta: 1, gamma: 0 },
    };
    const destinations = feasible.map((c) => c.facts.destination);
    for (const method of METHODS)
      result.choices[method] = rankDestinations(
        scenario.members,
        destinations,
        methodWeights[method],
      )[0];
    if (scenario.members.length >= 3)
      result.fairness = lambdas.map((lambda) =>
        fairnessRounds(scenario, destinations, weights, lambda),
      );
    const chosen = feasible.find((c) => c.row.id === result.choices.gfs?.destinationId);
    if (!chosen) throw new Error('GFS top choice is missing.');
    const input = toPackageInput(chosen.source);
    const packages = generatePackages(input).packages;
    if (!packages.length) check('packages', false, `${chosen.row.slug}: no packages`);
    for (const pkg of packages) {
      const total = pkg.lines.reduce((sum, line) => sum + line.amountInr, 0);
      const cap = Math.min(
        scenario.budgetTotalInr,
        scenario.members.length * Math.min(...scenario.members.map((m) => m.budgetMaxInr)),
      );
      check(
        'packages',
        pkg.totalInr === total &&
          pkg.overBudget === total > cap &&
          pkg.overByInr === Math.max(0, total - cap) &&
          pkg.perPersonInr === Math.ceil(total / input.n),
        `${chosen.row.slug}/${pkg.label}: total=${total}, cap=${cap}, overBudget=${pkg.overBudget}`,
      );
      if (!pkg.overBudget)
        check(
          'affordability',
          total <= cap,
          `${chosen.row.slug}/${pkg.label}: declared affordable, total=${total}, cap=${cap}`,
        );
      const minutes = durationMinutes(input, pkg.transportMode) ?? 0;
      const fare = farePerPerson(input, pkg.transportMode) ?? 0;
      const planInput = {
        startDate: input.startDate,
        nights: input.nights,
        onward: { mode: pkg.transportMode, durationMinutes: minutes },
        ret: { mode: pkg.transportMode, durationMinutes: minutes },
        stayTier: pkg.stayTier,
        places: input.places,
        groupInterests: input.groupInterests,
      };
      const plan = planDays(planInput);
      const facts = buildFactSheet({
        plan,
        input: planInput,
        originName: input.originName,
        destination: chosen.row,
        groupSize: input.n,
        rooms: pkg.rooms,
        perRoomPerNightInr: input.stay[pkg.stayTier] ?? 0,
        farePerPersonInr: { onward: fare, return: fare },
        costs: { totalInr: pkg.totalInr, perPersonInr: pkg.perPersonInr, items: pkg.lines },
      });
      const output = ItineraryOutput.parse({
        days: plan.days.map((day) => ({
          ...day,
          items: day.items.map(({ placeKey, ...item }) => ({
            ...item,
            ...(placeKey ? { poiId: placeKey } : {}),
          })),
        })),
        summary: 'Catalogue day plan.',
        reasons: ['Built from catalogue facts.'],
      });
      const verdict = validateItinerary(output, facts);
      check(
        'plans',
        verdict.ok,
        `${chosen.row.slug}/${pkg.label}: ${verdict.errors.map((e) => e.code).join(',')}`,
      );
    }
  } else if (diagnostic.bindingConstraint === 'F5') {
    const suggestion = diagnostic.suggestions.find((s) => s.constraint === 'F5');
    if (suggestion?.constraint === 'F5') {
      const revised = {
        ...scenario,
        budgetTotalInr:
          suggestion.capSource === 'trip' ? suggestion.newGroupCapInr : scenario.budgetTotalInr,
        members: scenario.members.map((m) => ({
          ...m,
          budgetMaxInr:
            suggestion.capSource === 'members'
              ? Math.max(m.budgetMaxInr, suggestion.newPerPersonMaxInr ?? m.budgetMaxInr)
              : m.budgetMaxInr,
        })),
      };
      const revisedCtx = feasibilityContext(revised, groupProfile(revised.members, revised));
      const count = revisedCtx
        ? candidates.filter((c) => evaluateCandidate(c.facts, revisedCtx).feasible).length
        : 0;
      check(
        'budgetRerun',
        count >= SHORTLIST_SIZE,
        `suggested=${suggestion.newGroupCapInr}, feasible=${count}`,
      );
    }
  }
  return result;
}

export function runEvaluation(count: number, seed: number, today: string): EvaluationRun {
  const config: unknown = JSON.parse(
    readFileSync(new URL('../../apps/api/config/scoring.json', import.meta.url), 'utf8'),
  );
  if (typeof config !== 'object' || config === null)
    throw new Error('Invalid scoring configuration.');
  const { alpha, beta, gamma, lambda } = config as Record<string, unknown>;
  if (
    ![alpha, beta, gamma, lambda].every(
      (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0,
    )
  )
    throw new Error('Invalid scoring weights.');
  const weights = { alpha: Number(alpha), beta: Number(beta), gamma: Number(gamma) };
  const data = readCatalogue(today);
  const lambdas = [...new Set([0, 0.5, Number(lambda), 1, 2])].sort((a, b) => a - b);
  return {
    seed,
    weights,
    lambda: Number(lambda),
    results: Array.from({ length: count }, (_, index) =>
      evaluateScenario(data, generateScenario(data.catalogue, seed, index), weights, lambdas),
    ),
  };
}
