import { ErrorEnvelope } from '@bonvoyage/shared';
import type { z } from 'zod';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string> | undefined;
  /** Structured extras from the envelope, e.g. CATALOGUE_INVALID's issues. */
  readonly details: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    fields?: Record<string, string>,
    details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.details = details;
  }
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return (await res.json()) as unknown;
  } catch {
    return undefined;
  }
}

export async function fetchJson<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { credentials: 'same-origin', ...init });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'The server could not be reached.');
  }
  const body = await readJson(res);
  if (res.ok) {
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(res.status, 'BAD_RESPONSE', 'The server sent an unexpected response.');
    }
    return parsed.data;
  }
  const envelope = ErrorEnvelope.safeParse(body);
  if (envelope.success) {
    const { code, message, fields, details } = envelope.data.error;
    throw new ApiError(res.status, code, message, fields, details);
  }
  throw new ApiError(res.status, 'BAD_RESPONSE', 'The server sent an unexpected response.');
}
