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
  }),
});
export type ErrorEnvelope = z.infer<typeof ErrorEnvelope>;

export const Provenance = z.enum(['live', 'cached', 'curated', 'estimated']);
export type Provenance = z.infer<typeof Provenance>;

export * from './vocab';

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_JSON: 'INVALID_JSON',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  NOT_FOUND: 'NOT_FOUND',
  DB_UNAVAILABLE: 'DB_UNAVAILABLE',
  INTERNAL: 'INTERNAL',
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
