import { z } from 'zod';
import { ITINERARY_ITEM_KINDS, ITINERARY_STATUSES } from '../domain';
import { PoiCategory } from '../vocab';
import { TRANSPORT_MODES } from '../vocab';
import { HHMM, IsoDate } from '../itinerary';

// S3-6 / 0005 f: the stored day plan as every member sees it. It holds facts
// and labels only — never a member name, budget or id.

export const ItineraryItemView = z.object({
  id: z.string(),
  day: z.number().int(),
  position: z.number().int(),
  start: HHMM.nullable(),
  end: HHMM.nullable(),
  kind: z.enum(ITINERARY_ITEM_KINDS),
  place: z
    .object({
      key: z.string(),
      name: z.string(),
      category: PoiCategory,
      entryFeeInr: z.number().int(),
    })
    .nullable(),
  legId: z.enum(['onward', 'return']).nullable(),
  note: z.string().nullable(),
  verified: z.boolean(),
  unverifiedReason: z.string().nullable(),
});
export type ItineraryItemView = z.infer<typeof ItineraryItemView>;

export const ItineraryLegView = z.object({
  id: z.enum(['onward', 'return']),
  mode: z.enum(TRANSPORT_MODES),
  depart: HHMM,
  arrive: HHMM,
  /** Times the engine planned; the screen marks them planned, not booked. */
  plannedTimes: z.boolean(),
});
export type ItineraryLegView = z.infer<typeof ItineraryLegView>;

export const ItineraryView = z.object({
  id: z.string(),
  version: z.number().int(),
  status: z.enum(ITINERARY_STATUSES),
  model: z.string().nullable(),
  source: z.enum(['catalogue', 'model']),
  generatedAt: z.string(),
  summary: z.string().nullable(),
  reasons: z.array(z.string()),
  legs: z.array(ItineraryLegView),
  days: z.array(
    z.object({ day: z.number().int(), date: IsoDate, items: z.array(ItineraryItemView) }),
  ),
  packageLabel: z.string(),
});
export type ItineraryView = z.infer<typeof ItineraryView>;

export const ItineraryResponse = z.object({ itinerary: ItineraryView.nullable() });
export type ItineraryResponse = z.infer<typeof ItineraryResponse>;
