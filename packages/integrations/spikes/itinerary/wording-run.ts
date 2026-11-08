import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { loadRootEnv } from '@bonvoyage/shared/node';
import {
  COST_RULE_KEYS,
  durationMinutes,
  buildFactSheet,
  farePerPerson,
  generatePackages,
  planDays,
  toMemberInput,
  toPackageInput,
  type PackageSource,
} from '@bonvoyage/engine';
import { loadCatalogue } from '@bonvoyage/db/catalogue';
import { PreferenceInput, ItineraryOutput } from '@bonvoyage/shared';
import { z } from 'zod';
import { validateItinerary } from '../../../engine/src/itinerary/validate';
import { GeminiLlmClient } from '../../src/llm/gemini';
import { buildItineraryPrompt } from '../../src/itinerary/prompt';
import { ItineraryWording } from '../../src/itinerary/wording';

// #165: measure first. Sends the app's real words-only prompt (fact sheet
// plus skeleton, built exactly as composeItineraryWording builds it) for the
// demo's Chakrata plan (Hills shortlist demo: 3 members, Gurugram, 2 nights,
// Saver package) and times three configs. Live calls only behind --live;
// each run is one paid-for call, so the default is 3 per config.

const { values: args } = parseArgs({
  options: {
    live: { type: 'boolean', default: false },
    runs: { type: 'string', default: '3' },
    model: { type: 'string' },
    today: { type: 'string', default: '2026-11-03' },
  },
});

if (!args.live) {
  console.error('Refusing to call the live API without --live.');
  process.exit(1);
}

loadRootEnv(import.meta.dirname);
const apiKey = process.env.GEMINI_API_KEY;
const model = args.model ?? process.env.GEMINI_MODEL;
if (!apiKey || !model) {
  console.error('GEMINI_API_KEY and GEMINI_MODEL must be set.');
  process.exit(1);
}

// --- Build the demo's Chakrata fact sheet and skeleton offline. ---
const pref = (body: object) => PreferenceInput.parse(body);
const members = [
  pref({
    destinationTypes: ['mountain', 'adventure'],
    activities: ['trekking', 'rafting', 'camping'],
    climate: 'cold',
    travelStyle: 'budget',
    budgetMinInr: 12000,
    budgetMaxInr: 18000,
    dateStart: '2026-11-21',
    dateEnd: '2026-11-24',
  }),
  pref({
    destinationTypes: ['spiritual', 'mountain'],
    activities: ['yoga_wellness', 'temples', 'trekking'],
    climate: 'mild',
    travelStyle: 'comfort',
    budgetMinInr: 10000,
    budgetMaxInr: 16000,
    dateStart: '2026-11-20',
    dateEnd: '2026-11-23',
  }),
  pref({
    destinationTypes: ['heritage', 'hill_station'],
    activities: ['museums', 'trekking', 'food_trails'],
    climate: 'any',
    travelStyle: 'comfort',
    budgetMinInr: 11000,
    budgetMaxInr: 17000,
    dateStart: '2026-11-20',
    dateEnd: '2026-11-24',
  }),
].map((p, i) => toMemberInput(`m${i}`, p, []));

const catalogueDir = resolve(import.meta.dirname, '../../../db/catalogue');
const catalogue = loadCatalogue(catalogueDir, { today: args.today });
const dest = catalogue.destinations.find((d) => d.slug === 'chakrata');
const hub = catalogue.hubs.find((h) => h.slug === 'gurugram');
if (!dest || !hub) throw new Error('Chakrata or the gurugram hub is missing.');
const source: PackageSource = {
  trip: { durationNights: 2, budgetTotalInr: 48000 },
  members,
  hub,
  destination: {
    slug: dest.slug,
    name: dest.name,
    stayBudgetInr: dest.stay_budget_inr ?? null,
    stayMidInr: dest.stay_mid_inr ?? null,
    stayPremiumInr: dest.stay_premium_inr ?? null,
    foodPerDayInr: dest.food_per_day_inr ?? null,
    localPerDayInr: dest.local_per_day_inr ?? null,
    costReviewStatus: dest.cost_review_status,
  },
  fares: catalogue.fares
    .filter((f) => f.origin_hub === hub.slug && f.destination_slug === 'chakrata')
    .map((f) => ({
      mode: f.mode,
      farePerPersonInr: f.fare_per_person_inr ?? null,
      distanceKm: f.distance_km,
      durationMinutes: f.duration_minutes,
      reviewStatus: f.review_status,
    })),
  rules: Object.values(COST_RULE_KEYS).flatMap((key) => {
    const row = catalogue.costRules?.[key];
    return row ? [{ key, value: row.value, verified: row.review_status }] : [];
  }),
  pois: catalogue.pois
    .filter((p) => p.destination_slug === 'chakrata')
    .map((p) => ({
      poiKey: p.poi_key,
      name: p.name,
      category: p.category,
      typicalMinutes: p.typical_minutes,
      openTime: p.open_time ?? null,
      closeTime: p.close_time ?? null,
      closedDays: p.closed_days ?? [],
      entryFeeInr: p.entry_fee_inr,
      reviewStatus: p.review_status,
    })),
};
const input = toPackageInput(source);
const pkg = generatePackages(input).packages.find((p) => p.label === 'Saver');
if (!pkg) throw new Error('No Saver package for Chakrata.');
const minutes = durationMinutes(input, pkg.transportMode) ?? 0;
const planInput = {
  startDate: input.startDate,
  nights: input.nights,
  onward: { mode: pkg.transportMode, durationMinutes: minutes },
  ret: { mode: pkg.transportMode, durationMinutes: minutes },
  stayTier: pkg.stayTier,
  places: input.places,
  groupInterests: input.groupInterests,
};
const plan = planDays(planInput);
const facts = buildFactSheet({
  plan,
  input: planInput,
  originName: input.originName,
  destination: { slug: dest.slug, name: dest.name, state: dest.state },
  groupSize: input.n,
  rooms: pkg.rooms,
  perRoomPerNightInr: input.stay[pkg.stayTier] ?? 0,
  farePerPersonInr: {
    onward: farePerPerson(input, pkg.transportMode) ?? 0,
    return: farePerPerson(input, pkg.transportMode) ?? 0,
  },
  costs: { totalInr: pkg.totalInr, perPersonInr: pkg.perPersonInr, items: pkg.lines },
});

