import { z } from 'zod';
import { RecommendationKind, TripStatus } from '../domain';
import { Provenance } from '../provenance';
import { Activity, ClimatePreference, DestinationType, TransportMode } from '../vocab';

// S2-6 recommendation contracts (decision 0004). Group views carry counts and
// values shared by two or more members only (0004 i); a member's own meets and
// misses travel only in `mine`. Group budget figures are rounded to ₹500 so a
// response never carries another member's exact budget limit, and below 3
// contributing members the figures members' limits set are left out (D1, #116).

const ValueCountOf = <T extends z.ZodType<string>>(value: T) =>
  z.object({ value, count: z.number().int() });

export const ConstraintId = z.enum(['F1', 'F2', 'F3', 'F4', 'F5']);
export type ConstraintId = z.infer<typeof ConstraintId>;

export const GroupConflict = z.object({
  code: z.enum(['NO_COMMON_WINDOW', 'WINDOW_TOO_SHORT', 'BUDGET_BANDS_DISJOINT']),
  blocking: z.boolean(),
});
export type GroupConflict = z.infer<typeof GroupConflict>;

export const GroupProfileReady = z.object({
  ready: z.literal(true),
  memberCount: z.number().int(),
  commonWindow: z.object({ start: z.string(), end: z.string(), days: z.number().int() }).nullable(),
  windowFits: z.boolean(),
  /**
   * Per person: the minimum rounded up and the maximum down to ₹500, shown for
   * 3 or more contributing members; below that only `overlaps` is given.
   */
  budgetBand: z.object({
    /** D1, #116: null below MIN_MEMBERS_FOR_RANGE contributors. */
    minInr: z.number().int().nullable(),
    /** D1, #116: null below MIN_MEMBERS_FOR_RANGE contributors. */
    maxInr: z.number().int().nullable(),
    overlaps: z.boolean(),
  }),
  /** The lowest member maximum, rounded down to ₹500. D1, #116: null below MIN_MEMBERS_FOR_RANGE contributors. */
  perPersonCapInr: z.number().int().nullable(),
  /**
   * Exact when the trip budget sets it (always shown: the trip budget is
   * public); n x perPersonCapInr when members' maxima do. D1, #116: null below
   * MIN_MEMBERS_FOR_RANGE contributors when members' maxima set it.
   */
  groupCapInr: z.number().int().nullable(),
  typeVotes: z.array(ValueCountOf(DestinationType)),
  activityVotes: z.array(ValueCountOf(Activity)),
  climateVotes: z.array(ValueCountOf(ClimatePreference)),
  /** Distinct types, activities and climates chosen by exactly one member (not listed). */
  otherInterestCount: z.number().int(),
  conflicts: z.array(GroupConflict),
});
export type GroupProfileReady = z.infer<typeof GroupProfileReady>;

/** GET /api/trips/:id/group-profile. Not ready until two members have submitted. */
export const GroupProfileResponse = z.discriminatedUnion('ready', [
  z.object({ ready: z.literal(false), memberCount: z.number().int() }),
  GroupProfileReady,
]);
export type GroupProfileResponse = z.infer<typeof GroupProfileResponse>;

const Unit = z.enum(['km', 'nights', 'months', 'inr']);
export const DiagnosticFailure = z.discriminatedUnion('id', [
  z.object({
    id: z.enum(['F1', 'F2', 'F4']),
    limit: z.number(),
    actual: z.number(),
    relaxation: z.number(),
    relative: z.number(),
    unit: Unit,
  }),
  z.object({
    id: z.literal('F5'),
    /** D1, #116: null below MIN_MEMBERS_FOR_RANGE contributors when members' maxima set the cap. */
    limit: z.number().nullable(),
    actual: z.number(),
    /** D1, #116: null below MIN_MEMBERS_FOR_RANGE contributors when members' maxima set the cap. */
    relaxation: z.number().nullable(),
    /** D1, #116: null below MIN_MEMBERS_FOR_RANGE contributors when members' maxima set the cap. */
    relative: z.number().nullable(),
    unit: Unit,
  }),
]);
export type DiagnosticFailure = z.infer<typeof DiagnosticFailure>;

export const DiagnosticEvaluation = z.object({
  slug: z.string(),
  name: z.string(),
  estimatedCostInr: z.number().int(),
  cheapestMode: TransportMode,
  failures: z.array(DiagnosticFailure),
});
export type DiagnosticEvaluation = z.infer<typeof DiagnosticEvaluation>;

