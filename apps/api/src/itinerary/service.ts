import type { Db } from '@bonvoyage/db';
import { itinerary, itineraryItem, trip, tripPackage } from '@bonvoyage/db/schema';
import {
  addDaysUtc,
  buildFactSheet,
  durationMinutes,
  farePerPerson,
  planDays,
  validateItinerary,
  unusedPlacesFitting,
  type TripPlan,
} from '@bonvoyage/engine';
import { composeItineraryWording } from '@bonvoyage/integrations';
import type { LlmClient, WordingFailure } from '@bonvoyage/integrations';
import { and, eq } from 'drizzle-orm';
import type { Logger } from 'pino';
import {
  ERROR_CODES,
  POI_CATEGORY_LABELS,
  type ModifyItineraryInput,
  type ItineraryItem,
  type ItineraryOutput,
  type ItineraryResponse,
  type ItineraryView,
  type TripStatus,
} from '@bonvoyage/shared';
import { AppError } from '../http/errors';
import { packageInput } from '../packages/service';
import { loadMembers } from '../recommendations/service';
import { assertEventLegal, transitionTrip } from '../trips/transition-trip';
import { indiaDate } from '@bonvoyage/shared';
import { loadTripForMember, requireActiveMember, requireOrganiser } from '../trips/access';
import { getTrip } from '../trips/service';
import {
  findAcceptedPackage,
  insertItinerary,
  latestItineraryForTrip,
  listActivePois,
  listItems,
  nextVersion,
} from './repository';

interface Deps {
  db: Db;
  logger: Logger;
  clock: () => Date;
  /** Present only when LIVE_APIS=on; absent means the template path. */
  llm?: LlmClient;
  /** Model wording timeout; tests shorten it (P10 default is 20 s). */
  wordingTimeoutMs?: number;
}

type ItineraryEvent = 'generateItinerary' | 'itineraryAccepted' | 'itineraryRejected';

const TEMPLATE = {
  model: 'catalogue-planner',
  reasons: ['Built from catalogue places and the chosen package.'],
};

const NUMBER_TOKEN = /(?:₹|Rs\.?)\s?\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?/g;

/**
 * 0005 f: the validator checks item notes; summary and reasons get the same
 * treatment here — any number the fact sheet does not carry makes the model
 * wording unsafe, so the template text takes over.
 */
function summaryNumbersOk(summary: string, reasons: readonly string[], facts: object): boolean {
  const factNumbers = new Set<number>();
  for (const m of JSON.stringify(facts).matchAll(NUMBER_TOKEN)) {
    const n = Number(m[0].replace(/^(?:₹|Rs\.?)\s?/, '').replaceAll(',', ''));
    if (Number.isFinite(n)) factNumbers.add(n);
  }
  for (const text of [summary, ...reasons]) {
    for (const m of text.matchAll(NUMBER_TOKEN)) {
      const n = Number(m[0].replace(/^(?:₹|Rs\.?)\s?/, '').replaceAll(',', ''));
      if (Number.isFinite(n) && !factNumbers.has(n)) return false;
    }
  }
  return true;
}

/** Items planned by the engine become the validator's ItineraryOutput. */
function toOutput(
  days: {
    day: number;
    date: string;
    items: {
      start: string;
      end: string;
      kind: ItineraryItem['kind'];
      placeKey?: string;
      legId?: 'onward' | 'return';
      note: string;
    }[];
  }[],
  summary: string,
  reasons: string[],
): ItineraryOutput {
  return {
    days: days.map((d) => ({
      day: d.day,
      date: d.date,
      items: d.items.map((i) => ({
        start: i.start,
        end: i.end,
        kind: i.kind,
        ...(i.placeKey !== undefined ? { poiId: i.placeKey } : {}),
        ...(i.legId !== undefined ? { legId: i.legId } : {}),
        note: i.note,
      })),
    })),
    summary,
    reasons,
  };
}

