import type { TripStatus } from '@bonvoyage/shared';
import { describe, expect, it } from 'vitest';
import {
  DO_ACTIVITIES,
  legalEvents,
  nextState,
  type ActionName,
  type GuardContext,
  type TripEvent,
} from './trip-state';

// S0-6: one test per transition row, a hand-written 216-pair matrix, and the
// guard edges. The legal-pairs list is written by hand, not derived from
// TRANSITIONS, so the test proves the table rather than restating it.

const ctx = (over: Partial<GuardContext> = {}): GuardContext => ({
  pendingCount: 0,
  submittedCount: 3,
  feasibleCount: 5,
  alternativesLeft: 0,
  today: '2026-11-01',
  startDate: '2026-11-20',
  ...over,
});

const E = (
  id: string,
  from: TripStatus | 'initial',
  event: TripEvent,
  to: TripStatus,
  actions: ActionName[],
  c: GuardContext = ctx(),
) => {
  const r = nextState(from, event, c);
  expect(r).toEqual({
    ok: true,
    kind: 'external',
    transitionId: id,
    from: from === 'initial' ? 'draft' : from,
    to,
    actions,
  });
};
const I = (
  id: string,
  from: TripStatus,
  event: TripEvent,
  actions: ActionName[],
  c: GuardContext = ctx(),
) => {
  const r = nextState(from, event, c);
  expect(r).toEqual({ ok: true, kind: 'internal', transitionId: id, from, to: from, actions });
};

describe('external transitions', () => {
  it('T1', () =>
    E('T1', 'initial', 'createTrip', 'draft', ['assignOrganiser', 'validateTripParameters']));
  it('T2', () =>
    E('T2', 'draft', 'inviteMembers', 'collecting_preferences', [
      'sendInvitations',
      'openSubmissionWindow',
    ]));
  it('T3', () =>
    E('T3', 'collecting_preferences', 'preferenceSubmitted', 'ready_for_recommendation', [
      'computeGroupProfile',
    ]));
  it('T3b', () =>
    E('T3b', 'collecting_preferences', 'closeSubmissions', 'ready_for_recommendation', [
      'excludeNonSubmitters',
      'notifyMembers',
      'computeGroupProfile',
    ]));
  it('T4', () =>
    E('T4', 'ready_for_recommendation', 'conflictDetected', 'collecting_preferences', [
      'reportConflict',
      'openSubmissionWindow',
    ]));
  it('T5', () =>
    E('T5', 'ready_for_recommendation', 'preferenceRevised', 'ready_for_recommendation', [
      'computeGroupProfile',
    ]));
  it('T6>T7', () =>
    E('T6>T7', 'ready_for_recommendation', 'recommendationRequested', 'shortlisted', [
      'filterByHardConstraints',
      'rankByGroupFit',
      'saveRankedShortlist',
    ]));
  it('T6>T8', () =>
    E(
      'T6>T8',
      'ready_for_recommendation',
      'recommendationRequested',
      'collecting_preferences',
      ['filterByHardConstraints', 'showEmptyShortlistDiagnostic', 'openSubmissionWindow'],
      ctx({ feasibleCount: 2 }),
    ));
  it('T9', () =>
    E('T9', 'shortlisted', 'destinationSelected', 'packages_proposed', [
      'generateAndCostPackages',
    ]));
  it('T10', () =>
    E('T10', 'packages_proposed', 'packageRejected', 'shortlisted', ['saveRankedShortlist']));
  it('T11', () =>
    E('T11', 'packages_proposed', 'packageAccepted', 'package_selected', ['lockPackage']));
  it('T12', () =>
    E('T12', 'package_selected', 'generateItinerary', 'itinerary_proposed', [
      'assembleDayWisePlan',
    ]));
  it('T13', () =>
    E('T13', 'itinerary_proposed', 'itineraryRejected', 'package_selected', ['lockPackage']));
  it('T14', () =>
    E('T14', 'itinerary_proposed', 'itineraryAccepted', 'finalised', ['notifyMembers']));
  it('T15', () => E('T15', 'draft', 'cancelTrip', 'cancelled', ['notifyMembers', 'releaseHolds']));
  it('T15 fires from every PLANNING status', () => {
    for (const s of [
      'draft',
      'collecting_preferences',
      'ready_for_recommendation',
      'shortlisted',
      'packages_proposed',
      'package_selected',
      'itinerary_proposed',
    ] as const) {
      E('T15', s, 'cancelTrip', 'cancelled', ['notifyMembers', 'releaseHolds']);
    }
  });
  it('T16', () =>
    E(
      'T16',
      'finalised',
      'cancelTrip',
      'cancelled',
      ['notifyMembers', 'releaseHolds'],
      ctx({ today: '2026-11-19' }),
    ));
  it('T17', () => E('T17', 'finalised', 'tripStarted', 'in_progress', []));
  it('T18', () =>
    E('T18', 'in_progress', 'tripEnded', 'completed', ['requestRatings', 'archiveToTripHistory']));
});

