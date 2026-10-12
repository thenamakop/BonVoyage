import { ERROR_CODES } from '@bonvoyage/shared';
import type { ErrorEnvelope } from '@bonvoyage/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { z } from 'zod';

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string> | undefined;
  readonly details: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    fields?: Record<string, string>,
    details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.details = details;
  }
}

export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join('.') : '_root';
    fields[key] ??= issue.message;
  }
  return fields;
}

export function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  throw new AppError(
    400,
    ERROR_CODES.VALIDATION_ERROR,
    'Some fields are invalid.',
    zodFieldErrors(result.error),
  );
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, ERROR_CODES.NOT_FOUND, `No route for ${req.method} ${req.path}.`));
};

function envelope(
  code: string,
  message: string,
  fields?: Record<string, string>,
  details?: unknown,
): ErrorEnvelope {
  return {
    error: {
      code,
      message,
      ...(fields ? { fields } : {}),
      ...(details === undefined ? {} : { details }),
    },
  };
}

interface BodyParserError {
  type: string;
}

function bodyParserType(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'type' in err) {
    const { type } = err as BodyParserError;
    return typeof type === 'string' ? type : undefined;
  }
  return undefined;
}

// Express identifies error middleware by its four parameters.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json(envelope(err.code, err.message, err.fields, err.details));
    return;
  }
  const type = bodyParserType(err);
  if (type === 'entity.parse.failed') {
    res.status(400).json(envelope(ERROR_CODES.INVALID_JSON, 'The request body is not valid JSON.'));
    return;
  }
  if (type === 'entity.too.large') {
    res.status(413).json(envelope(ERROR_CODES.PAYLOAD_TOO_LARGE, 'The request body is too large.'));
    return;
  }
  req.log.error({ err }, 'unhandled error');
  res.status(500).json(envelope(ERROR_CODES.INTERNAL, 'Something went wrong.'));
};
