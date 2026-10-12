import { PLANNING_STATUSES, type TripStatus } from '@bonvoyage/shared';

// The trip state machine (RUNBOOK Appendix B2 + decision 0001). Pure data plus
// one pure function: no clock, no I/O; callers pass every guard value in.

export const TRIP_EVENTS = [
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
] as const;
export type TripEvent = (typeof TRIP_EVENTS)[number];

export const ACTION_NAMES = [
  'assignOrganiser',
  'sendInvitations',
  'updateProgress',
  'excludeNonSubmitters',
  'notifyMembers',
  'reportConflict',
  'filterByHardConstraints',
  'rankByGroupFit',
  'showEmptyShortlistDiagnostic',
  'recomputeCost',
  'hidePackage',
  'revalidate',
  'requestRatings',
  'releaseHolds',
  // entry behaviours
  'validateTripParameters',
  'openSubmissionWindow',
  'computeGroupProfile',
  'saveRankedShortlist',
  'generateAndCostPackages',
  'lockPackage',
  'assembleDayWisePlan',
  'archiveToTripHistory',
] as const;
export type ActionName = (typeof ACTION_NAMES)[number];

export interface GuardContext {
  pendingCount: number;
  submittedCount: number;
  feasibleCount: number | null;
  alternativesLeft: number | null;
  /** YYYY-MM-DD, India date */
  today: string;
  startDate: string | null;
}

type Guard = (ctx: GuardContext) => boolean;

export interface TransitionRow {
  id: string;
  from: TripStatus | 'initial' | readonly TripStatus[];
  event: TripEvent;
  guard?: Guard;
  guardText: string;
  to: TripStatus;
  actions: readonly ActionName[];
}

const PLANNING = PLANNING_STATUSES as readonly TripStatus[];

// One row per line of the S0-6 table, in table order.
export const TRANSITIONS: readonly TransitionRow[] = [
  {
    id: 'T1',
    from: 'initial',
    event: 'createTrip',
    guardText: '',
    to: 'draft',
    actions: ['assignOrganiser'],
  },
  {
    id: 'T2',
    from: 'draft',
    event: 'inviteMembers',
    guardText: '',
    to: 'collecting_preferences',
    actions: ['sendInvitations'],
  },
  {
    id: 'T3',
    from: 'collecting_preferences',
    event: 'preferenceSubmitted',
    guard: (c) => c.pendingCount === 0 && c.submittedCount >= 2,
    guardText: 'pendingCount = 0 and submittedCount >= 2',
    to: 'ready_for_recommendation',
    actions: [],
  },
  {
    id: 'T3b',
    from: 'collecting_preferences',
    event: 'closeSubmissions',
    guard: (c) => c.submittedCount >= 2,
    guardText: 'submittedCount >= 2',
    to: 'ready_for_recommendation',
    actions: ['excludeNonSubmitters', 'notifyMembers'],
  },
  {
    id: 'T4',
    from: 'ready_for_recommendation',
    event: 'conflictDetected',
    guardText: '',
    to: 'collecting_preferences',
    actions: ['reportConflict'],
  },
  {
    id: 'T5',
    from: 'ready_for_recommendation',
    event: 'preferenceRevised',
    guardText: '',
    to: 'ready_for_recommendation',
    actions: [],
  },
  {
    id: 'T6>T7',
    from: 'ready_for_recommendation',
    event: 'recommendationRequested',
    guard: (c) => need(c.feasibleCount, 'feasibleCount') >= 3,
    guardText: 'feasibleCount >= 3',
    to: 'shortlisted',
    actions: ['filterByHardConstraints', 'rankByGroupFit'],
  },
  {
    id: 'T6>T8',
    from: 'ready_for_recommendation',
    event: 'recommendationRequested',
    guard: (c) => need(c.feasibleCount, 'feasibleCount') < 3,
    guardText: 'feasibleCount < 3',
    to: 'collecting_preferences',
    actions: ['filterByHardConstraints', 'showEmptyShortlistDiagnostic'],
  },
  {
    id: 'T9',
    from: 'shortlisted',
    event: 'destinationSelected',
    guardText: '',
    to: 'packages_proposed',
    actions: [],
  },
  {
    id: 'T10',
    from: 'packages_proposed',
    event: 'packageRejected',
    guard: (c) => need(c.alternativesLeft, 'alternativesLeft') === 0,
    guardText: 'alternativesLeft = 0',
    to: 'shortlisted',
    actions: [],
  },
  {
    id: 'T11',
    from: 'packages_proposed',
    event: 'packageAccepted',
    guardText: '',
    to: 'package_selected',
    actions: [],
  },
  {
    id: 'T12',
    from: 'package_selected',
    event: 'generateItinerary',
    guardText: '',
    to: 'itinerary_proposed',
    actions: [],
  },
  {
    id: 'T13',
    from: 'itinerary_proposed',
    event: 'itineraryRejected',
    guardText: '',
    to: 'package_selected',
    actions: [],
  },
  {
    id: 'T14',
    from: 'itinerary_proposed',
    event: 'itineraryAccepted',
    guardText: '',
    to: 'finalised',
    actions: [],
  },
  { id: 'T15', from: PLANNING, event: 'cancelTrip', guardText: '', to: 'cancelled', actions: [] },
  {
    id: 'T16',
    from: 'finalised',
    event: 'cancelTrip',
    guard: (c) => c.today < need(c.startDate, 'startDate'),
    guardText: 'today < startDate',
    to: 'cancelled',
    actions: [],
  },
  {
    id: 'T17',
    from: 'finalised',
    event: 'tripStarted',
    guardText: '',
    to: 'in_progress',
    actions: [],
  },
  {
    id: 'T18',
    from: 'in_progress',
    event: 'tripEnded',
    guardText: '',
    to: 'completed',
    actions: ['requestRatings'],
  },
];

