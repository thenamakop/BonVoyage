import type { PoiCategory } from '@bonvoyage/shared';
import { groupProfile } from '../group/profile';
import type { MemberInput } from '../scoring/types';
import type { PackageInput } from '../packages/cost';
import { COST_RULE_KEYS } from './inputs';

export interface PackageSource {
  trip: { durationNights: number; budgetTotalInr: number; startDate?: string | null };
  members: MemberInput[];
  hub: { name: string; slug: string } | undefined;
  destination: {
    name: string;
    slug: string;
    stayBudgetInr: number | null;
    stayMidInr: number | null;
    stayPremiumInr: number | null;
    foodPerDayInr: number | null;
    localPerDayInr: number | null;
    costReviewStatus: string;
  };
  fares: readonly {
    mode: string;
    farePerPersonInr: number | null;
    distanceKm: number;
    durationMinutes: number;
    reviewStatus: string;
  }[];
  rules: readonly { key: string; value: number; verified: string }[];
  pois: readonly {
    poiKey: string;
    name: string;
    category: PoiCategory;
    typicalMinutes: number;
    openTime: string | null;
    closeTime: string | null;
    closedDays: number[];
    entryFeeInr: number;
    reviewStatus: string;
  }[];
}

export function toPackageInput({
  trip,
  members,
  hub,
  destination: dest,
  fares,
  rules,
  pois,
}: PackageSource): PackageInput {
  const profile = groupProfile(members, trip);
  const publicFare = (mode: string) => {
    const row = fares.find((f) => f.mode === mode);
    return row?.farePerPersonInr !== null && row?.farePerPersonInr !== undefined
      ? {
          farePerPersonInr: row.farePerPersonInr,
          durationMinutes: row.durationMinutes,
          verified: row.reviewStatus === 'verified',
        }
      : null;
  };
  const car = fares.find((f) => f.mode === 'car');
  const costRules = {
    fuelPriceInrPerLitre: 0,
    carKmPerLitre: 0,
    tollInrPerKm: 0,
    personsPerCar: 4,
    carRentalInrPerDay: 0,
  };
  for (const [field, key] of Object.entries(COST_RULE_KEYS) as [keyof typeof costRules, string][]) {
    const rule = rules.find((r) => r.key === key);
    if (rule) costRules[field] = rule.value;
  }
  return {
    n: members.length,
    nights: trip.durationNights,
    startDate: profile.commonWindow?.start ?? trip.startDate ?? '2026-11-01',
    groupCapInr: Math.min(trip.budgetTotalInr, members.length * profile.perPersonCapInr),
    originName: hub?.name ?? '',
    destinationName: dest.name,
    hubSlug: hub?.slug ?? '',
    destinationSlug: dest.slug,
    modes: {
      bus: publicFare('bus'),
      train: publicFare('train'),
      car: {
        km: car?.distanceKm ?? 0,
        durationMinutes: car?.durationMinutes ?? 0,
        verified: (car?.reviewStatus ?? 'draft') === 'verified',
      },
    },
    costRules: { ...costRules, verified: rules.every((r) => r.verified === 'verified') },
    stay: { budget: dest.stayBudgetInr, mid: dest.stayMidInr, premium: dest.stayPremiumInr },
    costVerified: dest.costReviewStatus === 'verified',
    foodPerDayInr: dest.foodPerDayInr ?? 0,
    localPerDayInr: dest.localPerDayInr ?? 0,
    places: pois.map((p) => ({
      key: `${dest.slug}/${p.poiKey}`,
      name: p.name,
      category: p.category,
      typicalMinutes: p.typicalMinutes,
      openTime: p.openTime,
      closeTime: p.closeTime,
      closedDays: p.closedDays,
      entryFeeInr: p.entryFeeInr,
      verified: p.reviewStatus === 'verified',
    })),
    groupInterests: profile.activityVotes.filter((v) => v.count >= 2).map((v) => v.value),
  };
}
