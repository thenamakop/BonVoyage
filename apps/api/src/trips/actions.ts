import { legalEvents } from '@bonvoyage/engine';
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
}: ActionInput): TripAction[] {
  // Removed members can read the trip but not act (conventions rule 4); reading
  // the recommendations is not acting.
  if (myStatus === 'excluded') {
    return hasRecommendation ? [{ action: 'viewRecommendations', enabled: true }] : [];
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

  if (organiser && PLANNING.includes(status) && legal.has('cancelTrip')) {
    actions.push({ action: 'cancelTrip', enabled: true });
  }

  if (!organiser && open) actions.push({ action: 'leaveTrip', enabled: true });

  return actions;
}
