import { ErrorEnvelope } from '@bonvoyage/shared';
import express from 'express';
import request from 'supertest';
import { pino } from 'pino';
import { pinoHttp } from 'pino-http';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { errorHandler, parseOrThrow } from './errors';

function appThrowing(fn: () => unknown) {
  const app = express();
  app.use(pinoHttp({ logger: pino({ level: 'silent' }) }));
  app.get('/boom', () => {
    fn();
  });
  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  it('hides internal details behind a 500 INTERNAL envelope', async () => {
    const res = await request(
      appThrowing(() => {
        throw new Error('secret detail');
      }),
    ).get('/boom');
    expect(res.status).toBe(500);
    expect(ErrorEnvelope.parse(res.body).error.code).toBe('INTERNAL');
    expect(JSON.stringify(res.body)).not.toContain('secret detail');
  });

  it('maps a missing field to 400 VALIDATION_ERROR with fields', async () => {
    const schema = z.object({ title: z.string() });
    const res = await request(appThrowing(() => parseOrThrow(schema, {}))).get('/boom');
    expect(res.status).toBe(400);
    expect(ErrorEnvelope.parse(res.body).error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(ErrorEnvelope.parse(res.body).error.fields ?? {})).toEqual(['title']);
  });

  it('joins nested paths with a dot', async () => {
    const schema = z.object({ a: z.object({ b: z.string() }) });
    const res = await request(appThrowing(() => parseOrThrow(schema, { a: {} }))).get('/boom');
    expect(ErrorEnvelope.parse(res.body).error.fields).toHaveProperty('a.b');
  });
});