async function planningContext(
  db: Db,
  tripId: string,
  tripRow: Awaited<ReturnType<typeof loadTripForMember>>['trip'],
) {
  const pkg = await findAcceptedPackage(db, tripId);
  if (!pkg) throw new AppError(409, ERROR_CODES.ILLEGAL_TRANSITION, 'Choose a package first.');
  const members = await loadMembers(db, tripId);
  const dest = await db.query.destination.findFirst({
    where: (d, { eq }) => eq(d.id, pkg.destinationId),
  });
  if (!dest) throw new AppError(500, ERROR_CODES.INTERNAL, 'Something went wrong.');
  const input = await packageInput(db, tripRow, members, dest);

  const legMinutes = durationMinutes(input, pkg.transportMode);
  // A destination with no real fare row yields a fabricated zero car leg.
  if (legMinutes === null || legMinutes === 0) {
    throw new AppError(409, ERROR_CODES.ILLEGAL_TRANSITION, 'This package cannot be planned.');
  }
  const planInput = {
    startDate: pkg.startDate,
    nights: tripRow.durationNights,
    onward: { mode: pkg.transportMode, durationMinutes: legMinutes },
    ret: { mode: pkg.transportMode, durationMinutes: legMinutes },
    stayTier: pkg.stayTier,
    places: input.places,
    groupInterests: input.groupInterests,
  };
  const plan = planDays(planInput);

  const lines = await db.query.costItem.findMany({
    where: (c, { eq }) => eq(c.packageId, pkg.id),
  });
  const stayLine = lines.find((l) => l.category === 'stay');
  const fare = farePerPerson(input, pkg.transportMode);
  if (fare === null || fare === 0) {
    throw new AppError(409, ERROR_CODES.ILLEGAL_TRANSITION, 'This package cannot be planned.');
  }
  const facts = buildFactSheet({
    plan,
    input: planInput,
    originName: input.originName,
    destination: { slug: dest.slug, name: dest.name, state: dest.state },
    groupSize: input.n,
    rooms: pkg.rooms,
    perRoomPerNightInr: Math.ceil(
      (stayLine?.amountInr ?? 0) / Math.max(1, pkg.rooms * tripRow.durationNights),
    ),
    farePerPersonInr: { onward: fare, return: fare },
    costs: {
      totalInr: pkg.totalInr,
      perPersonInr: pkg.perPersonInr,
      items: lines.map((l) => ({ category: l.category, amountInr: l.amountInr })),
    },
  });

  return { pkg, dest, input, planInput, plan, facts };
}

