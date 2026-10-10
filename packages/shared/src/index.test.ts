import { describe, expect, it } from 'vitest';
import { ErrorEnvelope, HealthOk, Provenance } from './index';

describe('ErrorEnvelope', () => {
  it('accepts a fields map', () => {
    const parsed = ErrorEnvelope.safeParse({
      error: { code: 'VALIDATION_ERROR', message: 'Some fields are invalid.', fields: { a: 'x' } },
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects a lowercase code', () => {
    const parsed = ErrorEnvelope.safeParse({ error: { code: 'not_found', message: 'x' } });
    expect(parsed.success).toBe(false);
  });
});

describe('HealthOk and Provenance', () => {
  it('accepts the exact health body', () => {
    expect(HealthOk.parse({ status: 'ok', db: 'ok' })).toEqual({ status: 'ok', db: 'ok' });
  });

  it('rejects an unknown provenance', () => {
    expect(Provenance.safeParse('guessed').success).toBe(false);
  });
});
