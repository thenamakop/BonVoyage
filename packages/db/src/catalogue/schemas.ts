import { z } from 'zod';
import {
  ACTIVITIES,
  CLIMATES,
  DESTINATION_TYPES,
  POI_CATEGORIES,
  REVIEW_STATUSES,
  TRANSPORT_MODES,
} from '@bonvoyage/shared';

// S0-4: one zod schema per catalogue row type. Raw CSV cells are strings;
// each schema coerces and validates them. Line-level rules that span files
// live in checks.ts.

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const cell = z.string().transform((s) => s.trim());

const slugCell = cell.pipe(z.string().regex(SLUG, 'expected kebab-case slug'));
const nameCell = cell.pipe(z.string().min(1, 'required'));

// A cell that may be empty: "" becomes undefined.
const optionalCell = cell.transform((s) => (s === '' ? undefined : s));

const intCell = cell.pipe(z.string().regex(/^\d+$/, 'expected a whole number').transform(Number));
const optionalInt = (max?: number) =>
  optionalCell.pipe(
    z
      .string()
      .regex(/^\d+$/, 'expected a whole number')
      .transform(Number)
      .pipe(max === undefined ? z.number().int().min(0) : z.number().int().min(0).max(max))
      .optional(),
  );

const latCell = cell.pipe(
  z
    .string()
    .regex(/^-?\d+(\.\d+)?$/, 'expected a number')
    .transform(Number)
    .pipe(z.number().min(6.0, 'outside India').max(37.6, 'outside India')),
);
const lngCell = cell.pipe(
  z
    .string()
    .regex(/^-?\d+(\.\d+)?$/, 'expected a number')
    .transform(Number)
    .pipe(z.number().min(68.0, 'outside India').max(97.5, 'outside India')),
);

const listCell = <T extends string>(allowed: readonly T[]) =>
  cell
    .transform((s) => s.split('|').map((v) => v.trim()))
    .pipe(
      z
        .array(z.enum(allowed as [T, ...T[]]))
        .min(1)
        .refine((a) => new Set(a).size === a.length, 'duplicate values in list'),
    );

const monthsCell = cell
  .transform((s) => s.split('|').map((v) => v.trim()))
  .pipe(
    z
      .array(
        z
          .string()
          .regex(/^\d{1,2}$/, 'expected a month number')
          .transform(Number)
          .pipe(z.number().int().min(1).max(12)),
      )
      .min(1, 'best_months must not be empty')
      .refine((a) => new Set(a).size === a.length, 'duplicate months'),
  );

const timeCell = optionalCell.pipe(z.string().regex(TIME, 'expected HH:MM').optional());
const daysCell = optionalCell.pipe(
  z
    .string()
    .transform((s) => s.split('|').map((v) => v.trim()))
    .pipe(
      z
        .array(
          z
            .string()
            .regex(/^[0-6]$/, 'expected a weekday 0-6')
            .transform(Number),
        )
        .min(1)
        .refine((a) => new Set(a).size === a.length, 'duplicate days'),
    )
    .optional(),
);

const urlCell = optionalCell.pipe(
  z
    .string()
    .refine((s) => /^https:\/\/\S+$/.test(s), 'source_url must be an https URL')
    .optional(),
);

// Not-after-today check needs the date; the caller passes it in.
export const makeDateCell = (today: string) =>
  cell.pipe(
    z
      .string()
      .regex(DATE, 'expected YYYY-MM-DD')
      .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), 'not a real date')
      .refine((s) => s <= today, 'collected_on is in the future'),
  );
const optionalDateCell = (today: string) => optionalCell.pipe(makeDateCell(today).optional());

const statusCell = cell.pipe(z.enum(REVIEW_STATUSES));

// A verified row must cite an https source; a draft may leave it empty.
const sourceCheck = (
  row: { source_url?: string; review_status: string },
  ctx: z.RefinementCtx,
): void => {
  if (row.review_status === 'verified' && !row.source_url) {
    ctx.addIssue({
      code: 'custom',
      path: ['source_url'],
      message: 'a verified row must cite an https source_url',
    });
  }
};

export const hubRow = (today: string) =>
  z
    .object({
      slug: slugCell,
      name: nameCell,
      state: nameCell,
      lat: latCell,
      lng: lngCell,
      source_url: urlCell,
      collected_on: makeDateCell(today),
      review_status: statusCell,
    })
    .superRefine(sourceCheck);
export type HubRow = z.infer<ReturnType<typeof hubRow>>;

const COST_COLUMNS = [
  'stay_budget_inr',
  'stay_mid_inr',
  'stay_premium_inr',
  'food_per_day_inr',
  'local_per_day_inr',
] as const;

