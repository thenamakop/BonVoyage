import { describe, expect, it } from 'vitest';
import type {
  DiagnosticEvaluation,
  GroupProfileReady,
  RecommendationItem,
} from '@bonvoyage/shared';
import {
  alternativeText,
  bindingText,
  budgetBandText,
  climateText,
  costText,
  dateConflictText,
  dateRange,
  distanceText,
  fitHeading,
  forYouText,
  groupScoreText,
  lastRoundText,
  listWords,
  moreInterestsText,
  sharedText,
  suggestionField,
  suggestionPatch,
  suggestionText,
  unlocksText,
  voteText,
  windowLine,
} from './wording';

const profile = (over: Partial<GroupProfileReady> = {}): GroupProfileReady => ({
  ready: true,
  memberCount: 3,
  commonWindow: { start: '2026-11-13', end: '2026-11-15', days: 3 },
  windowFits: true,
  budgetBand: { minInr: 12000, maxInr: 16000, overlaps: true },
  perPersonCapInr: 16000,
  groupCapInr: 48000,
  typeVotes: [],
  activityVotes: [],
  climateVotes: [],
  otherInterestCount: 0,
  conflicts: [],
  ...over,
});

const group = (over: Partial<RecommendationItem['group']> = {}): RecommendationItem['group'] => ({
  memberCount: 3,
  climateMetCount: 2,
  sharedTypes: [],
  sharedActivities: [],
  lowestScore10: 6,
  highestScore10: 9,
  ...over,
});

const near = (slug: string, name: string): DiagnosticEvaluation => ({
  slug,
  name,
  estimatedCostInr: 30000,
  cheapestMode: 'car',
  failures: [{ id: 'F1', limit: 450, actual: 490, relaxation: 40, relative: 0.09, unit: 'km' }],
});

describe('lists and dates', () => {
  it('joins lists in plain English', () => {
    expect(listWords([])).toBe('');
    expect(listWords(['Alwar'])).toBe('Alwar');
    expect(listWords(['Alwar', 'Vrindavan'])).toBe('Alwar and Vrindavan');
    expect(listWords(['A', 'B', 'C'])).toBe('A, B and C');
  });

  it('words a date range within a month, across months and across years', () => {
    expect(dateRange('2026-11-13', '2026-11-15')).toBe('13 to 15 Nov');
    expect(dateRange('2026-11-30', '2026-12-02')).toBe('30 Nov to 2 Dec');
    expect(dateRange('2026-12-30', '2027-01-02')).toBe('30 Dec 2026 to 2 Jan 2027');
    expect(windowLine({ start: '2026-11-13', end: '2026-11-15', days: 3 })).toBe(
      '13 to 15 Nov, 3 days',
    );
    expect(windowLine({ start: '2026-11-13', end: '2026-11-13', days: 1 })).toBe(
      '13 to 13 Nov, 1 day',
    );
  });
});

describe('group profile', () => {
  it('words the two date conflicts and stays silent when dates fit', () => {
    expect(dateConflictText([{ code: 'NO_COMMON_WINDOW', blocking: true }], null, 2)).toBe(
      'The dates members gave do not overlap.',
    );
    expect(
      dateConflictText(
        [{ code: 'WINDOW_TOO_SHORT', blocking: true }],
        { start: '2026-11-13', end: '2026-11-14', days: 2 },
        2,
      ),
    ).toBe('The dates members gave overlap for 2 days; this trip needs 3.');
    expect(
      dateConflictText([{ code: 'BUDGET_BANDS_DISJOINT', blocking: false }], null, 2),
    ).toBeNull();
  });

  it('shows the band as sent, or the lowest maximum when bands do not overlap', () => {
    expect(budgetBandText(profile())).toBe('₹12,000 to ₹16,000 per person');
    expect(
      budgetBandText(
        profile({
          budgetBand: { minInr: 14000, maxInr: 10000, overlaps: false },
          perPersonCapInr: 10000,
        }),
      ),
    ).toBe('Budgets do not overlap; plans use the lowest maximum, ₹10,000 per person.');
  });

  it('counts votes and the interests nobody shares', () => {
    expect(voteText('Mountain', 3, 3)).toBe('Mountain: 3 of 3');
    expect(moreInterestsText(0)).toBeNull();
    expect(moreInterestsText(1)).toBe('and 1 more interest');
    expect(moreInterestsText(4)).toBe('and 4 more interests');
  });
});

