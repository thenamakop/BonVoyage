import { z } from 'zod';
import { TRIP_STATUSES } from './domain-values';

// Trip and domain enums (S0-5; RUNBOOK Appendix B, SRS Table 10).

export { TRIP_STATUSES } from './domain-values';
export const TripStatus = z.enum(TRIP_STATUSES);
export type TripStatus = z.infer<typeof TripStatus>;

// The UML composite state "Planning": the first seven trip statuses.
export const PLANNING_STATUSES = TRIP_STATUSES.slice(0, 7) as [
  (typeof TRIP_STATUSES)[0],
  (typeof TRIP_STATUSES)[1],
  (typeof TRIP_STATUSES)[2],
  (typeof TRIP_STATUSES)[3],
  (typeof TRIP_STATUSES)[4],
  (typeof TRIP_STATUSES)[5],
  (typeof TRIP_STATUSES)[6],
];
export const PlanningStatus = z.enum(PLANNING_STATUSES);
export type PlanningStatus = z.infer<typeof PlanningStatus>;

export const MEMBER_ROLES = ['organiser', 'member'] as const;
export const MemberRole = z.enum(MEMBER_ROLES);
export type MemberRole = z.infer<typeof MemberRole>;

export const MEMBER_STATUSES = ['active', 'excluded'] as const;
export const MemberStatus = z.enum(MEMBER_STATUSES);
export type MemberStatus = z.infer<typeof MemberStatus>;

export const INVITATION_STATUSES = ['active', 'revoked'] as const;
export const InvitationStatus = z.enum(INVITATION_STATUSES);
export type InvitationStatus = z.infer<typeof InvitationStatus>;

export const STAY_TIERS = ['budget', 'mid', 'premium'] as const;
export const StayTier = z.enum(STAY_TIERS);
export type StayTier = z.infer<typeof StayTier>;

export const COST_CATEGORIES = ['onward', 'return', 'stay', 'food', 'activities', 'local'] as const;
export const CostCategory = z.enum(COST_CATEGORIES);
export type CostCategory = z.infer<typeof CostCategory>;

export const DECISIONS = ['accept', 'modify', 'reject'] as const;
export const Decision = z.enum(DECISIONS);
export type Decision = z.infer<typeof Decision>;

export const PACKAGE_STATUSES = ['proposed', 'hidden', 'accepted'] as const;
export const PackageStatus = z.enum(PACKAGE_STATUSES);
export type PackageStatus = z.infer<typeof PackageStatus>;

export const ITINERARY_STATUSES = ['proposed', 'accepted', 'rejected', 'superseded'] as const;
export const ItineraryStatus = z.enum(ITINERARY_STATUSES);
export type ItineraryStatus = z.infer<typeof ItineraryStatus>;

export const ITINERARY_ITEM_KINDS = ['travel', 'stay', 'activity', 'meal', 'free'] as const;
export const ItineraryItemKind = z.enum(ITINERARY_ITEM_KINDS);
export type ItineraryItemKind = z.infer<typeof ItineraryItemKind>;

export const RECOMMENDATION_KINDS = ['shortlist', 'diagnostic'] as const;
export const RecommendationKind = z.enum(RECOMMENDATION_KINDS);
export type RecommendationKind = z.infer<typeof RecommendationKind>;
