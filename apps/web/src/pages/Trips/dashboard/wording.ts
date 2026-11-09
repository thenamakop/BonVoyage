import { PLANNING_STATUSES, TRIP_STATUS_LABELS, type TripStatus } from '@bonvoyage/shared';
import { formatInr } from '../../../lib/format';

// The dashboard's sentences, kept pure so they can be unit-tested.

const PLANNING = PLANNING_STATUSES as readonly string[];

/** "Step 2 of 7: Collecting preferences" while planning; own words otherwise. */
export function stepLine(status: TripStatus): string {
  if (status === 'finalised') return 'Step 7 of 7: Finalised';
  const index = PLANNING.indexOf(status);
  if (index >= 0) {
    return `Step ${index + 1} of ${PLANNING.length}: ${TRIP_STATUS_LABELS[status].label}`;
  }
  if (status === 'cancelled') return 'This trip was cancelled, so planning has stopped.';
  if (status === 'completed') return 'This trip is over.';
  if (status === 'in_progress') return 'Planning is done and the trip is under way.';
  return 'Planning is done.';
}

/** The step tracker's short names, one per planning status, in stepLine's order. */
const STEP_LABELS: Record<(typeof PLANNING_STATUSES)[number], string> = {
  draft: 'Draft',
  collecting_preferences: 'Preferences',
  ready_for_recommendation: 'Ready',
  shortlisted: 'Shortlist',
  packages_proposed: 'Packages',
  package_selected: 'Package chosen',
  itinerary_proposed: 'Day plan',
};

export type StepState = 'done' | 'current' | 'todo';

/**
 * The tracker's pills: the current one is stepLine's "Step N" (Maulik, 9 November:
 * one pill per planning status). A finalised trip has every step done. Null when
 * planning has stopped or ended (cancelled, in progress, completed): no tracker.
 */
export function planningSteps(status: TripStatus): { label: string; state: StepState }[] | null {
  const current = status === 'finalised' ? PLANNING_STATUSES.length : PLANNING.indexOf(status);
  if (current < 0) return null;
  return PLANNING_STATUSES.map((s, i) => ({
    label: STEP_LABELS[s],
    state: i < current ? 'done' : i === current ? 'current' : 'todo',
  }));
}

/** "2 of 3 members have submitted" (wireframe 06, note 1). */
export function progressText(submitted: number, active: number): string {
  return `${submitted} of ${active} ${active === 1 ? 'member has' : 'members have'} submitted`;
}

/** "Waiting for Meera.", "Waiting for Rohan and Meera.", "... and 2 others." */
export function waitingFor(names: string[]): string {
  if (names.length === 0) return 'Waiting for others to join.';
  const shown = names.slice(0, 3);
  const rest = names.length - shown.length;
  if (rest > 0) {
    return `Waiting for ${shown.join(', ')} and ${rest} ${rest === 1 ? 'other' : 'others'}.`;
  }
  if (shown.length === 1) return `Waiting for ${shown[0]}.`;
  return `Waiting for ${shown.slice(0, -1).join(', ')} and ${shown.at(-1)}.`;
}

/** "Meera has not submitted and will be left out of planning." (T3b, 0001 f) */
export function exclusionWarning(names: string[]): string {
  if (names.length === 0) return 'Everyone active has submitted.';
  const list =
    names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  const verb = names.length === 1 ? 'has' : 'have';
  return `${list} ${verb} not submitted and will be left out of planning.`;
}

/** S3-4: the dashboard callout at package_selected (step 6, wireframe 06). */
export function packageChosenLine(pkg: {
  label: string;
  totalInr: number;
  perPersonInr: number;
}): string {
  return `${pkg.label} package chosen: ${formatInr(pkg.totalInr)} for the group, about ${formatInr(pkg.perPersonInr)} each (estimate). The day plan comes next.`;
}

/** S3-4: the dashboard callout at packages_proposed (step 5). */
export const PACKAGES_NEXT_STEP = 'Compare the packages and say which work for you.';