export interface InternalRow {
  id: string;
  from: TripStatus;
  event: TripEvent;
  guard?: Guard;
  guardText: string;
  actions: readonly ActionName[];
}

export const INTERNAL_TRANSITIONS: readonly InternalRow[] = [
  {
    id: 'I1',
    from: 'collecting_preferences',
    event: 'preferenceSubmitted',
    // 0001 a: internal whenever T3's guard is false, not only when pending > 0.
    guard: (c) => !(c.pendingCount === 0 && c.submittedCount >= 2),
    guardText: "not T3's guard",
    actions: ['updateProgress'],
  },
  {
    id: 'I2',
    from: 'collecting_preferences',
    event: 'preferenceRevised',
    guardText: '',
    actions: ['updateProgress'],
  },
  {
    id: 'I3',
    from: 'packages_proposed',
    event: 'packageModified',
    guardText: '',
    actions: ['recomputeCost'],
  },
  {
    id: 'I4',
    from: 'packages_proposed',
    event: 'packageRejected',
    guard: (c) => need(c.alternativesLeft, 'alternativesLeft') > 0,
    guardText: 'alternativesLeft > 0',
    actions: ['hidePackage'],
  },
  {
    id: 'I5',
    from: 'itinerary_proposed',
    event: 'itineraryModified',
    guardText: '',
    actions: ['revalidate'],
  },
];

// Entry behaviours run after the transition's own actions on every external
// transition into a state, including self-transitions like T5.
export const ENTRY_ACTIONS: Record<TripStatus, readonly ActionName[]> = {
  draft: ['validateTripParameters'],
  collecting_preferences: ['openSubmissionWindow'],
  ready_for_recommendation: ['computeGroupProfile'],
  shortlisted: ['saveRankedShortlist'],
  packages_proposed: ['generateAndCostPackages'],
  package_selected: ['lockPackage'],
  itinerary_proposed: ['assembleDayWisePlan'],
  finalised: ['notifyMembers'],
  in_progress: [],
  completed: ['archiveToTripHistory'],
  cancelled: ['notifyMembers', 'releaseHolds'],
};

// C4 deferred: sendDailyReminders is stored as data and never returned as an action.
export const DO_ACTIVITIES: Partial<Record<TripStatus, string>> = {
  in_progress: 'sendDailyReminders',
};

