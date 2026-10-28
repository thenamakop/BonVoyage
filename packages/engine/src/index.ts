export { ROAD_FACTOR, estimateRoadKm, haversineKm } from './geo';
export { jaccard, memberTypeWeights, weightedJaccard } from './scoring/similarity';
export { memberScore } from './scoring/member-score';
export { groupFit } from './scoring/group-fit';
export { sortRankedDestinations, rankDestinations } from './scoring/rank';
export { explainMatch, groupSummary } from './scoring/explain';
export { groupProfile } from './group/profile';
export type { GroupConflict, GroupProfile } from './group/profile';
export {
  carSharePerPersonOneWay,
  cheapestOneWay,
  composeEstimate,
  estimatedGroupCost,
} from './costs/costs';
export type { CheapestOneWay, CostRules, OneWayFares } from './costs/costs';
export { capSource, windowDays } from './feasibility/context';
export { evaluateCandidate, monthShift, windowMonths } from './feasibility/evaluate';
export { buildDiagnostic } from './feasibility/diagnostic';
export type {
  CandidateFacts,
  ConstraintId,
  CostedDestination,
  Diagnostic,
  DiagnosticInput,
  EvaluatedConstraintId,
  Evaluation,
  Failure,
  FeasibilityContext,
  Suggestion,
} from './feasibility/types';
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
export { ACTIVITY_POI_CATEGORIES, groupInterestCategories } from './itinerary/interests';
export { addDaysUtc, placeFits, planDays, unusedPlacesFitting, weekdayOf } from './itinerary/plan';
export type {
  PlanDay,
  PlanInput,
  PlanItem,
  PlanLeg,
  PlannerPlace,
  TripPlan,
} from './itinerary/plan';
export { buildFactSheet } from './itinerary/fact-sheet';
export type { FactSheetInput } from './itinerary/fact-sheet';
export { costPackage, durationMinutes, farePerPerson, modeAvailable } from './packages/cost';
export type {
  CostLine,
  ModeFare,
  PackageDraft,
  PackageInput,
  PackageModes,
  PackageSpec,
  StayRates,
} from './packages/cost';
export {
  availableChoices,
  costablePackageCount,
  generatePackages,
  packagesNote,
} from './packages/generate';
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
