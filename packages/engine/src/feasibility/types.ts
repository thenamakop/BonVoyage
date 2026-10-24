import type { DestinationInput } from '../scoring/types';
import type { CostRules } from '../costs/costs';
import type { Provenance } from '@bonvoyage/shared';
import type { GroupProfile } from '../group/profile';

export type ConstraintId = 'F1' | 'F2' | 'F3' | 'F4' | 'F5';
export type EvaluatedConstraintId = Exclude<ConstraintId, 'F3'>;

export interface FeasibilityContext {
  n: number;
  durationNights: number;
  radiusKm: number;
  groupCapInr: number;
  capSource: 'trip' | 'members';
  perPersonCapInr: number;
  commonWindow: { start: string; end: string };
}

export type CostedDestination = DestinationInput & {
  stayBudgetInr: number;
  foodPerDayInr: number;
  localPerDayInr: number;
};

export interface CandidateFacts {
  destination: CostedDestination;
  distanceKm: number;
  distanceProvenance: Provenance;
  fares: { busInr: number | null; trainInr: number | null };
  costRules: CostRules;
}

export interface Failure {
  id: EvaluatedConstraintId;
  limit: number;
  actual: number;
  relaxation: number;
  relative: number;
  unit: 'km' | 'nights' | 'months' | 'inr';
}

export interface Evaluation {
  destinationId: string;
  slug: string;
  feasible: boolean;
  estimatedGroupCostInr: number;
  cheapest: { inr: number; mode: 'bus' | 'train' | 'car' };
  failures: Failure[];
}

export type Suggestion =
  | { constraint: 'F1'; newRadiusKm: number; unlocks: string[] }
  | { constraint: 'F2'; newNights: number; unlocks: string[] }
  | { constraint: 'F4'; shiftMonths: number; unlocks: string[] }
  | {
      constraint: 'F5';
      newGroupCapInr: number;
      capSource: 'trip' | 'members';
      newPerPersonMaxInr?: number;
      unlocks: string[];
    };

export interface Diagnostic {
  feasibleCount: number;
  feasible: string[];
  nearMisses: Evaluation[];
  alternatives: Evaluation[];
  bindingConstraint: ConstraintId | null;
  suggestions: Suggestion[];
  incomplete: string[];
}

export interface DiagnosticInput {
  evaluations: readonly Evaluation[];
  ctx: FeasibilityContext;
  profile: Pick<GroupProfile, 'conflicts'>;
  incomplete: readonly string[];
}