const { system, prompt } = buildItineraryPrompt(facts);
const skeletonPrompt = `${prompt}\n\nPlanned skeleton (times and places are fixed; write words only, no new numbers, times or places):\n${JSON.stringify(plan.days)}`;

// Variant C: the smallest output that still validates — notes only for
// activity items, tighter lengths, a worded system prompt.
const TightWording = z.object({
  summary: z.string().min(1).max(300),
  reasons: z.array(z.string().min(1).max(140)).min(1).max(3),
  notes: z.array(
    z.object({
      day: z.number().int().min(1),
      index: z.number().int().min(0),
      note: z.string().min(1).max(140),
    }),
  ),
});
const TIGHT_RULES =
  '\n\nWording rules: write a notes entry only for items whose kind is "activity". ' +
  'Never claim a duration: no "spend the day", "all day", "half a day" or hour counts. ' +
  'Use only adjectives grounded in the fact sheet (category, entry fee, opening times); ' +
  'never add qualities such as "historic", "famous" or "scenic".';
const tightPrompt = `${prompt}${TIGHT_RULES}\n\nPlanned skeleton (times and places are fixed; write words only, no new numbers, times or places):\n${JSON.stringify(plan.days)}`;

const configs = [
  {
    name: 'A-current-low',
    thinkingLevel: 'low' as const,
    prompt: skeletonPrompt,
    schema: ItineraryWording,
  },
  {
    name: 'B-minimal',
    thinkingLevel: 'minimal' as const,
    prompt: skeletonPrompt,
    schema: ItineraryWording,
  },
  {
    name: 'C-minimal-tight',
    thinkingLevel: 'minimal' as const,
    prompt: tightPrompt,
    schema: TightWording,
  },
];

const outDir = resolve(import.meta.dirname, 'out');
mkdirSync(outDir, { recursive: true });

/** Merge wording into the skeleton exactly like the itinerary service. */
function merge(wording: z.infer<typeof ItineraryWording>) {
  const days = plan.days.map((day) => ({
    day: day.day,
    date: day.date,
    items: day.items.map((item) => ({
      start: item.start,
      end: item.end,
      kind: item.kind,
      ...(item.placeKey !== undefined ? { poiId: item.placeKey } : {}),
      ...(item.legId !== undefined ? { legId: item.legId } : {}),
      note: item.note,
    })),
  }));
  const output = { days, summary: wording.summary, reasons: wording.reasons };
  for (const n of wording.notes) {
    const item = output.days[n.day - 1]?.items[n.index];
    if (item) item.note = n.note;
  }
  return ItineraryOutput.parse(output);
}

const rows: string[] = [
  'config,run,latencyMs,inputTokens,outputTokens,thinkingTokens,ok,verifiedRatio,unverified,error',
];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
for (const config of configs) {
  const client = new GeminiLlmClient({ apiKey, model, thinkingLevel: config.thinkingLevel });
  for (let run = 1; run <= Number(args.runs); run++) {
    try {
      const result = await client.generateStructured({
        system,
        prompt: config.prompt,
        schema: config.schema,
        schemaName: 'ItineraryWording',
      });
      const merged = merge(result.data);
      const verdict = validateItinerary(merged, facts);
      const unverified = verdict.items.filter((i) => !i.verified).length;
      const line = `${config.name},${run},${result.latencyMs},${result.usage.inputTokens},${result.usage.outputTokens},${result.usage.thinkingTokens ?? 0},${verdict.ok},${verdict.verifiedRatio.toFixed(3)},${unverified},`;
      console.log(line);
      rows.push(line);
      writeFileSync(
        resolve(outDir, `wording-${config.name}-${run}.json`),
        JSON.stringify({ wording: result.data, verdict }, null, 2),
      );
    } catch (error) {
      const line = `${config.name},${run},,,,,,,,"${error instanceof Error ? error.message.slice(0, 120).replaceAll('"', "'") : 'error'}"`;
      console.log(line);
      rows.push(line);
    }
    await sleep(5000);
  }
}
writeFileSync(resolve(outDir, `wording-summary-${Date.now()}.csv`), `${rows.join('\n')}\n`);