describe('internal transitions', () => {
  it('I1', () =>
    I(
      'I1',
      'collecting_preferences',
      'preferenceSubmitted',
      ['updateProgress'],
      ctx({ submittedCount: 1 }),
    ));
  it('I2', () => I('I2', 'collecting_preferences', 'preferenceRevised', ['updateProgress']));
  it('I3', () => I('I3', 'packages_proposed', 'packageModified', ['recomputeCost']));
  it('I4', () =>
    I('I4', 'packages_proposed', 'packageRejected', ['hidePackage'], ctx({ alternativesLeft: 1 })));
  it('I5', () => I('I5', 'itinerary_proposed', 'itineraryModified', ['revalidate']));
});

const ALL_EVENTS: TripEvent[] = [
  'createTrip',
  'inviteMembers',
  'preferenceSubmitted',
  'closeSubmissions',
  'conflictDetected',
  'preferenceRevised',
  'recommendationRequested',
  'destinationSelected',
  'packageRejected',
  'packageAccepted',
  'generateItinerary',
  'itineraryRejected',
  'itineraryAccepted',
  'packageModified',
  'itineraryModified',
  'cancelTrip',
  'tripStarted',
  'tripEnded',
];

// Hand-written legal pairs (source, event) for the permissive context.
const LEGAL: [TripStatus | 'initial', TripEvent][] = [
  ['initial', 'createTrip'],
  ['draft', 'inviteMembers'],
  ['draft', 'cancelTrip'],
  ['collecting_preferences', 'preferenceSubmitted'],
  ['collecting_preferences', 'closeSubmissions'],
  ['collecting_preferences', 'preferenceRevised'],
  ['collecting_preferences', 'cancelTrip'],
  ['ready_for_recommendation', 'conflictDetected'],
  ['ready_for_recommendation', 'preferenceRevised'],
  ['ready_for_recommendation', 'recommendationRequested'],
  ['ready_for_recommendation', 'cancelTrip'],
  ['shortlisted', 'destinationSelected'],
  ['shortlisted', 'cancelTrip'],
  ['packages_proposed', 'packageRejected'],
  ['packages_proposed', 'packageAccepted'],
  ['packages_proposed', 'packageModified'],
  ['packages_proposed', 'cancelTrip'],
  ['package_selected', 'generateItinerary'],
  ['package_selected', 'cancelTrip'],
  ['itinerary_proposed', 'itineraryRejected'],
  ['itinerary_proposed', 'itineraryAccepted'],
  ['itinerary_proposed', 'itineraryModified'],
  ['itinerary_proposed', 'cancelTrip'],
  ['finalised', 'cancelTrip'],
  ['finalised', 'tripStarted'],
  ['in_progress', 'tripEnded'],
];

const SOURCES: (TripStatus | 'initial')[] = [
  'initial',
  'draft',
  'collecting_preferences',
  'ready_for_recommendation',
  'shortlisted',
  'packages_proposed',
  'package_selected',
  'itinerary_proposed',
  'finalised',
  'in_progress',
  'completed',
  'cancelled',
];

describe('matrix (216 pairs)', () => {
  it('matches the hand-written legal list', () => {
    const legal = new Set(LEGAL.map(([s, e]) => `${s}|${e}`));
    for (const from of SOURCES) {
      for (const event of ALL_EVENTS) {
        const r = nextState(from, event, ctx());
        const isLegal = legal.has(`${from}|${event}`);
        expect(r.ok, `${from} + ${event}`).toBe(isLegal);
      }
    }
  });

  it('rejects every event from completed and from cancelled (T19/T20)', () => {
    for (const from of ['completed', 'cancelled'] as const) {
      for (const event of ALL_EVENTS) {
        expect(nextState(from, event, ctx())).toMatchObject({
          ok: false,
          reason: 'TERMINAL_STATE',
        });
      }
    }
  });
});

