import {
  ACTIVITY_LABELS,
  DESTINATION_TYPE_LABELS,
  TRANSPORT_MODE_LABELS,
  type DiagnosticEvaluation,
  type DiagnosticFailure,
  type GroupConflict,
  type GroupProfileReady,
  type MyMatch,
  type Provenance,
  type RecommendationItem,
  type RecommendationRun,
  type Suggestion,
  type TransportMode,
  type UpdateTripInput,
} from '@bonvoyage/shared';
import { formatInr } from '../../lib/format';

// S2-7: every sentence of the group profile, shortlist and diagnostic screens,
// kept pure so it can be unit-tested. The browser only words what the API
// sends; it never computes a score, a cost or a cap (S2-7 IF BLOCKED).

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "a", "a and b", "a, b and c". */
export function listWords(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

const lower = (label: string) => label.toLowerCase();
const typeWord = (v: keyof typeof DESTINATION_TYPE_LABELS) => lower(DESTINATION_TYPE_LABELS[v]);
const activityWord = (v: keyof typeof ACTIVITY_LABELS) => lower(ACTIVITY_LABELS[v]);
const modeWord = (v: TransportMode) => lower(TRANSPORT_MODE_LABELS[v]);
// In a comma list, "yoga and wellness" would read as two items; quote multi-word labels.
const item = (word: string) => (word.includes(' ') ? `‘${word}’` : word);
const typeItem = (v: keyof typeof DESTINATION_TYPE_LABELS) => item(typeWord(v));
const activityItem = (v: keyof typeof ACTIVITY_LABELS) => item(activityWord(v));

// ---------------------------------------------------------------------------
// Group profile

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parts(iso: string) {
  const [y = '', m = '', d = ''] = iso.split('-');
  return { year: y, month: MONTHS[Number(m) - 1] ?? m, day: String(Number(d)) };
}

/** "13 to 15 Nov", "30 Nov to 2 Dec", "30 Dec 2026 to 2 Jan 2027". */
export function dateRange(start: string, end: string): string {
  const s = parts(start);
  const e = parts(end);
  if (s.year !== e.year) {
    return `${s.day} ${s.month} ${s.year} to ${e.day} ${e.month} ${e.year}`;
  }
  if (s.month === e.month) return `${s.day} to ${e.day} ${e.month}`;
  return `${s.day} ${s.month} to ${e.day} ${e.month}`;
}

/** "13 to 15 Nov, 3 days". */
export function windowLine(window: { start: string; end: string; days: number }): string {
  return `${dateRange(window.start, window.end)}, ${plural(window.days, 'day')}`;
}

/** The F3 words, from the run's or the profile's conflicts (amendment 5); null when dates fit. */
export function dateConflictText(
  conflicts: readonly GroupConflict[],
  commonWindow: GroupProfileReady['commonWindow'],
  durationNights: number,
): string | null {
  if (conflicts.some((c) => c.code === 'NO_COMMON_WINDOW')) {
    return 'The dates members gave do not overlap.';
  }
  if (conflicts.some((c) => c.code === 'WINDOW_TOO_SHORT')) {
    const days = commonWindow?.days ?? 0;
    return `The dates members gave overlap for ${plural(days, 'day')}; this trip needs ${durationNights + 1}.`;
  }
  return null;
}

/**
 * "₹12,000 to ₹16,000 per person", or the disjoint-band warning. Figures arrive
 * rounded; below 3 contributors they do not arrive at all (D1, #116), and only
 * whether the budgets overlap is said.
 */
export function budgetBandText(profile: GroupProfileReady): string {
  const { budgetBand, perPersonCapInr } = profile;
  const { minInr, maxInr, overlaps } = budgetBand;
  if (!overlaps) {
    return perPersonCapInr === null
      ? 'Budgets do not overlap'
      : `Budgets do not overlap; plans use the lowest maximum, ${formatInr(perPersonCapInr)} per person.`;
  }
  if (minInr === null || maxInr === null) return 'Budgets overlap';
  return `${formatInr(minInr)} to ${formatInr(maxInr)} per person`;
}

export const ROUNDED_NOTE = 'Rounded to ₹500 so nobody’s exact limit shows.';
export const BUDGET_HIDDEN_NOTE = 'Budget figures appear once 3 or more people have answered.';

/** "Mountain: 3 of 3" (counts of 2 or more only; the API never sends fewer). */
export function voteText(label: string, count: number, memberCount: number): string {
  return `${label}: ${count} of ${memberCount}`;
}

/** "and 2 more interests", or null when every interest is shared. */
export function moreInterestsText(otherInterestCount: number): string | null {
  if (otherInterestCount <= 0) return null;
  return `and ${otherInterestCount} more ${otherInterestCount === 1 ? 'interest' : 'interests'}`;
}

// ---------------------------------------------------------------------------
// Shortlist cards

const DISTANCE_WORDS: Record<Provenance, string> = {
  estimated: 'estimated road distance',
  curated: 'curated road distance',
  live: 'road distance',
  cached: 'road distance, saved earlier',
};

/** "250 km, estimated road distance" (amendment 2). */
export function distanceText(km: number, provenance: Provenance): string {
  return `${km} km, ${DISTANCE_WORDS[provenance]}`;
}

/** "₹27,000 for the group, about ₹9,000 each, estimate, cheapest by train" (SRS 3.1.1). */
export function costText(
  item: Pick<RecommendationItem, 'estimatedCostInr' | 'perPersonInr' | 'cheapestMode'>,
): string {
  return `${formatInr(item.estimatedCostInr)} for the group, about ${formatInr(item.perPersonInr)} each, estimate, cheapest by ${modeWord(item.cheapestMode)}`;
}

const scoreWord = (n: number) => String(n);

/** The group sentence, or null below 3 members, when the API sends no range (amendment 1). */
export function groupScoreText(group: RecommendationItem['group']): string | null {
  const { lowestScore10: low, highestScore10: high } = group;
  if (low === null || high === null) return null;
  if (low >= 5) return `Everyone rates this at least ${scoreWord(low)} out of 10`;
  return `Opinions differ: from ${scoreWord(low)} to ${scoreWord(high)} out of 10`;
}

export function climateText(group: RecommendationItem['group']): string {
  return `Climate suits ${group.climateMetCount} of ${group.memberCount}`;
}

/** "Shared: rafting (2), temples (2)" from values 2 or more members want. */
export function sharedText(group: RecommendationItem['group']): string {
  const values = [
    ...group.sharedTypes.map((v) => `${typeItem(v.value)} (${v.count})`),
    ...group.sharedActivities.map((v) => `${activityItem(v.value)} (${v.count})`),
  ];
  return values.length > 0
    ? `Shared: ${values.join(', ')}`
    : 'Shared: nothing that 2 or more members asked for';
}

/** "For you: 7.5 out of 10. Matches mountain, trekking. Misses rafting." */
export function forYouText(mine: MyMatch): string {
  const met = [...mine.metTypes.map(typeItem), ...mine.metActivities.map(activityItem)];
  const missed = [...mine.missedTypes.map(typeItem), ...mine.missedActivities.map(activityItem)];
  const sentences = [`For you: ${scoreWord(mine.score10)} out of 10.`];
  sentences.push(met.length > 0 ? `Matches ${met.join(', ')}.` : 'Matches none of your picks.');
  if (missed.length > 0) sentences.push(`Misses ${missed.join(', ')}.`);
  return sentences.join(' ');
}

export function chooseConfirmText(name: string): string {
  return `Choose ${name}? The group moves on to packages.`;
}

// T21 (S5-2b-1): the organiser's "Ask again" confirm.
export const ASK_AGAIN_CONFIRM =
  'Ask again? Members can change their answers, and you can ask for new recommendations.';

/** After T21 the page still shows the previous run until the next request (S5-2b-2). */
export function earlierShortlistText(organiserName: string): string {
  return `Earlier shortlist. ${organiserName} asked for new recommendations; this list is kept for reference.`;
}

// R7 with R17: no names and no numbers, only that the order leans this way.
export const FAIRNESS_NOTE =
  'This round gives more weight to members whose wishes were met less in earlier rounds.';

// ---------------------------------------------------------------------------
// Diagnostic

/** "Only 1 destination fits", "Only 2 destinations fit", "No destination fits". */
export function fitHeading(feasibleCount: number): string {
  if (feasibleCount === 0) return 'No destination fits';
  if (feasibleCount === 1) return 'Only 1 destination fits';
  return `Only ${feasibleCount} destinations fit`;
}

const BINDING_WORDS = {
  F1: 'Most places are just beyond your search radius.',
  F2: 'Most places need more nights than this trip has.',
  F4: 'Most places are out of season on your dates.',
  F5: 'Most places cost more than the group can spend.',
} as const;

/** The binding constraint in words; null binding means near misses fail 2 or more limits. */
export function bindingText(
  run: Pick<RecommendationRun, 'bindingConstraint' | 'groupProfile'>,
  durationNights: number,
): string {
  const binding = run.bindingConstraint;
  if (binding === null) return 'Most places miss more than one limit.';
  if (binding === 'F3') {
    return (
      dateConflictText(run.groupProfile.conflicts, run.groupProfile.commonWindow, durationNights) ??
      'The dates members gave do not overlap enough for this trip.'
    );
  }
  return BINDING_WORDS[binding];
}

/** What the first failed limit asks for (amendment 7). */
export function failureText(failure: DiagnosticFailure): string {
  switch (failure.id) {
    case 'F1':
      return `${failure.relaxation} km beyond the radius`;
    case 'F2':
      return `needs ${plural(failure.limit, 'night')}`;
    case 'F4':
      return `out of season by ${plural(failure.actual, 'month')}`;
    case 'F5':
      // D1, #116: no amount below 3 contributors when members set the cap.
      return failure.relaxation === null
        ? 'over the group budget'
        : `about ${formatInr(failure.relaxation)} over the group budget`;
  }
}

/** "Mussoorie: 40 km beyond the radius". */
export function alternativeText(evaluation: DiagnosticEvaluation): string {
  const first = evaluation.failures[0];
  return first ? `${evaluation.name}: ${failureText(first)}` : evaluation.name;
}

/** The suggestion itself: a button label for the organiser, or text for everyone. */
export function suggestionText(s: Suggestion): string {
  switch (s.constraint) {
    case 'F1':
      return `Widen the radius to ${s.newRadiusKm} km`;
    case 'F2':
      return `Make the trip ${plural(s.newNights, 'night')}`;
    case 'F4':
      return `Shift the dates by ${plural(s.shiftMonths, 'month')}`;
    case 'F5':
      if (s.capSource === 'trip') return `Raise the group budget to ${formatInr(s.newGroupCapInr)}`;
      return s.newPerPersonMaxInr === undefined
        ? 'Members need to raise their maximum budgets'
        : `Members need to raise their maximum to ${formatInr(s.newPerPersonMaxInr)} per person`;
  }
}

/** "adds Alwar and Vrindavan", using the names the run sent (amendment 8). */
export function unlocksText(
  unlocks: readonly string[],
  nearMisses: readonly DiagnosticEvaluation[],
): string | null {
  if (unlocks.length === 0) return null;
  const names = new Map(nearMisses.map((e) => [e.slug, e.name]));
  return `adds ${listWords(unlocks.map((slug) => names.get(slug) ?? slug))}`;
}

/**
 * The exact PATCH body a suggestion button sends (amendment 8), or null when
 * the organiser cannot apply it (members' maxima, season shifts).
 */
export function suggestionPatch(s: Suggestion): UpdateTripInput | null {
  if (s.constraint === 'F1') return { radiusKm: s.newRadiusKm };
  if (s.constraint === 'F2') return { durationNights: s.newNights };
  if (s.constraint === 'F5' && s.capSource === 'trip') return { budgetTotalInr: s.newGroupCapInr };
  return null;
}

/** The field a suggestion's PATCH changes, to read the server's 400 message for it. */
export function suggestionField(s: Suggestion): keyof UpdateTripInput | null {
  const patch = suggestionPatch(s);
  return patch ? ((Object.keys(patch)[0] as keyof UpdateTripInput | undefined) ?? null) : null;
}

/** The dashboard's "The last round found ..." sentence after a diagnostic. */
export function lastRoundText(
  run: Pick<RecommendationRun, 'bindingConstraint' | 'feasibleCount'>,
): string {
  if (run.bindingConstraint === 'F3') return 'The last round found a date clash.';
  if (run.feasibleCount === 0) return 'The last round found no destination.';
  return `The last round found only ${plural(run.feasibleCount, 'destination')}.`;
}
