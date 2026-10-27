import type { FactSheet } from '@bonvoyage/shared';
import type { PlanInput, TripPlan } from './plan';

// 0005 f: the fact sheet is everything the model or the templates may use;
// every number on it must come from the catalogue or the package cost lines.

export interface FactSheetInput {
  plan: TripPlan;
  input: PlanInput;
  originName: string;
  destination: { slug: string; name: string; state: string };
  groupSize: number;
  rooms: number;
  perRoomPerNightInr: number;
  farePerPersonInr: { onward: number; return: number };
  costs: {
    totalInr: number;
    perPersonInr: number;
    items: { category: string; amountInr: number }[];
  };
}

export function buildFactSheet({
  plan,
  input,
  originName,
  destination,
  groupSize,
  rooms,
  perRoomPerNightInr,
  farePerPersonInr,
  costs,
}: FactSheetInput): FactSheet {
  const lastDay = plan.days.at(-1);
  if (!lastDay) throw new Error('plan has no days');
  return {
    trip: {
      nights: input.nights,
      startDate: input.startDate,
      endDate: lastDay.date,
      groupSize,
      interests: [...input.groupInterests],
    },
    destination,
    legs: plan.legs.map((leg) => ({
      id: leg.id,
      mode: leg.mode,
      from: leg.id === 'onward' ? originName : destination.name,
      to: leg.id === 'onward' ? destination.name : originName,
      depart: leg.depart,
      arrive: leg.arrive,
      durationMinutes: leg.durationMinutes,
      farePerPersonInr: leg.id === 'onward' ? farePerPersonInr.onward : farePerPersonInr.return,
    })),
    stay: {
      tier: input.stayTier,
      perRoomPerNightInr,
      rooms,
    },
    pois: input.places.map((place) => ({
      id: place.key,
      name: place.name,
      category: place.category,
      typicalMinutes: place.typicalMinutes,
      openTime: place.openTime,
      closeTime: place.closeTime,
      closedDays: [...place.closedDays],
      entryFeeInr: place.entryFeeInr,
    })),
    costs,
    limits: { maxDayHours: 15 },
  };
}
