import type { TripStatus } from '@bonvoyage/shared';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

// Colour is never the only signal: every badge also shows the status word.
const tones: Record<TripStatus, BadgeTone> = {
  draft: 'neutral',
  collecting_preferences: 'info',
  ready_for_recommendation: 'info',
  shortlisted: 'info',
  packages_proposed: 'warning',
  package_selected: 'warning',
  itinerary_proposed: 'warning',
  finalised: 'success',
  in_progress: 'success',
  completed: 'success',
  cancelled: 'danger',
};

export function statusTone(status: TripStatus): BadgeTone {
  return tones[status];
}
