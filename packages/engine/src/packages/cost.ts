import type { CostCategory, Provenance, StayTier, TransportMode } from '@bonvoyage/shared';
import { TRANSPORT_MODE_LABELS } from '@bonvoyage/shared';
import { carSharePerPersonOneWay, type CostRules } from '../costs/costs';
import { planDays, type PlannerPlace, type TripPlan } from '../itinerary/plan';
import type { Activity } from '@bonvoyage/shared';
import { addDaysUtc } from '../itinerary/plan';

// 0005 c and d: the costed lines of one package. Money rounds up to whole
// rupees once per line (P3); a total is the sum of rounded lines.

export interface ModeFare {
  farePerPersonInr: number;
  durationMinutes: number;
  verified: boolean;
}

export interface PackageModes {
  bus: ModeFare | null;
  train: ModeFare | null;
  car: { km: number; durationMinutes: number; verified: boolean };
}

export interface StayRates {
  budget: number | null;
  mid: number | null;
  premium: number | null;
}

export interface PackageInput {
  n: number;
  nights: number;
  startDate: string;
  groupCapInr: number;
  originName: string;
  destinationName: string;
  hubSlug: string;
  destinationSlug: string;
  modes: PackageModes;
  costRules: CostRules & { verified: boolean };
  stay: StayRates;
  costVerified: boolean;
  foodPerDayInr: number;
  localPerDayInr: number;
  places: PlannerPlace[];
  groupInterests: Activity[];
}

export interface PackageSpec {
  label: string;
  mode: TransportMode;
  tier: StayTier;
}

export interface CostLine {
  category: CostCategory;
  label: string;
  amountInr: number;
  provenance: Provenance;
  sourceRef: string;
}

export interface PackageDraft {
  label: string;
  transportMode: TransportMode;
  stayTier: StayTier;
  rooms: number;
  startDate: string;
  endDate: string;
  lines: CostLine[];
  totalInr: number;
  perPersonInr: number;
  overBudget: boolean;
  overByInr: number;
  scheduledPlaceKeys: string[];
  plan: TripPlan;
}

const TIER_LABEL: Record<StayTier, string> = {
  budget: 'Budget',
  mid: 'Mid-range',
  premium: 'Premium',
};

function curated(verified: boolean): Provenance {
  return verified ? 'curated' : 'estimated';
}

// The fare a person pays one way for a mode: the fare row for bus and train,
// the 0004 d car share (which already includes half the rental) for car.
export function farePerPerson(input: PackageInput, mode: TransportMode): number | null {
  if (mode === 'car') {
    return carSharePerPersonOneWay({
      km: input.modes.car.km,
      n: input.n,
      nights: input.nights,
      rules: input.costRules,
    });
  }
  const fare = input.modes[mode];
  return fare === null ? null : fare.farePerPersonInr;
}

export function durationMinutes(input: PackageInput, mode: TransportMode): number | null {
  if (mode === 'car') return input.modes.car.durationMinutes;
  const fare = input.modes[mode];
  return fare === null ? null : fare.durationMinutes;
}

function transportVerified(input: PackageInput, mode: TransportMode): boolean {
  if (mode === 'car') return input.modes.car.verified && input.costRules.verified;
  const fare = input.modes[mode];
  return fare !== null && fare.verified;
}

export function modeAvailable(input: PackageInput, mode: TransportMode): boolean {
  return mode === 'car' || input.modes[mode] !== null;
}

// Returns null when the (mode, tier) pair cannot be costed: an unavailable
// mode or a missing stay rate. Never invent a rate (0005 b).
export function costPackage(input: PackageInput, spec: PackageSpec): PackageDraft | null {
  const rate = input.stay[spec.tier];
  const fare = farePerPerson(input, spec.mode);
  const minutes = durationMinutes(input, spec.mode);
  if (rate === null || fare === null || minutes === null) return null;

  const rooms = Math.ceil(input.n / 2);
  const days = input.nights + 1;
  const endDate = addDaysUtc(input.startDate, input.nights);
  const modeLabel = TRANSPORT_MODE_LABELS[spec.mode];
  const fareRef = `fares:${input.hubSlug}/${input.destinationSlug}/${spec.mode}`;
  const legProvenance = curated(transportVerified(input, spec.mode));
  const stayProvenance = curated(input.costVerified);

  const plan = planDays({
    startDate: input.startDate,
    nights: input.nights,
    onward: { mode: spec.mode, durationMinutes: minutes },
    ret: { mode: spec.mode, durationMinutes: minutes },
    stayTier: spec.tier,
    places: input.places,
    groupInterests: input.groupInterests,
  });
  const scheduled = input.places.filter((place) => plan.scheduledPlaceKeys.includes(place.key));
  const feeSum = scheduled.reduce((sum, place) => sum + place.entryFeeInr, 0);
  const activitiesVerified = scheduled.every((place) => place.verified);

  const lines: CostLine[] = [
    {
      category: 'onward',
      label: `${modeLabel}, ${input.n} people, one way`,
      amountInr: Math.ceil(input.n * fare),
      provenance: legProvenance,
      sourceRef: spec.mode === 'car' ? `${fareRef},cost-rules` : fareRef,
    },
    {
      category: 'return',
      label: `${modeLabel}, ${input.n} people, return`,
      amountInr: Math.ceil(input.n * fare),
      provenance: legProvenance,
      sourceRef: spec.mode === 'car' ? `${fareRef},cost-rules` : fareRef,
    },
    {
      category: 'stay',
      label: `${TIER_LABEL[spec.tier]} stay, ${rooms} rooms x ${input.nights} nights`,
      amountInr: Math.ceil(rooms * input.nights * rate),
      provenance: stayProvenance,
      sourceRef: `destinations:${input.destinationSlug}`,
    },
    {
      category: 'food',
      label: `Food, ${input.n} people x ${days} days`,
      amountInr: Math.ceil(input.n * days * input.foodPerDayInr),
      provenance: stayProvenance,
      sourceRef: `destinations:${input.destinationSlug}`,
    },
    {
      category: 'activities',
      label: `Entry fees, ${input.n} people, ${scheduled.length} places`,
      amountInr: Math.ceil(input.n * feeSum),
      provenance: curated(activitiesVerified),
      sourceRef: `pois:${plan.scheduledPlaceKeys.join(',') || 'none'}`,
    },
    {
      category: 'local',
      label: `Local travel, ${input.n} people x ${days} days`,
      amountInr: Math.ceil(input.n * days * input.localPerDayInr),
      provenance: stayProvenance,
      sourceRef: `destinations:${input.destinationSlug}`,
    },
  ];

  const totalInr = lines.reduce((sum, line) => sum + line.amountInr, 0);
  return {
    label: spec.label,
    transportMode: spec.mode,
    stayTier: spec.tier,
    rooms,
    startDate: input.startDate,
    endDate,
    lines,
    totalInr,
    perPersonInr: Math.ceil(totalInr / input.n),
    overBudget: totalInr > input.groupCapInr,
    overByInr: Math.max(0, totalInr - input.groupCapInr),
    scheduledPlaceKeys: plan.scheduledPlaceKeys,
    plan,
  };
}
