import { z } from 'zod';
import { TripStatus } from '../domain';
import { ACTIVITIES, CLIMATE_PREFERENCES, DESTINATION_TYPES, TRAVEL_STYLES } from '../vocab';

// Preference contracts (S1-4). A member's budget is PER PERSON for the whole
// trip (travel, stay, food and activities); the trip's budgetTotalInr is the
// group total. Scoring (docs/specs/scoring.md) reads every field here.

const unique = (values: readonly string[]) => new Set(values).size === values.length;

const isoDate = (message: string) =>
  z
    .string(message)
    .regex(/^\d{4}-\d{2}-\d{2}$/, message)
    .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), message);

const rupees = (missing: string, min: number, tooLow: string) =>
  z
    .number(missing)
    .int('Whole rupees only.')
    .min(min, tooLow)
    .max(10000000, 'Keep the budget under ₹1,00,00,000.');

export const PreferenceFields = z.object({
  destinationTypes: z
    .array(z.enum(DESTINATION_TYPES), 'Pick at least one kind of place.')
    .min(1, 'Pick at least one kind of place.')
    .max(10, 'Pick at most 10 kinds of place.')
    .refine(unique, 'Pick each kind of place only once.'),
  activities: z
    .array(z.enum(ACTIVITIES), 'Pick at least one activity.')
    .min(1, 'Pick at least one activity.')
    .max(14, 'Pick at most 14 activities.')
    .refine(unique, 'Pick each activity only once.'),
  climate: z.enum(CLIMATE_PREFERENCES, 'Choose a climate.'),
  travelStyle: z.enum(TRAVEL_STYLES, 'Choose a travel style.'),
  budgetMinInr: rupees(
    'Enter your minimum budget in rupees.',
    0,
    'The minimum cannot be negative.',
  ),
  budgetMaxInr: rupees(
    'Enter your maximum budget in rupees.',
    1,
    'The maximum must be at least ₹1.',
  ),
  dateStart: isoDate('Choose the first day you could travel.'),
  dateEnd: isoDate('Choose the last day you could travel.'),
});

const numbersValid = (v: unknown) =>
  PreferenceFields.pick({ budgetMinInr: true, budgetMaxInr: true }).safeParse(v).success;
const datesValid = (v: unknown) =>
  PreferenceFields.pick({ dateStart: true, dateEnd: true }).safeParse(v).success;

// The cross-field checks also run when other fields are still invalid, so the
// form shows "Maximum must be at least the minimum." alongside the rest.
export const PreferenceInput = PreferenceFields.refine((v) => v.budgetMaxInr >= v.budgetMinInr, {
  message: 'Maximum must be at least the minimum.',
  path: ['budgetMaxInr'],
  when: (payload) => numbersValid(payload.value),
}).refine((v) => v.dateEnd >= v.dateStart, {
  message: 'The last day must be on or after the first day.',
  path: ['dateEnd'],
  when: (payload) => datesValid(payload.value),
});
export type PreferenceInput = z.infer<typeof PreferenceInput>;

export const Preference = PreferenceFields.extend({ updatedAt: z.string() });
export type Preference = z.infer<typeof Preference>;

export const MyPreferenceResponse = z.object({
  preference: Preference.nullable(),
  submittedAt: z.string().nullable(),
});
export type MyPreferenceResponse = z.infer<typeof MyPreferenceResponse>;

export const SavePreferenceResponse = z.object({
  preference: Preference,
  submittedAt: z.string(),
  transition: z.object({
    transitionId: z.string(),
    kind: z.enum(['external', 'internal']),
    to: TripStatus,
  }),
});
export type SavePreferenceResponse = z.infer<typeof SavePreferenceResponse>;
