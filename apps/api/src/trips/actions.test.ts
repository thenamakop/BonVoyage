import type { TripAction, TripStatus } from '@bonvoyage/shared';
import { describe, expect, it } from 'vitest';
import { tripActions, type ActionInput } from './actions';

// S1-5 step 2: tripActions is pure, so these run without the database.

const progress = (submittedCount: number, activeCount = 3) => ({
  activeCount,
  submittedCount,
  pendingCount: activeCount - submittedCount,
  excludedCount: 0,
  maxMembers: 8,
});

const organiser = (status: TripStatus, submitted = 0): ActionInput => ({
  status,
  myRole: 'organiser',
  myStatus: 'active',
  mySubmitted: false,
  progress: progress(submitted),
  hasRecommendation: false,
  hasItinerary: false,
  startDate: null,
  today: '2026-11-01',
});
const member = (status: TripStatus, submitted = 0): ActionInput => ({
  ...organiser(status, submitted),
  myRole: 'member',
});

const names = (actions: TripAction[]) => actions.map((a) => a.action);
const find = (actions: TripAction[], name: TripAction['action']) =>
  actions.find((a) => a.action === name);

describe('tripActions', () => {
  it('draft, organiser: invite, edit details, preferences disabled with a reason, cancel', () => {
    const actions = tripActions(organiser('draft'));
    expect(names(actions)).toEqual(['invite', 'editDetails', 'editPreferences', 'cancelTrip']);
    expect(find(actions, 'editPreferences')).toEqual({
      action: 'editPreferences',
      enabled: false,
      reason: 'Preferences open once the invite link exists.',
    });
  });

  it('draft, member: preferences disabled, leave', () => {
    expect(tripActions(member('draft'))).toEqual([
      {
        action: 'editPreferences',
        enabled: false,
        reason: 'Preferences open once the invite link exists.',
      },
      { action: 'leaveTrip', enabled: true },
    ]);
  });

  it.each([0, 1])(
    'collecting with %i submitted, organiser: close submissions disabled with its reason',
    (submitted) => {
      const actions = tripActions(organiser('collecting_preferences', submitted));
      expect(names(actions)).toEqual([
        'invite',
        'editDetails',
        'editPreferences',
        'closeSubmissions',
        'cancelTrip',
      ]);
      expect(find(actions, 'closeSubmissions')).toEqual({
        action: 'closeSubmissions',
        enabled: false,
        reason: 'At least 2 members need to submit first.',
      });
    },
  );

  it('collecting with 2 submitted, organiser: close submissions enabled', () => {
    expect(find(tripActions(organiser('collecting_preferences', 2)), 'closeSubmissions')).toEqual({
      action: 'closeSubmissions',
      enabled: true,
    });
  });

  it.each([0, 1, 2])('collecting with %i submitted, member: preferences and leave only', (n) => {
    expect(tripActions(member('collecting_preferences', n))).toEqual([
      { action: 'editPreferences', enabled: true },
      { action: 'leaveTrip', enabled: true },
    ]);
  });

  it('ready: organiser can edit details, revise, ask for recommendations and cancel; member can only revise', () => {
    expect(names(tripActions(organiser('ready_for_recommendation', 3)))).toEqual([
      'editDetails',
      'editPreferences',
      'requestRecommendations',
      'cancelTrip',
    ]);
    expect(names(tripActions(member('ready_for_recommendation', 3)))).toEqual(['editPreferences']);
  });

  it('shortlisted: organiser can view, choose, ask again (T21) and cancel; member can view', () => {
    const run = { hasRecommendation: true };
    expect(names(tripActions({ ...organiser('shortlisted', 3), ...run }))).toEqual([
      'viewRecommendations',
      'chooseDestination',
      'reopenShortlist',
      'cancelTrip',
    ]);
    expect(names(tripActions({ ...member('shortlisted', 3), ...run }))).toEqual([
      'viewRecommendations',
    ]);
  });

  it('back to collecting after a diagnostic: the run stays viewable', () => {
    const actions = tripActions({
      ...member('collecting_preferences', 3),
      hasRecommendation: true,
      hasItinerary: false,
    });
    expect(names(actions)).toEqual(['editPreferences', 'viewRecommendations', 'leaveTrip']);
  });

  it('shortlisted: organiser details are locked (0004 j)', () => {
    const actions = tripActions({ ...organiser('shortlisted', 3), hasRecommendation: true });
    expect(names(actions)).not.toContain('editDetails');
  });

  it('excluded: no actions, except viewing a run that exists', () => {
    for (const status of ['draft', 'collecting_preferences', 'ready_for_recommendation'] as const) {
      expect(tripActions({ ...member(status), myStatus: 'excluded' })).toEqual([]);
    }
    expect(
      tripActions({ ...member('shortlisted'), myStatus: 'excluded', hasRecommendation: true }),
    ).toEqual([{ action: 'viewRecommendations', enabled: true }]);
  });

  describe('T16: Cancel on a finalised trip', () => {
    const finalised = (startDate: string | null): ActionInput => ({
      ...organiser('finalised', 3),
      hasItinerary: true,
      startDate,
    });

    it('is offered to the organiser before the first day', () => {
      expect(names(tripActions(finalised('2026-11-02')))).toEqual(['viewItinerary', 'cancelTrip']);
    });

    it.each([
      ['on the first day', '2026-11-01'],
      ['after it', '2026-10-31'],
      ['with no date to compare', null],
    ])('is not offered %s', (_when, startDate) => {
      expect(names(tripActions(finalised(startDate)))).toEqual(['viewItinerary']);
    });

    it('is never offered to a member or an excluded organiser', () => {
      const trip = finalised('2026-11-02');
      expect(names(tripActions({ ...trip, myRole: 'member' }))).toEqual(['viewItinerary']);
      expect(names(tripActions({ ...trip, myStatus: 'excluded' }))).toEqual(['viewItinerary']);
    });

    it('in_progress and completed trips are unaffected by the date', () => {
      for (const status of ['in_progress', 'completed'] as const) {
        const actions = tripActions({ ...finalised('2026-11-02'), status });
        expect(names(actions)).not.toContain('cancelTrip');
      }
    });
  });

  it('cancelled: nobody has an action', () => {
    expect(tripActions(organiser('cancelled'))).toEqual([]);
    expect(tripActions(member('cancelled'))).toEqual([]);
  });
});