export async function planItinerary(
  deps: Deps,
  tripId: string,
  userId: string,
): Promise<ItineraryResponse> {
  const { db, logger, clock } = deps;
  const started = performance.now();
  const { trip: tripRow, membership } = await loadTripForMember(db, tripId, userId);
  requireActiveMember(membership);
  requireOrganiser(membership);
  assertEventLegal(tripRow.status, 'generateItinerary', indiaDate(clock()));
  const { pkg, dest, input, plan, facts } = await planningContext(db, tripId, tripRow);
  const summary = `${tripRow.durationNights}-night trip to ${dest.name} for ${input.n} people.`;
  let output = toOutput(plan.days, summary, TEMPLATE.reasons);
  let model = TEMPLATE.model;
  let source: ItineraryView['source'] = 'catalogue';
  // #121: S4-7 reads these from the deployment's logs; codes only, no text.
  let wordingFallback: WordingFailure | null = null;
  let wordingCache: 'hit' | 'miss' | null = null;

  if (deps.llm) {
    const wording = await composeItineraryWording(deps.llm, facts, plan, {
      timeoutMs: deps.wordingTimeoutMs ?? 20000,
    });
    if (wording.ok) {
      output = toOutput(plan.days, wording.wording.summary, wording.wording.reasons);
      for (const n of wording.wording.notes) {
        const item = output.days[n.day - 1]?.items[n.index];
        if (item) item.note = n.note;
      }
      model = wording.model;
      source = 'model';
      wordingCache = wording.fromCache ? 'hit' : 'miss';
    } else {
      wordingFallback = wording.reason;
      logger.warn({ tripId, reason: wording.reason }, 'itinerary wording fell back to templates');
    }
  }

  // The validator checks every note; a model note that fails gets the
  // template text back for that item, then the plan is checked again (0005 f).
  let result = validateItinerary(output, facts);
  if (source === 'model') {
    for (const verdict of result.items) {
      if (!verdict.verified) {
        const template = toOutput(plan.days, summary, TEMPLATE.reasons).days[verdict.day - 1]
          ?.items[verdict.index];
        const item = output.days[verdict.day - 1]?.items[verdict.index];
        if (item && template) item.note = template.note;
      }
    }
    result = validateItinerary(output, facts);
    // A failing summary/reason (for example an invented number) falls back to
    // the template wording; notes that passed keep the model's words (0005 f).
    if (result.errors.length > 0 || !summaryNumbersOk(output.summary, output.reasons, facts)) {
      output.summary = summary;
      output.reasons = TEMPLATE.reasons;
      result = validateItinerary(output, facts);
      if (!result.ok) {
        output = toOutput(plan.days, summary, TEMPLATE.reasons);
        model = TEMPLATE.model;
        source = 'catalogue';
        result = validateItinerary(output, facts);
      }
    }
  }

  // The catalogue-planner path stores only a plan the validator fully accepts.
  if (!result.ok) {
    logger.error(
      { tripId, codes: result.errors.map((e) => e.code) },
      'itinerary failed validation',
    );
    throw new AppError(500, ERROR_CODES.INTERNAL, 'We could not plan these days. Try again.');
  }

  const pois = await listActivePois(db, pkg.destinationId);
  const poiIdOf = new Map(pois.map((p) => [`${dest.slug}/${p.poiKey}`, p]));
  // The accepted package row carries no updated_at, so the stamp is its
  // changeable fields: a Change (I3) or a re-accept changes this string.
  const stalenessStamp = [
    pkg.id,
    pkg.transportMode,
    pkg.stayTier,
    pkg.totalInr,
    pkg.startDate,
  ].join(':');

  const outcome = await transitionTrip(deps, {
    tripId,
    event: 'generateItinerary' satisfies ItineraryEvent,
    actorUserId: userId,
    beforeDecide: async (tx) => {
      const current = await tx
        .select({
          id: tripPackage.id,
          transportMode: tripPackage.transportMode,
          stayTier: tripPackage.stayTier,
          totalInr: tripPackage.totalInr,
          startDate: tripPackage.startDate,
        })
        .from(tripPackage)
        .where(and(eq(tripPackage.tripId, tripId), eq(tripPackage.status, 'accepted')))
        .limit(1);
      const stamp = current[0]
        ? [
            current[0].id,
            current[0].transportMode,
            current[0].stayTier,
            current[0].totalInr,
            current[0].startDate,
          ].join(':')
        : '';
      if (stamp !== stalenessStamp) {
        throw new AppError(
          409,
          ERROR_CODES.ITINERARY_STALE,
          'The package changed while planning. Try again.',
        );
      }
      await tx
        .update(itinerary)
        .set({ status: 'superseded' })
        .where(and(eq(itinerary.packageId, pkg.id), eq(itinerary.status, 'proposed')));
      const version = await nextVersion(tx, pkg.id);
      const { id: itineraryId } = await insertItinerary(tx, {
        packageId: pkg.id,
        version,
        status: 'proposed',
        model,
        summary: output.summary,
        reasons: output.reasons,
      });
      for (const day of output.days) {
        for (const [position, item] of day.items.entries()) {
          const verdict = result.items.find((v) => v.day === day.day && v.index === position);
          const poiRow = item.poiId ? poiIdOf.get(item.poiId) : undefined;
          const placeVerified = poiRow ? poiRow.reviewStatus === 'verified' : true;
          const verified = (verdict?.verified ?? false) && placeVerified;
          const unverifiedReason = verified
            ? null
            : (verdict?.reasons[0] ??
              (placeVerified ? null : "This place's details are not verified yet."));
          await tx.insert(itineraryItem).values({
            itineraryId,
            dayNumber: day.day,
            position,
            startTime: item.start,
            endTime: item.end,
            kind: item.kind,
            ...(poiRow ? { poiId: poiRow.id } : {}),
            note: item.note,
            verified,
            unverifiedReason,
          });
        }
      }
    },
  });
  void outcome;

  const latest = await getItinerary(db, tripId, userId);
  logger.info(
    {
      tripId,
      version: latest.itinerary?.version,
      source,
      durationMs: Math.round(performance.now() - started),
      itemCount: result.items.length,
      verifiedRatio: result.verifiedRatio,
      ok: result.ok,
      errorCodes: result.errors.map((e) => e.code),
      wordingFallback,
      wordingCache,
    },
    'itinerary planned',
  );
  return latest;
}