describe('shortlist cards', () => {
  it('words distance by provenance', () => {
    expect(distanceText(250, 'estimated')).toBe('250 km, estimated road distance');
    expect(distanceText(250, 'curated')).toBe('250 km, curated road distance');
    expect(distanceText(250, 'live')).toBe('250 km, road distance');
    expect(distanceText(250, 'cached')).toBe('250 km, road distance, saved earlier');
  });

  it('gives the group total, the per-person figure and the word estimate', () => {
    expect(costText({ estimatedCostInr: 27000, perPersonInr: 9000, cheapestMode: 'train' })).toBe(
      '₹27,000 for the group, about ₹9,000 each, estimate, cheapest by train',
    );
  });

  it('words the score range, and leaves it out below 3 members', () => {
    expect(groupScoreText(group({ lowestScore10: 6, highestScore10: 9 }))).toBe(
      'Everyone rates this at least 6 out of 10',
    );
    expect(groupScoreText(group({ lowestScore10: 5, highestScore10: 9 }))).toBe(
      'Everyone rates this at least 5 out of 10',
    );
    expect(groupScoreText(group({ lowestScore10: 2.5, highestScore10: 8.1 }))).toBe(
      'Opinions differ: from 2.5 to 8.1 out of 10',
    );
    expect(groupScoreText(group({ lowestScore10: null, highestScore10: null }))).toBeNull();
  });

  it('words climate and shared interests with their labels', () => {
    expect(climateText(group())).toBe('Climate suits 2 of 3');
    expect(
      sharedText(
        group({
          sharedTypes: [{ value: 'hill_station', count: 2 }],
          sharedActivities: [
            { value: 'rafting', count: 2 },
            { value: 'forts_palaces', count: 3 },
          ],
        }),
      ),
    ).toBe('Shared: ‘hill station’ (2), rafting (2), ‘forts and palaces’ (3)');
    expect(sharedText(group())).toBe('Shared: nothing that 2 or more members asked for');
  });

  it('builds the For you line from the caller’s own match', () => {
    expect(
      forYouText({
        score10: 7.5,
        metTypes: ['mountain'],
        missedTypes: [],
        metActivities: ['trekking'],
        missedActivities: ['rafting'],
        climateMet: true,
      }),
    ).toBe('For you: 7.5 out of 10. Matches mountain, trekking. Misses rafting.');
    expect(
      forYouText({
        score10: 0,
        metTypes: [],
        missedTypes: ['beach'],
        metActivities: [],
        missedActivities: [],
        climateMet: false,
      }),
    ).toBe('For you: 0 out of 10. Matches none of your picks. Misses beach.');
    // A multi-word label is quoted so the list stays unambiguous (walk-through nit 6).
    expect(
      forYouText({
        score10: 3.5,
        metTypes: [],
        missedTypes: ['spiritual', 'mountain'],
        metActivities: ['temples'],
        missedActivities: ['yoga_wellness'],
        climateMet: false,
      }),
    ).toBe(
      'For you: 3.5 out of 10. Matches temples. Misses spiritual, mountain, ‘yoga and wellness’.',
    );
  });
});

