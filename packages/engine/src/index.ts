export { ROAD_FACTOR, estimateRoadKm, haversineKm } from './geo';
export { jaccard, memberTypeWeights, weightedJaccard } from './scoring/similarity';
export { memberScore } from './scoring/member-score';
export { groupFit } from './scoring/group-fit';
export { sortRankedDestinations, rankDestinations } from './scoring/rank';
export { explainMatch, groupSummary } from './scoring/explain';
export { groupProfile } from './group/profile';
export type { GroupConflict, GroupProfile } from './group/profile';
export type {
  DestinationInput,
  GroupFit,
  GroupSummary,
  MatchExplanation,
  MemberInput,
  RankedDestination,
  ValueCount,
  Weights,
} from './scoring/types';
export { validateItinerary } from './itinerary/validate';
export type { ItemVerdict, ValidationError, ValidationResult } from './itinerary/validate';
export type { LatLng } from './geo';
export {
  ACTION_NAMES,
  DO_ACTIVITIES,
  ENTRY_ACTIONS,
  INTERNAL_TRANSITIONS,
  TRANSITIONS,
  TRIP_EVENTS,
  legalEvents,
  nextState,
} from './trip-state';
export type {
  ActionName,
  GuardContext,
  InternalRow,
  NextStateResult,
  TransitionRow,
  TripEvent,
} from './trip-state';
