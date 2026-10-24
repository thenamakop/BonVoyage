import type { Activity, Climate, ClimatePreference, DestinationType } from '@bonvoyage/shared';

export interface MemberInput {
  memberId: string;
  types: DestinationType[];
  activities: Activity[];
  climate: ClimatePreference;
  likedPastTypes: DestinationType[];
  budgetMinInr: number;
  budgetMaxInr: number;
  dateStart: string;
  dateEnd: string;
}

export interface DestinationInput {
  id: string;
  slug: string;
  types: DestinationType[];
  activities: Activity[];
  climate: Climate;
  bestMonths: number[];
  minNights: number;
}

export interface Weights {
  alpha: number;
  beta: number;
  gamma: number;
}

export interface GroupFit {
  mean: number;
  min: number;
  sd: number;
  gfs: number;
}

export interface RankedDestination extends GroupFit {
  destinationId: string;
  slug: string;
  max: number;
  memberScores: { memberId: string; score: number }[];
}

export interface MatchExplanation {
  metTypes: DestinationType[];
  missedTypes: DestinationType[];
  metActivities: Activity[];
  missedActivities: Activity[];
  climateMet: boolean;
}

export interface ValueCount<T extends string> {
  value: T;
  count: number;
}

export interface GroupSummary {
  memberCount: number;
  climateMetCount: number;
  sharedTypes: ValueCount<DestinationType>[];
  sharedActivities: ValueCount<Activity>[];
}