describe('diagnostic', () => {
  it('heads the page by how many fit', () => {
    expect(fitHeading(0)).toBe('No destination fits');
    expect(fitHeading(1)).toBe('Only 1 destination fits');
    expect(fitHeading(2)).toBe('Only 2 destinations fit');
  });

  it('states every binding constraint, F3 from the conflicts, and null as several limits', () => {
    const run = (bindingConstraint: 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | null) => ({
      bindingConstraint,
      groupProfile: profile({
        commonWindow: { start: '2026-11-13', end: '2026-11-14', days: 2 },
        conflicts: [{ code: 'WINDOW_TOO_SHORT' as const, blocking: true }],
      }),
    });
    expect(bindingText(run('F1'), 2)).toBe('Most places are just beyond your search radius.');
    expect(bindingText(run('F2'), 2)).toBe('Most places need more nights than this trip has.');
    expect(bindingText(run('F4'), 2)).toBe('Most places are out of season on your dates.');
    expect(bindingText(run('F5'), 2)).toBe('Most places cost more than the group can spend.');
    expect(bindingText(run('F3'), 2)).toBe(
      'The dates members gave overlap for 2 days; this trip needs 3.',
    );
    expect(bindingText({ ...run('F3'), groupProfile: profile() }, 2)).toBe(
      'The dates members gave do not overlap enough for this trip.',
    );
    expect(bindingText(run(null), 2)).toBe('Most places miss more than one limit.');
  });

  it('words each alternative from its first failure', () => {
    const e = (failure: DiagnosticEvaluation['failures'][number]): DiagnosticEvaluation => ({
      ...near('mussoorie', 'Mussoorie'),
      failures: [failure],
    });
    expect(
      alternativeText(
        e({ id: 'F1', limit: 450, actual: 490, relaxation: 40, relative: 0.1, unit: 'km' }),
      ),
    ).toBe('Mussoorie: 40 km beyond the radius');
    expect(
      alternativeText(
        e({ id: 'F2', limit: 3, actual: 2, relaxation: 1, relative: 0.5, unit: 'nights' }),
      ),
    ).toBe('Mussoorie: needs 3 nights');
    expect(
      alternativeText(
        e({ id: 'F4', limit: 0, actual: 1, relaxation: 1, relative: 0.08, unit: 'months' }),
      ),
    ).toBe('Mussoorie: out of season by 1 month');
    expect(
      alternativeText(
        e({ id: 'F4', limit: 0, actual: 2, relaxation: 2, relative: 0.16, unit: 'months' }),
      ),
    ).toBe('Mussoorie: out of season by 2 months');
    expect(
      alternativeText(
        e({ id: 'F5', limit: 48000, actual: 50500, relaxation: 2500, relative: 0.05, unit: 'inr' }),
      ),
    ).toBe('Mussoorie: about ₹2,500 over the group budget');
    expect(alternativeText({ ...near('x', 'Xville'), failures: [] })).toBe('Xville');
  });

  it('words suggestions, what they unlock and the exact PATCH they send', () => {
    const f1 = { constraint: 'F1' as const, newRadiusKm: 600, unlocks: ['alwar', 'vrindavan'] };
    const f2 = { constraint: 'F2' as const, newNights: 3, unlocks: ['auli'] };
    const f4 = { constraint: 'F4' as const, shiftMonths: 1, unlocks: ['auli'] };
    const trip5 = {
      constraint: 'F5' as const,
      newGroupCapInr: 54000,
      capSource: 'trip' as const,
      unlocks: [],
    };
    const members5 = {
      constraint: 'F5' as const,
      newGroupCapInr: 54000,
      capSource: 'members' as const,
      newPerPersonMaxInr: 18000,
      unlocks: [],
    };
    expect(suggestionText(f1)).toBe('Widen the radius to 600 km');
    expect(suggestionText(f2)).toBe('Make the trip 3 nights');
    expect(suggestionText({ ...f2, newNights: 1 })).toBe('Make the trip 1 night');
    expect(suggestionText(f4)).toBe('Shift the dates by 1 month');
    expect(suggestionText(trip5)).toBe('Raise the group budget to ₹54,000');
    expect(suggestionText(members5)).toBe(
      'Members need to raise their maximum to ₹18,000 per person',
    );
    expect(suggestionText({ ...trip5, capSource: 'members' })).toBe(
      'Members need to raise their maximum budgets',
    );

    expect(suggestionPatch(f1)).toEqual({ radiusKm: 600 });
    expect(suggestionPatch(f2)).toEqual({ durationNights: 3 });
    expect(suggestionPatch(trip5)).toEqual({ budgetTotalInr: 54000 });
    expect(suggestionPatch(members5)).toBeNull();
    expect(suggestionPatch(f4)).toBeNull();
    expect(suggestionField(f1)).toBe('radiusKm');
    expect(suggestionField(f4)).toBeNull();

    const misses = [near('alwar', 'Alwar'), near('vrindavan', 'Vrindavan')];
    expect(unlocksText(f1.unlocks, misses)).toBe('adds Alwar and Vrindavan');
    expect(unlocksText(['unknown'], misses)).toBe('adds unknown');
    expect(unlocksText([], misses)).toBeNull();
  });

  it('words the dashboard line after a diagnostic', () => {
    expect(lastRoundText({ bindingConstraint: 'F3', feasibleCount: 0 })).toBe(
      'The last round found a date clash.',
    );
    expect(lastRoundText({ bindingConstraint: 'F1', feasibleCount: 0 })).toBe(
      'The last round found no destination.',
    );
    expect(lastRoundText({ bindingConstraint: 'F1', feasibleCount: 1 })).toBe(
      'The last round found only 1 destination.',
    );
    expect(lastRoundText({ bindingConstraint: null, feasibleCount: 2 })).toBe(
      'The last round found only 2 destinations.',
    );
  });
});
