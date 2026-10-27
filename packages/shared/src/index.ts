import { z } from 'zod';

export const HealthOk = z.object({
  status: z.literal('ok'),
  db: z.literal('ok'),
});
export type HealthOk = z.infer<typeof HealthOk>;

export const ErrorEnvelope = z.object({
  error: z.object({
    code: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
    message: z.string(),
    fields: z.record(z.string(), z.string()).optional(),
    /** Structured extra information, e.g. CATALOGUE_INVALID's issues (S1-7). */
    details: z.unknown().optional(),
  }),
});
export type ErrorEnvelope = z.infer<typeof ErrorEnvelope>;

export * from './provenance';
export * from './vocab';
export * from './domain';
export * from './itinerary';
export * from './api/auth';
export * from './api/trips';
export * from './api/invitations';
export * from './api/preferences';
export * from './api/profile';
export * from './api/admin';
export * from './api/recommendations';
export * from './time';

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_JSON: 'INVALID_JSON',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  NOT_FOUND: 'NOT_FOUND',
  ILLEGAL_TRANSITION: 'ILLEGAL_TRANSITION',
  GUARD_FAILED: 'GUARD_FAILED',
  PREFERENCES_LOCKED: 'PREFERENCES_LOCKED',
  TRIP_CLOSED: 'TRIP_CLOSED',
  TRIP_NOT_EDITABLE: 'TRIP_NOT_EDITABLE',
  INVITATIONS_CLOSED: 'INVITATIONS_CLOSED',
  INVITATION_EXPIRED: 'INVITATION_EXPIRED',
  TRIP_FULL: 'TRIP_FULL',
  MEMBER_EXCLUDED: 'MEMBER_EXCLUDED',
  CANNOT_REMOVE_ORGANISER: 'CANNOT_REMOVE_ORGANISER',
  ORGANISER_CANNOT_LEAVE: 'ORGANISER_CANNOT_LEAVE',
  TRIP_LOCKED: 'TRIP_LOCKED',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  CATALOGUE_INVALID: 'CATALOGUE_INVALID',
  RECOMMENDATION_STALE: 'RECOMMENDATION_STALE',
  DESTINATION_NOT_IN_SHORTLIST: 'DESTINATION_NOT_IN_SHORTLIST',
  ACCOUNT_HAS_ACTIVE_TRIPS: 'ACCOUNT_HAS_ACTIVE_TRIPS',
  DB_UNAVAILABLE: 'DB_UNAVAILABLE',
  INTERNAL: 'INTERNAL',
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