export const destinationRow = (today: string) =>
  z
    .object({
      slug: slugCell,
      name: nameCell,
      state: nameCell,
      lat: latCell,
      lng: lngCell,
      types: listCell(DESTINATION_TYPES),
      activities: listCell(ACTIVITIES),
      climate: cell.pipe(z.enum(CLIMATES)),
      best_months: monthsCell,
      min_nights: intCell.pipe(z.number().int().min(1).max(14)),
      stay_budget_inr: optionalInt(),
      stay_mid_inr: optionalInt(),
      stay_premium_inr: optionalInt(),
      food_per_day_inr: optionalInt(),
      local_per_day_inr: optionalInt(),
      source_url: urlCell,
      collected_on: makeDateCell(today),
      review_status: statusCell,
      cost_source_url: urlCell,
      cost_collected_on: optionalDateCell(today),
      cost_review_status: statusCell,
    })
    .superRefine(sourceCheck)
    .superRefine((row, ctx) => {
      if (row.cost_review_status === 'verified' && !row.cost_source_url) {
        ctx.addIssue({
          code: 'custom',
          path: ['cost_source_url'],
          message: 'a verified cost must cite an https cost_source_url',
        });
      }
      if (row.cost_review_status === 'draft') return;
      for (const col of COST_COLUMNS) {
        if (row[col] === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: [col],
            message: 'cost columns may be empty only while cost_review_status is draft',
          });
        }
      }
    });
export type DestinationRow = z.infer<ReturnType<typeof destinationRow>>;

export const fareRow = (today: string) =>
  z
    .object({
      origin_hub: slugCell,
      destination_slug: slugCell,
      mode: cell.pipe(z.enum(TRANSPORT_MODES)),
      fare_per_person_inr: optionalInt(),
      duration_minutes: intCell.pipe(z.number().int().min(10).max(3000)),
      distance_km: intCell.pipe(z.number().int().min(1).max(3000)),
      source_url: urlCell,
      collected_on: makeDateCell(today),
      review_status: statusCell,
    })
    .superRefine(sourceCheck)
    .superRefine((row, ctx) => {
      if (row.mode === 'car') {
        if (row.fare_per_person_inr !== undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['fare_per_person_inr'],
            message: 'car rows never carry fare_per_person_inr; cost-rules.json prices the car',
          });
        }
      } else if (row.review_status === 'verified' && row.fare_per_person_inr === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['fare_per_person_inr'],
          message: 'bus and train rows need fare_per_person_inr once verified',
        });
      }
    });
export type FareRow = z.infer<ReturnType<typeof fareRow>>;

export const poiRow = (today: string) =>
  z
    .object({
      destination_slug: slugCell,
      poi_key: slugCell,
      name: nameCell,
      category: cell.pipe(z.enum(POI_CATEGORIES)),
      typical_minutes: intCell.pipe(z.number().int().min(15).max(600)),
      open_time: timeCell,
      close_time: timeCell,
      closed_days: daysCell,
      entry_fee_inr: intCell.pipe(z.number().int().min(0)),
      lat: latCell,
      lng: lngCell,
      source_url: urlCell,
      collected_on: makeDateCell(today),
      review_status: statusCell,
    })
    .superRefine(sourceCheck);
export type PoiRow = z.infer<ReturnType<typeof poiRow>>;

const costRuleEntry = (today: string) =>
  z
    .object({
      value: z.number().positive(),
      unit: z.string().min(1),
      source_url: z
        .string()
        .regex(/^https:\/\/\S+$/, 'expected an https URL')
        .or(z.literal('')),
      collected_on: makeDateCell(today),
      review_status: z.enum(REVIEW_STATUSES),
    })
    .superRefine((entry, ctx) =>
      sourceCheck(
        { source_url: entry.source_url || undefined, review_status: entry.review_status },
        ctx,
      ),
    );

export const costRulesFile = (today: string) =>
  z.object({
    fuel_price_inr_per_litre: costRuleEntry(today),
    car_km_per_litre: costRuleEntry(today),
    toll_inr_per_km: costRuleEntry(today),
    persons_per_car: costRuleEntry(today),
    car_rental_inr_per_day: costRuleEntry(today),
  });
export type CostRules = z.infer<ReturnType<typeof costRulesFile>>;

export const HEADERS = {
  hubs: 'slug,name,state,lat,lng,source_url,collected_on,review_status',
  destinations:
    'slug,name,state,lat,lng,types,activities,climate,best_months,min_nights,stay_budget_inr,stay_mid_inr,stay_premium_inr,food_per_day_inr,local_per_day_inr,source_url,collected_on,review_status,cost_source_url,cost_collected_on,cost_review_status',
  fares:
    'origin_hub,destination_slug,mode,fare_per_person_inr,duration_minutes,distance_km,source_url,collected_on,review_status',
  pois: 'destination_slug,poi_key,name,category,typical_minutes,open_time,close_time,closed_days,entry_fee_inr,lat,lng,source_url,collected_on,review_status',
} as const;