// A guard that needs a null context value means the caller forgot to measure;
// throw, because that is a bug, not a user error.
function need<T>(value: T | null, name: string): T {
  if (value === null) throw new Error(`Guard needs ${name}, but it was not measured.`);
  return value;
}

// preferenceRevised is locked once submissions are done (0001 b, a known gap).
const LOCKED_FOR_PREFERENCE_REVISION = [
  'shortlisted',
  'packages_proposed',
  'package_selected',
  'itinerary_proposed',
  'finalised',
  'in_progress',
] as const;

const TERMINAL: readonly TripStatus[] = ['completed', 'cancelled'];

export type NextStateResult =
  | {
      ok: true;
      kind: 'external';
      transitionId: string;
      from: TripStatus;
      to: TripStatus;
      actions: readonly ActionName[];
    }
  | {
      ok: true;
      kind: 'internal';
      transitionId: string;
      from: TripStatus;
      to: TripStatus;
      actions: readonly ActionName[];
    }
  | {
      ok: false;
      reason: 'ILLEGAL_EVENT' | 'GUARD_FAILED' | 'PREFERENCES_LOCKED' | 'TERMINAL_STATE';
      message: string;
    };

export function nextState(
  from: TripStatus | 'initial',
  event: TripEvent,
  ctx: GuardContext,
): NextStateResult {
  // T19/T20: terminal states reject every event.
  if (from !== 'initial' && TERMINAL.includes(from)) {
    return {
      ok: false,
      reason: 'TERMINAL_STATE',
      message: `This trip is ${from}; no further events are accepted.`,
    };
  }
  // 0001 b: preferenceRevised is locked after ready_for_recommendation.
  if (
    event === 'preferenceRevised' &&
    from !== 'initial' &&
    (LOCKED_FOR_PREFERENCE_REVISION as readonly string[]).includes(from)
  ) {
    return {
      ok: false,
      reason: 'PREFERENCES_LOCKED',
      message: 'Preferences are locked now that recommendations have run.',
    };
  }

  // Rows for (from, event), external before internal, in table order.
  const external = TRANSITIONS.filter((row) => {
    const states = Array.isArray(row.from) ? row.from : [row.from];
    return states.includes(from) && row.event === event;
  });
  const internal = INTERNAL_TRANSITIONS.filter((row) => row.from === from && row.event === event);

  if (external.length === 0 && internal.length === 0) {
    return {
      ok: false,
      reason: 'ILLEGAL_EVENT',
      message: `The event "${event}" is not allowed while the trip is ${from}.`,
    };
  }

  let failingGuard = '';
  for (const row of external) {
    if (!row.guard || row.guard(ctx)) {
      const to = row.to;
      return {
        ok: true,
        kind: 'external',
        transitionId: row.id,
        from: from === 'initial' ? 'draft' : from,
        to,
        actions: [...row.actions, ...ENTRY_ACTIONS[to]],
      };
    }
    failingGuard = row.guardText;
  }
  // Internal guards can only fail when their paired external row already
  // matched (T3 vs I1, T10 vs I4), so a failing internal guard never sets
  // failingGuard here.
  for (const row of internal) {
    if (!row.guard || row.guard(ctx)) {
      return {
        ok: true,
        kind: 'internal',
        transitionId: row.id,
        from: row.from,
        to: row.from,
        actions: row.actions,
      };
    }
  }

  return {
    ok: false,
    reason: 'GUARD_FAILED',
    message: `The guard "${failingGuard}" is not met for ${event}.`,
  };
}

/** Events with at least one row from that status (the web shows/hides buttons). */
export function legalEvents(status: TripStatus | 'initial'): TripEvent[] {
  const events = new Set<TripEvent>();
  for (const row of TRANSITIONS) {
    const states = Array.isArray(row.from) ? row.from : [row.from];
    if (states.includes(status)) events.add(row.event);
  }
  for (const row of INTERNAL_TRANSITIONS) {
    if (row.from === status) events.add(row.event);
  }
  return [...events];
}
