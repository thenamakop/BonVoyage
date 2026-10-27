import { z } from 'zod';
import { Activity, PoiCategory, TransportMode } from './vocab';
import { ITINERARY_ITEM_KINDS, StayTier } from './domain';

export const HHMM = z.string().regex(/^\d{2}:\d{2}$/);
export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const LegId = z.enum(['onward', 'return']);

export const FactSheet = z.object({
  trip: z.object({
    nights: z.number().int().positive(),
    startDate: IsoDate,
    endDate: IsoDate,
    groupSize: z.number().int().min(2).max(8),
    interests: z.array(Activity),
  }),
  destination: z.object({
    slug: z.string().min(1),
    name: z.string().min(1),
    state: z.string().min(1),
  }),
  legs: z.array(
    z.object({
      id: LegId,
      mode: TransportMode,
      from: z.string().min(1),
      to: z.string().min(1),
      depart: HHMM,
      arrive: HHMM,
      durationMinutes: z.number().int().positive(),
      farePerPersonInr: z.number().int().nonnegative(),
    }),
  ),
  stay: z.object({
    tier: StayTier,
    perRoomPerNightInr: z.number().int().positive(),
    rooms: z.number().int().positive(),
  }),
  pois: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      category: PoiCategory,
      typicalMinutes: z.number().int().positive(),
      openTime: HHMM.nullable(),
      closeTime: HHMM.nullable(),
      closedDays: z.array(z.number().int().min(0).max(6)),
      entryFeeInr: z.number().int().nonnegative(),
    }),
  ),
  costs: z.object({
    totalInr: z.number().int().nonnegative(),
    perPersonInr: z.number().int().nonnegative(),
    items: z.array(
      z.object({
        category: z.string().min(1),
        amountInr: z.number().int().nonnegative(),
      }),
    ),
  }),
  limits: z.object({
    maxDayHours: z.number().positive(),
  }),
});
export type FactSheet = z.infer<typeof FactSheet>;

export const ItineraryItem = z.object({
  start: HHMM,
  end: HHMM,
  kind: z.enum(ITINERARY_ITEM_KINDS),
  poiId: z.string().optional(),
  legId: LegId.optional(),
  note: z.string().max(200),
});
export type ItineraryItem = z.infer<typeof ItineraryItem>;

export const ItineraryOutput = z.object({
  days: z.array(
    z.object({
      day: z.number().int().min(1),
      date: IsoDate,
      items: z.array(ItineraryItem),
    }),
  ),
  summary: z.string().max(600),
  reasons: z.array(z.string().max(200)).min(1).max(5),
});
export type ItineraryOutput = z.infer<typeof ItineraryOutput>;
