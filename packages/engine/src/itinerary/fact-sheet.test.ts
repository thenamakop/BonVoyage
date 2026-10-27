import { describe, expect, it } from 'vitest';
import { FactSheet, type ItineraryOutput } from '@bonvoyage/shared';
import { goldenInput } from '../packages/cost.test';
import { costPackage } from '../packages/cost';
import { buildFactSheet } from './fact-sheet';
import type { PlanInput, TripPlan } from './plan';
import { validateItinerary } from './validate';

function toOutput(facts: FactSheet, plan: TripPlan): ItineraryOutput {
  return {
    days: plan.days.map((day) => ({
      day: day.day,
      date: day.date,
      items: day.items.map((item) => ({
        start: item.start,
        end: item.end,
        kind: item.kind,
        poiId: item.placeKey,
        legId: item.legId,
        note: item.note,
      })),
    })),
    summary: `A trip to ${facts.destination.name}.`,
    reasons: ['It fits the group.'],
  };
}

function factsFor(mode: 'train' | 'car', tier: 'budget' | 'mid' | 'premium') {
  const input = goldenInput();
  const pkg = costPackage(input, { label: 'X', mode, tier });
  if (!pkg) throw new Error('unreachable');
  const planInput: PlanInput = {
    startDate: input.startDate,
    nights: input.nights,
    onward: { mode, durationMinutes: 300 },
    ret: { mode, durationMinutes: 300 },
    stayTier: tier,
    places: input.places,
    groupInterests: input.groupInterests,
  };
  const facts = buildFactSheet({
    plan: pkg.plan,
    input: planInput,
    originName: input.originName,
    destination: { slug: 'rishikesh', name: 'Rishikesh', state: 'Uttarakhand' },
    groupSize: input.n,
    rooms: pkg.rooms,
    perRoomPerNightInr: 1500,
    farePerPersonInr: { onward: 400, return: 400 },
    costs: {
      totalInr: pkg.totalInr,
      perPersonInr: pkg.perPersonInr,
      items: pkg.lines.map((line) => ({ category: line.category, amountInr: line.amountInr })),
    },
  });
  return { facts, pkg };
}

describe('buildFactSheet', () => {
  it('parses against the shared FactSheet schema', () => {
    const { facts } = factsFor('train', 'mid');
    expect(() => FactSheet.parse(facts)).not.toThrow();
    expect(facts.limits.maxDayHours).toBe(15);
    expect(facts.pois.map((poi) => poi.id)).toEqual(['triveni-ghat', 'museum-x', 'beatles-ashram']);
    expect(facts.trip.endDate).toBe('2026-11-08');
    expect(facts.legs[0]?.from).toBe('Gurugram');
    expect(facts.legs[1]?.to).toBe('Gurugram');
  });

  it('a planned day plan with template notes passes validateItinerary fully verified', () => {
    const { facts, pkg } = factsFor('train', 'mid');
    const result = validateItinerary(toOutput(facts, pkg.plan), facts);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.verifiedRatio).toBe(1);
    expect(result.items.every((item) => item.verified)).toBe(true);
  });

  it('throws for a plan with no days', () => {
    const input = goldenInput();
    expect(() =>
      buildFactSheet({
        plan: { legs: [], days: [], scheduledPlaceKeys: [] },
        input: {
          startDate: input.startDate,
          nights: input.nights,
          onward: { mode: 'train', durationMinutes: 300 },
          ret: { mode: 'train', durationMinutes: 300 },
          stayTier: 'mid',
          places: input.places,
          groupInterests: input.groupInterests,
        },
        originName: input.originName,
        destination: { slug: 'rishikesh', name: 'Rishikesh', state: 'Uttarakhand' },
        groupSize: input.n,
        rooms: 2,
        perRoomPerNightInr: 1500,
        farePerPersonInr: { onward: 400, return: 400 },
        costs: { totalInr: 0, perPersonInr: 0, items: [] },
      }),
    ).toThrow('plan has no days');
  });

  it('still passes the validator when a scheduled place is a draft row', () => {
    const input = goldenInput({
      places: goldenInput().places.map((place) =>
        place.key === 'museum-x' ? { ...place, verified: false } : place,
      ),
    });
    const pkg = costPackage(input, { label: 'X', mode: 'train', tier: 'mid' });
    if (!pkg) throw new Error('unreachable');
    const facts = buildFactSheet({
      plan: pkg.plan,
      input: {
        startDate: input.startDate,
        nights: input.nights,
        onward: { mode: 'train', durationMinutes: 300 },
        ret: { mode: 'train', durationMinutes: 300 },
        stayTier: 'mid',
        places: input.places,
        groupInterests: input.groupInterests,
      },
      originName: input.originName,
      destination: { slug: 'rishikesh', name: 'Rishikesh', state: 'Uttarakhand' },
      groupSize: input.n,
      rooms: pkg.rooms,
      perRoomPerNightInr: 1500,
      farePerPersonInr: { onward: 400, return: 400 },
      costs: {
        totalInr: pkg.totalInr,
        perPersonInr: pkg.perPersonInr,
        items: pkg.lines.map((line) => ({ category: line.category, amountInr: line.amountInr })),
      },
    });
    const result = validateItinerary(toOutput(facts, pkg.plan), facts);
    expect(result.ok).toBe(true);
  });
});
