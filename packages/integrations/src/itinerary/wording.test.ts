import type { FactSheet } from '@bonvoyage/shared';
import type { LlmClient, LlmResult } from '../llm/types';
import { describe, expect, it } from 'vitest';
import type { ZodType } from 'zod';
import { FixtureLlmClient } from '../llm/fixture';
import { composeItineraryWording } from './wording';
import type { TripPlan } from '@bonvoyage/engine';

// S3-6 step 1: good wording, an invented price, a malformed reply and a
// timeout, all through FixtureLlmClient (LIVE_APIS=off everywhere else).

const factSheet = {
  trip: {
    nights: 2,
    startDate: '2026-11-06',
    endDate: '2026-11-08',
    groupSize: 3,
    interests: ['temples'],
  },
  destination: { slug: 'rishikesh', name: 'Rishikesh', state: 'Uttarakhand' },
  legs: [
    {
      id: 'onward',
      mode: 'car',
      from: 'Gurugram',
      to: 'Rishikesh',
      depart: '06:00',
      arrive: '11:00',
      durationMinutes: 300,
      farePerPersonInr: 1400,
    },
    {
      id: 'return',
      mode: 'car',
      from: 'Rishikesh',
      to: 'Gurugram',
      depart: '16:00',
      arrive: '21:00',
      durationMinutes: 300,
      farePerPersonInr: 1400,
    },
  ],
  stay: { tier: 'mid', perRoomPerNightInr: 3000, rooms: 2 },
  pois: [
    {
      id: 'rishikesh/ghat',
      name: 'Triveni Ghat',
      category: 'temple',
      typicalMinutes: 60,
      openTime: null,
      closeTime: null,
      closedDays: [],
      entryFeeInr: 0,
    },
  ],
  costs: { totalInr: 21600, perPersonInr: 7200, items: [{ category: 'stay', amountInr: 12000 }] },
  limits: { maxDayHours: 15 },
} satisfies FactSheet;

const skeleton = {
  legs: [],
  scheduledPlaceKeys: ['rishikesh/ghat'],
  days: [
    {
      day: 1,
      date: '2026-11-06',
      items: [
        {
          start: '14:00',
          end: '15:00',
          kind: 'activity',
          placeKey: 'rishikesh/ghat',
          note: 'Visit Triveni Ghat (temple). Entry ₹0 per person.',
        },
      ],
    },
  ],
} satisfies TripPlan;

const good = new FixtureLlmClient({
  ItineraryWording: {
    summary: 'Three easy days in Rishikesh around the ghats.',
    reasons: ['Shared love of temples.'],
    notes: [{ day: 1, index: 0, note: 'An hour at the ghat at your own pace.' }],
  },
});

const malformed = new FixtureLlmClient({ ItineraryWording: { not: 'the schema' } });

/** A client that never resolves, for the 20-second timeout path. */
class NeverResolves implements LlmClient {
  generateStructured<T>(): Promise<LlmResult<T>> {
    return new Promise(() => {});
  }
}

describe('composeItineraryWording', () => {
  it('returns wording and the model id on a good reply', async () => {
    const out = await composeItineraryWording(good, factSheet, skeleton);
    expect(out).toMatchObject({ ok: true, model: 'fixture' });
    if (out.ok) {
      expect(out.wording.notes[0]).toMatchObject({ day: 1, index: 0 });
      expect(out.wording.summary.length).toBeLessThanOrEqual(600);
    }
  });

  it('a reply outside the schema returns ok:false', async () => {
    const out = await composeItineraryWording(malformed, factSheet, skeleton);
    expect(out.ok).toBe(false);
  });

  it('a client that never resolves times out instead of hanging', async () => {
    const out = await composeItineraryWording(new NeverResolves(), factSheet, skeleton, {
      timeoutMs: 50,
    });
    expect(out).toMatchObject({ ok: false });
    if (!out.ok) expect(out.reason).toContain('timed out');
  });

  it('records the prompt on the fixture so tests can search it for member data', async () => {
    const prompts: string[] = [];
    const spy: LlmClient = {
      generateStructured<T>(request: {
        system: string;
        prompt: string;
        schema: ZodType<T>;
        schemaName: string;
      }): Promise<LlmResult<T>> {
        prompts.push(request.prompt);
        return Promise.resolve({
          data: { summary: 's', reasons: ['r'], notes: [] } as T,
          usage: { inputTokens: 0, outputTokens: 0 },
          latencyMs: 1,
          model: 'spy',
        });
      },
    };
    await composeItineraryWording(spy, factSheet, skeleton);
    expect(prompts[0]).toContain('Triveni Ghat');
    expect(prompts[0]).toContain('write words only');
  });
});
