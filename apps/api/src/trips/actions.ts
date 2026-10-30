import { legalEvents, nextState } from '@bonvoyage/engine';
import {
  PLANNING_STATUSES,
  type MemberRole,
  type MemberStatus,
  type TripAction,
  type TripProgress,
  type TripStatus,
} from '@bonvoyage/shared';

// S1-5: exactly the actions this viewer may take, each with the reason when it
// is shown but disabled. Pure: the dashboard renders this list and nothing
// else, so the buttons can never disagree with the state machine.

export interface ActionInput {
  status: TripStatus;
  myRole: MemberRole;
  myStatus: MemberStatus;
  mySubmitted: boolean;
  progress: TripProgress;
  /** A recommendation run exists for this trip (S2-6). */
  hasRecommendation: boolean;
  /** An itinerary version exists for this trip (S3-6). */
  hasItinerary: boolean;
  /** The trip's first day, and today in India: T16's guard compares them. */
  startDate: string | null;
  today: string;
}

const PLANNING = PLANNING_STATUSES as readonly TripStatus[];

// T3b's guard (0001 f): closing needs at least two submissions.
const MIN_SUBMITTED_TO_CLOSE = 2;

// 0004 j: details stay editable until the shortlist is made.
const EDITABLE: readonly TripStatus[] = [
  'draft',
  'collecting_preferences',
  'ready_for_recommendation',
];

export function tripActions({
  status,
  myRole,
  myStatus,
  progress,
  hasRecommendation,
  hasItinerary,
  startDate,
  today,
}: ActionInput): TripAction[] {
  // Removed members can read the trip but not act (conventions rule 4); reading
  // the recommendations is not acting.
  if (myStatus === 'excluded') {
    return [
      ...(hasRecommendation ? [{ action: 'viewRecommendations' as const, enabled: true }] : []),
      ...(hasItinerary ? [{ action: 'viewItinerary' as const, enabled: true }] : []),
    ];
  }

  const legal = new Set(legalEvents(status));
  const organiser = myRole === 'organiser';
  const open = status === 'draft' || status === 'collecting_preferences';
  const actions: TripAction[] = [];

  if (organiser && open) actions.push({ action: 'invite', enabled: true });
  if (organiser && EDITABLE.includes(status))
    actions.push({ action: 'editDetails', enabled: true });

  if (status === 'draft') {
    actions.push({
      action: 'editPreferences',
      enabled: false,
      reason: 'Preferences open once the invite link exists.',
    });
  } else if (status === 'collecting_preferences' || status === 'ready_for_recommendation') {
    actions.push({ action: 'editPreferences', enabled: true });
  }

  if (organiser && status === 'collecting_preferences' && legal.has('closeSubmissions')) {
    const enough = progress.submittedCount >= MIN_SUBMITTED_TO_CLOSE;
    actions.push(
      enough
        ? { action: 'closeSubmissions', enabled: true }
        : {
            action: 'closeSubmissions',
            enabled: false,
            reason: 'At least 2 members need to submit first.',
          },
    );
  }

  if (organiser && status === 'ready_for_recommendation' && legal.has('recommendationRequested')) {
    actions.push({ action: 'requestRecommendations', enabled: true });
  }
  if (hasRecommendation) actions.push({ action: 'viewRecommendations', enabled: true });
  if (organiser && status === 'shortlisted' && legal.has('destinationSelected')) {
    actions.push({ action: 'chooseDestination', enabled: true });
  }
  // T21 "Ask again" (decision E1): organiser only, from the shortlist.
  if (organiser && status === 'shortlisted' && legal.has('shortlistReopened')) {
    actions.push({ action: 'reopenShortlist', enabled: true });
  }

  // S3-3: members view and vote on packages; the organiser chooses, removes
  // or changes them while the packages are proposed.
  const packagesLive =
    status === 'packages_proposed' ||
    status === 'package_selected' ||
    status === 'itinerary_proposed';
  if (packagesLive) actions.push({ action: 'viewPackages', enabled: true });
  if (status === 'packages_proposed') {
    actions.push({ action: 'givePackageOpinion', enabled: true });
    if (organiser) {
      actions.push({ action: 'choosePackage', enabled: true });
      actions.push({ action: 'removePackage', enabled: true });
      actions.push({ action: 'changePackage', enabled: true });
    }
  }

  // S3-6: the organiser plans the days from the accepted package (T12), and
  // accepts or rejects the plan (T14, T13); members only read it.
  if (organiser && status === 'package_selected' && legal.has('generateItinerary')) {
    actions.push({ action: 'planDays', enabled: true });
  }
  if (hasItinerary) actions.push({ action: 'viewItinerary', enabled: true });
  if (organiser && status === 'itinerary_proposed') {
    actions.push({ action: 'acceptItinerary', enabled: true });
    actions.push({ action: 'rejectItinerary', enabled: true });
    actions.push({ action: 'modifyItinerary', enabled: true });
  }

  // T15 while planning; T16 once finalised, only while its guard holds. The state
  // machine answers, so the button can never disagree with the 409. With no date
  // there is no answer, and nothing is offered.
  const cancellable =
    PLANNING.includes(status) ||
    (status === 'finalised' &&
      startDate !== null &&
      nextState(status, 'cancelTrip', {
        pendingCount: progress.pendingCount,
        submittedCount: progress.submittedCount,
        feasibleCount: null,
        alternativesLeft: null,
        today,
        startDate,
      }).ok);
  if (organiser && cancellable && legal.has('cancelTrip')) {
    actions.push({ action: 'cancelTrip', enabled: true });
  }

  if (!organiser && open) actions.push({ action: 'leaveTrip', enabled: true });

  return actions;
}
