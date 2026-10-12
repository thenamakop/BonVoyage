import { z } from 'zod';

// Profile contracts (S1-4): the home city and the past trips that Sprint 2's
// scoring reads (past trips rated 4 or 5 add their destination's types).

export const PastTrip = z.object({
  id: z.string(),
  destination: z.object({ slug: z.string(), name: z.string() }).nullable(),
  placeName: z.string().nullable(),
  visitedOn: z.string().nullable(),
  rating: z.number().int(),
});
export type PastTrip = z.infer<typeof PastTrip>;

export const ProfileResponse = z.object({
  homeHubSlug: z.string().nullable(),
  pastTrips: z.array(PastTrip),
});
export type ProfileResponse = z.infer<typeof ProfileResponse>;

export const UpdateProfileInput = z.object({
  homeHubSlug: z.string().min(1, 'Choose a city from the list.').nullable(),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileInput>;

export const AddPastTripInput = z
  .object({
    destinationSlug: z.string().min(1, 'Choose a destination from the list.').optional(),
    placeName: z
      .string()
      .trim()
      .min(1, 'Name the place you visited.')
      .max(80, 'Keep the place name under 80 characters.')
      .optional(),
    visitedOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter the date as a calendar date.')
      .optional(),
    rating: z
      .number('Choose a rating from 1 to 5.')
      .int('Choose a rating from 1 to 5.')
      .min(1, 'Choose a rating from 1 to 5.')
      .max(5, 'Choose a rating from 1 to 5.'),
  })
  .superRefine((v, ctx) => {
    const hasSlug = v.destinationSlug !== undefined;
    const hasPlace = v.placeName !== undefined;
    if (hasSlug && hasPlace) {
      ctx.addIssue({
        code: 'custom',
        path: ['placeName'],
        message: 'Choose a destination or name the place, not both.',
      });
    } else if (!hasSlug && !hasPlace) {
      ctx.addIssue({
        code: 'custom',
        path: ['destinationSlug'],
        message: 'Choose a destination, or pick "Somewhere else" and name the place.',
      });
    }
  });
export type AddPastTripInput = z.infer<typeof AddPastTripInput>;

export const DestinationSummary = z.object({
  slug: z.string(),
  name: z.string(),
  state: z.string(),
});
export type DestinationSummary = z.infer<typeof DestinationSummary>;

export const DestinationsResponse = z.object({ destinations: z.array(DestinationSummary) });
export type DestinationsResponse = z.infer<typeof DestinationsResponse>;