export const Suggestion = z.discriminatedUnion('constraint', [
  z.object({ constraint: z.literal('F1'), newRadiusKm: z.number(), unlocks: z.array(z.string()) }),
  z.object({ constraint: z.literal('F2'), newNights: z.number(), unlocks: z.array(z.string()) }),
  z.object({ constraint: z.literal('F4'), shiftMonths: z.number(), unlocks: z.array(z.string()) }),
  z.object({
    constraint: z.literal('F5'),
    newGroupCapInr: z.number(),
    capSource: z.enum(['trip', 'members']),
    newPerPersonMaxInr: z.number().optional(),
    unlocks: z.array(z.string()),
  }),
]);
export type Suggestion = z.infer<typeof Suggestion>;

export const RecommendationDiagnostic = z.object({
  feasible: z.array(z.string()),
  nearMisses: z.array(DiagnosticEvaluation),
  alternatives: z.array(DiagnosticEvaluation),
  suggestions: z.array(Suggestion),
  /** Active destinations left out because their costs are not in the catalogue yet. */
  incomplete: z.array(z.string()),
});
export type RecommendationDiagnostic = z.infer<typeof RecommendationDiagnostic>;

export const RecommendationRun = z.object({
  id: z.string(),
  round: z.number().int(),
  kind: RecommendationKind,
  createdAt: z.string(),
  weights: z.object({ alpha: z.number(), beta: z.number(), gamma: z.number() }),
  memberCount: z.number().int(),
  feasibleCount: z.number().int(),
  bindingConstraint: ConstraintId.nullable(),
  /** The best mean score is below 0.25: the shortlist fits the hard limits but not the tastes. */
  weakMatch: z.boolean(),
  /**
   * R17: the order gives more weight to members whose wishes earlier shortlists met
   * less. Only this flag is sent; never who, a weight, a deficit or lambda (E1).
   */
  favoursLessServed: z.boolean(),
  /** 0004 e: active destinations left out because their costs are missing, on every run. */
  incomplete: z.array(z.string()),
  diagnostic: RecommendationDiagnostic.nullable(),
  groupProfile: GroupProfileReady,
});
export type RecommendationRun = z.infer<typeof RecommendationRun>;

export const MyMatch = z.object({
  /** The caller's own match score out of 10, one decimal. */
  score10: z.number(),
  metTypes: z.array(DestinationType),
  missedTypes: z.array(DestinationType),
  metActivities: z.array(Activity),
  missedActivities: z.array(Activity),
  climateMet: z.boolean(),
});
export type MyMatch = z.infer<typeof MyMatch>;

export const RecommendationItem = z.object({
  rank: z.number().int(),
  destination: z.object({ slug: z.string(), name: z.string(), state: z.string() }),
  gfs: z.number(),
  mean: z.number(),
  min: z.number(),
  sd: z.number(),
  /** Estimated whole-group cost in rupees; always shown as an estimate. */
  estimatedCostInr: z.number().int(),
  perPersonInr: z.number().int(),
  cheapestMode: TransportMode,
  distanceKm: z.number().int(),
  distanceProvenance: Provenance,
  group: z.object({
    memberCount: z.number().int(),
    climateMetCount: z.number().int(),
    sharedTypes: z.array(ValueCountOf(DestinationType)),
    sharedActivities: z.array(ValueCountOf(Activity)),
    /** Null when the run has fewer than 3 members. */
    lowestScore10: z.number().nullable(),
    highestScore10: z.number().nullable(),
  }),
  /** Null for anyone who was not part of the run. */
  mine: MyMatch.nullable(),
});
export type RecommendationItem = z.infer<typeof RecommendationItem>;

/** GET /api/trips/:id/recommendations/latest */
export const LatestRecommendationResponse = z.object({
  run: RecommendationRun.nullable(),
  items: z.array(RecommendationItem),
});
export type LatestRecommendationResponse = z.infer<typeof LatestRecommendationResponse>;

/** POST /api/trips/:id/recommendations: the new run plus the transition it fired. */
export const RequestRecommendationsResponse = LatestRecommendationResponse.extend({
  transition: z.object({ transitionId: z.string(), to: TripStatus }),
});
export type RequestRecommendationsResponse = z.infer<typeof RequestRecommendationsResponse>;

/** POST /api/trips/:id/recommendations takes an empty object. */
export const RequestRecommendationsInput = z.strictObject({});
export type RequestRecommendationsInput = z.infer<typeof RequestRecommendationsInput>;

/** POST /api/trips/:id/destination */
export const ChooseDestinationInput = z.strictObject({
  destinationSlug: z
    .string()
    .trim()
    .min(1, 'Choose a destination from the shortlist.')
    .max(100, 'Choose a destination from the shortlist.'),
});
export type ChooseDestinationInput = z.infer<typeof ChooseDestinationInput>;

export const LatestRecommendationSummary = z.object({
  round: z.number().int(),
  kind: RecommendationKind,
  feasibleCount: z.number().int(),
  createdAt: z.string(),
});
export type LatestRecommendationSummary = z.infer<typeof LatestRecommendationSummary>;
