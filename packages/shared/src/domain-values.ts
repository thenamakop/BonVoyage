// Kept separate so PLANNING_STATUSES can slice a plain tuple.
export const TRIP_STATUSES = [
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
] as const;