describe('guard edges', () => {
  it('pendingCount 0 and submittedCount 1 gives I1, not T3 (0001 a)', () => {
    expect(
      nextState(
        'collecting_preferences',
        'preferenceSubmitted',
        ctx({ pendingCount: 0, submittedCount: 1 }),
      ),
    ).toMatchObject({ ok: true, transitionId: 'I1' });
  });
  it('closeSubmissions with submittedCount 1 fails the guard', () => {
    expect(
      nextState('collecting_preferences', 'closeSubmissions', ctx({ submittedCount: 1 })),
    ).toMatchObject({ ok: false, reason: 'GUARD_FAILED' });
  });
  it('feasibleCount 3 is T6>T7, 2 and 0 are T6>T8', () => {
    for (const [n, id] of [
      [3, 'T6>T7'],
      [2, 'T6>T8'],
      [0, 'T6>T8'],
    ] as const) {
      expect(
        nextState('ready_for_recommendation', 'recommendationRequested', ctx({ feasibleCount: n })),
      ).toMatchObject({ ok: true, transitionId: id });
    }
  });
  it('alternativesLeft 0 is T10 and 1 is I4', () => {
    expect(
      nextState('packages_proposed', 'packageRejected', ctx({ alternativesLeft: 0 })),
    ).toMatchObject({ transitionId: 'T10' });
    expect(
      nextState('packages_proposed', 'packageRejected', ctx({ alternativesLeft: 1 })),
    ).toMatchObject({ transitionId: 'I4' });
  });
  it('T16 passes the day before startDate and fails on the day', () => {
    expect(
      nextState('finalised', 'cancelTrip', ctx({ today: '2026-11-19', startDate: '2026-11-20' })),
    ).toMatchObject({ ok: true, transitionId: 'T16' });
    expect(
      nextState('finalised', 'cancelTrip', ctx({ today: '2026-11-20', startDate: '2026-11-20' })),
    ).toMatchObject({ ok: false, reason: 'GUARD_FAILED' });
  });
  it('a non-finite guard input fails every guard rather than picking one', () => {
    expect(
      nextState('packages_proposed', 'packageRejected', ctx({ alternativesLeft: Number.NaN })),
    ).toMatchObject({ ok: false, reason: 'GUARD_FAILED' });
    expect(
      nextState(
        'ready_for_recommendation',
        'recommendationRequested',
        ctx({ feasibleCount: Number.NaN }),
      ),
    ).toMatchObject({ ok: false, reason: 'GUARD_FAILED' });
  });
  it('a null guard input throws (caller bug, not user error)', () => {
    expect(() =>
      nextState(
        'ready_for_recommendation',
        'recommendationRequested',
        ctx({ feasibleCount: null }),
      ),
    ).toThrow(/feasibleCount/);
  });
});

describe('locked preferences (0001 b)', () => {
  it.each([
    'shortlisted',
    'packages_proposed',
    'package_selected',
    'itinerary_proposed',
    'finalised',
    'in_progress',
  ] as const)('preferenceRevised in %s is PREFERENCES_LOCKED', (s) => {
    expect(nextState(s, 'preferenceRevised', ctx())).toMatchObject({
      ok: false,
      reason: 'PREFERENCES_LOCKED',
    });
  });
});

describe('legalEvents and do-activities', () => {
  it('lists events per status', () => {
    expect(legalEvents('initial')).toEqual(['createTrip']);
    expect(legalEvents('collecting_preferences').sort()).toEqual(
      ['cancelTrip', 'closeSubmissions', 'preferenceRevised', 'preferenceSubmitted'].sort(),
    );
    expect(legalEvents('completed')).toEqual([]);
    expect(legalEvents('cancelled')).toEqual([]);
  });
  it('stores sendDailyReminders as data and never returns it', () => {
    expect(DO_ACTIVITIES.in_progress).toBe('sendDailyReminders');
    const r = nextState('finalised', 'tripStarted', ctx());
    expect(r.ok && r.actions).not.toContain('sendDailyReminders');
  });
});