export async function getItinerary(
  db: Db,
  tripId: string,
  userId: string,
): Promise<ItineraryResponse> {
  const { trip: tripRow } = await loadTripForMember(db, tripId, userId);
  const row = await latestItineraryForTrip(db, tripId);
  if (!row) return { itinerary: null };
  const rows = await listItems(db, row.itinerary.id);
  const pkg = await db.query.tripPackage.findFirst({
    where: (t, { eq }) => eq(t.id, row.itinerary.packageId),
  });
  const dest = pkg
    ? await db.query.destination.findFirst({
        where: (d, { eq }) => eq(d.id, pkg.destinationId),
      })
    : undefined;
  const days = new Map<number, ItineraryView['days'][number]>();
  for (const { item, poi } of rows) {
    const entry = days.get(item.dayNumber) ?? {
      day: item.dayNumber,
      date: '',
      items: [] as ItineraryView['days'][number]['items'],
    };
    entry.items.push({
      id: item.id,
      day: item.dayNumber,
      position: item.position,
      start: item.startTime?.slice(0, 5) ?? null,
      end: item.endTime?.slice(0, 5) ?? null,
      kind: item.kind,
      place: poi
        ? {
            key: `${dest?.slug ?? ''}/${poi.poiKey}`,
            name: poi.name,
            category: poi.category,
            entryFeeInr: poi.entryFeeInr,
          }
        : null,
      legId: item.kind === 'travel' ? (item.dayNumber === 1 ? 'onward' : 'return') : null,
      note: item.note,
      verified: item.verified,
      unverifiedReason: item.unverifiedReason,
    });
    days.set(item.dayNumber, entry);
  }
  const dayList = [...days.values()];
  dayList.forEach((d, i) => {
    if (!d.date && pkg) {
      const date = new Date(`${pkg.startDate}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + i);
      d.date = date.toISOString().slice(0, 10);
    }
  });
  const legs = dayList
    .flatMap((d) => d.items)
    .filter((i) => i.kind === 'travel' && i.legId)
    .map((i) => ({
      id: i.legId!, // Safe: filtered to kind travel, which always has a leg.
      mode: pkg?.transportMode ?? 'car',
      depart: i.start ?? '00:00',
      arrive: i.end ?? '00:00',
      plannedTimes: true,
    }));
  void tripRow;
  return {
    itinerary: {
      id: row.itinerary.id,
      version: row.itinerary.version,
      status: row.itinerary.status,
      model: row.itinerary.model,
      source: row.itinerary.model === 'catalogue-planner' ? 'catalogue' : 'model',
      generatedAt: row.itinerary.generatedAt.toISOString(),
      summary: row.itinerary.summary,
      reasons: (row.itinerary.reasons as string[]) ?? [],
      legs,
      days: dayList,
      packageLabel: row.packageLabel,
    },
  };
}

async function decide(
  deps: Deps,
  tripId: string,
  userId: string,
  event: 'itineraryAccepted' | 'itineraryRejected',
) {
  const { db } = deps;
  const { trip: tripRow, membership } = await loadTripForMember(db, tripId, userId);
  requireActiveMember(membership);
  requireOrganiser(membership);
  assertEventLegal(tripRow.status, event, indiaDate(deps.clock()));
  const latest = await latestItineraryForTrip(db, tripId);
  if (!latest) {
    throw new AppError(409, ERROR_CODES.ILLEGAL_TRANSITION, 'There is no day plan yet.');
  }
  await transitionTrip(deps, {
    tripId,
    event,
    actorUserId: userId,
    beforeDecide: async (tx) => {
      await tx
        .update(itinerary)
        .set({ status: event === 'itineraryAccepted' ? 'accepted' : 'rejected' })
        .where(eq(itinerary.id, latest.itinerary.id));
      // T14: the plan's day 1 is its package's start date (items hold day numbers
      // only). T16's guard needs it to tell whether the trip has begun, and the
      // dashboard's Dates row needs both ends.
      if (event === 'itineraryAccepted') {
        await tx
          .update(trip)
          .set({
            startDate: latest.packageStartDate,
            endDate: addDaysUtc(latest.packageStartDate, tripRow.durationNights),
          })
          .where(eq(trip.id, tripId));
      }
    },
  });
  return getTrip(db, tripId, userId, deps.clock);
}

export const acceptItinerary = (deps: Deps, tripId: string, userId: string) =>
  decide(deps, tripId, userId, 'itineraryAccepted');

export const rejectItinerary = (deps: Deps, tripId: string, userId: string) =>
  decide(deps, tripId, userId, 'itineraryRejected');

type PlanningContext = Awaited<ReturnType<typeof planningContext>>;

function storedPlan(
  context: PlanningContext,
  rows: Awaited<ReturnType<typeof listItems>>,
): TripPlan {
  return {
    legs: context.plan.legs,
    scheduledPlaceKeys: rows.flatMap(({ poi }) =>
      poi ? [`${context.dest.slug}/${poi.poiKey}`] : [],
    ),
    days: context.plan.days.map((day) => ({
      day: day.day,
      date: day.date,
      items: rows
        .filter(({ item }) => item.dayNumber === day.day)
        .map(({ item, poi }) => ({
          start: item.startTime?.slice(0, 5) ?? '',
          end: item.endTime?.slice(0, 5) ?? '',
          kind: item.kind,
          ...(poi ? { placeKey: `${context.dest.slug}/${poi.poiKey}` } : {}),
          ...(item.kind === 'travel'
            ? { legId: item.dayNumber === 1 ? ('onward' as const) : ('return' as const) }
            : {}),
          note: item.note ?? '',
        })),
    })),
  };
}

async function adjustmentContext(deps: Deps, tripId: string, userId: string) {
  const { trip, membership } = await loadTripForMember(deps.db, tripId, userId);
  requireActiveMember(membership);
  requireOrganiser(membership);
  assertEventLegal(trip.status, 'itineraryModified', indiaDate(deps.clock()));
  return planningContext(deps.db, tripId, trip);
}

function slotFor(rows: Awaited<ReturnType<typeof listItems>>, itemId: string) {
  const row = rows.find(({ item }) => item.id === itemId);
  if (!row) throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Day-plan item not found.');
  if (row.item.kind !== 'activity' || !row.item.startTime || !row.item.endTime) {
    throw new AppError(422, ERROR_CODES.PLACE_DOES_NOT_FIT, 'Only a visit can be adjusted.');
  }
  return { row, start: row.item.startTime.slice(0, 5), end: row.item.endTime.slice(0, 5) };
}

export async function itineraryAlternatives(
  deps: Deps,
  tripId: string,
  itemId: string,
  userId: string,
) {
  const context = await adjustmentContext(deps, tripId, userId);
  const latest = await latestItineraryForTrip(deps.db, tripId);
  if (!latest) throw new AppError(409, ERROR_CODES.ILLEGAL_TRANSITION, 'There is no day plan yet.');
  const rows = await listItems(deps.db, latest.itinerary.id);
  const slot = slotFor(rows, itemId);
  const places = unusedPlacesFitting(
    storedPlan(context, rows),
    context.planInput,
    slot.row.item.dayNumber,
    slot,
  );
  return {
    places: places.map(({ key, name, category, entryFeeInr }) => ({
      key,
      name,
      category,
      entryFeeInr,
    })),
  };
}

export async function modifyItinerary(
  deps: Deps,
  tripId: string,
  itemId: string,
  userId: string,
  change: ModifyItineraryInput,
): Promise<ItineraryResponse> {
  const context = await adjustmentContext(deps, tripId, userId);
  await transitionTrip(deps, {
    tripId,
    event: 'itineraryModified',
    actorUserId: userId,
    beforeDecide: async (tx) => {
      const latest = await latestItineraryForTrip(tx, tripId);
      if (
        !latest ||
        latest.itinerary.status !== 'proposed' ||
        latest.itinerary.packageId !== context.pkg.id
      ) {
        throw new AppError(409, ERROR_CODES.ITINERARY_STALE, 'The day plan changed. Try again.');
      }
      const rows = await listItems(tx, latest.itinerary.id);
      const slot = slotFor(rows, itemId);
      const plan = storedPlan(context, rows);
      const replacement =
        change.action === 'replace'
          ? unusedPlacesFitting(plan, context.planInput, slot.row.item.dayNumber, slot).find(
              (p) => p.key === change.placeKey,
            )
          : undefined;
      if (change.action === 'replace' && !replacement) {
        throw new AppError(
          422,
          ERROR_CODES.PLACE_DOES_NOT_FIT,
          'That place does not fit this visit.',
        );
      }
      const poiRow = replacement
        ? (await listActivePois(tx, context.pkg.destinationId)).find(
            (p) => `${context.dest.slug}/${p.poiKey}` === replacement.key,
          )
        : undefined;
      if (replacement && !poiRow)
        throw new AppError(
          422,
          ERROR_CODES.PLACE_DOES_NOT_FIT,
          'That place does not fit this visit.',
        );
      await tx
        .update(itineraryItem)
        .set({
          kind: replacement ? 'activity' : 'free',
          poiId: poiRow?.id ?? null,
          note: replacement
            ? `Visit ${replacement.name} (${POI_CATEGORY_LABELS[replacement.category].toLowerCase()}). Entry ₹${replacement.entryFeeInr} per person.`
            : 'Free time to explore.',
        })
        .where(eq(itineraryItem.id, itemId));
      const updated = await listItems(tx, latest.itinerary.id);
      const output = toOutput(
        storedPlan(context, updated).days,
        latest.itinerary.summary ?? '',
        latest.itinerary.reasons as string[],
      );
      const result = validateItinerary(output, context.facts);
      if (!result.ok)
        throw new AppError(
          422,
          ERROR_CODES.PLACE_DOES_NOT_FIT,
          'That change does not fit this plan.',
        );
      for (const day of output.days) {
        const dayRows = updated.filter(({ item }) => item.dayNumber === day.day);
        for (const [index, row] of dayRows.entries()) {
          const verdict = result.items.find((v) => v.day === day.day && v.index === index);
          const placeVerified = !row.poi || row.poi.reviewStatus === 'verified';
          const verified = Boolean(verdict?.verified && placeVerified);
          await tx
            .update(itineraryItem)
            .set({
              verified,
              unverifiedReason: verified
                ? null
                : (verdict?.reasons[0] ?? "This place's details are not verified yet."),
            })
            .where(eq(itineraryItem.id, row.item.id));
        }
      }
    },
  });
  return getItinerary(deps.db, tripId, userId);
}

export type { TripStatus };
