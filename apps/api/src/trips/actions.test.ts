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

  it('ready: organiser can revise and cancel; member can only revise', () => {
    expect(names(tripActions(organiser('ready_for_recommendation', 3)))).toEqual([
      'editPreferences',
      'cancelTrip',
    ]);
    expect(names(tripActions(member('ready_for_recommendation', 3)))).toEqual(['editPreferences']);
  });

  it('shortlisted: organiser can only cancel; member has nothing', () => {
    expect(names(tripActions(organiser('shortlisted', 3)))).toEqual(['cancelTrip']);
    expect(tripActions(member('shortlisted', 3))).toEqual([]);
  });

  it('excluded: no actions in any status', () => {
    for (const status of ['draft', 'collecting_preferences', 'ready_for_recommendation'] as const) {
      expect(tripActions({ ...member(status), myStatus: 'excluded' })).toEqual([]);
    }
  });

  it('cancelled: nobody has an action', () => {
    expect(tripActions(organiser('cancelled'))).toEqual([]);
    expect(tripActions(member('cancelled'))).toEqual([]);
  });
});
