import type { Db } from '@bonvoyage/db';
import { itinerary, itineraryItem, tripPackage } from '@bonvoyage/db/schema';
import { buildFactSheet, durationMinutes, planDays, validateItinerary } from '@bonvoyage/engine';
import { composeItineraryWording } from '@bonvoyage/integrations';
import type { LlmClient } from '@bonvoyage/integrations';
import { and, eq } from 'drizzle-orm';
import type { Logger } from 'pino';
import {
  ERROR_CODES,
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

  const pkg = await findAcceptedPackage(db, tripId);
  if (!pkg) throw new AppError(409, ERROR_CODES.ILLEGAL_TRANSITION, 'Choose a package first.');
  const members = await loadMembers(db, tripId);
  const dest = await db.query.destination.findFirst({
    where: (d, { eq }) => eq(d.id, pkg.destinationId),
  });
  if (!dest) throw new AppError(500, ERROR_CODES.INTERNAL, 'Something went wrong.');
  const input = await packageInput(db, tripRow, members, dest);

  const legMinutes = durationMinutes(input, pkg.transportMode);
  if (legMinutes === null) {
    throw new AppError(409, ERROR_CODES.ILLEGAL_TRANSITION, 'This package cannot be planned.');
  }
  const plan = planDays({
    startDate: pkg.startDate,
    nights: tripRow.durationNights,
    onward: { mode: pkg.transportMode, durationMinutes: legMinutes },
    ret: { mode: pkg.transportMode, durationMinutes: legMinutes },
    stayTier: pkg.stayTier,
    places: input.places,
    groupInterests: input.groupInterests,
  });

  const lines = await db.query.costItem.findMany({
    where: (c, { eq }) => eq(c.packageId, pkg.id),
  });
  const stayLine = lines.find((l) => l.category === 'stay');
  const onwardLine = lines.find((l) => l.category === 'onward');
  const facts = buildFactSheet({
    plan,
    input: {
      startDate: pkg.startDate,
      nights: tripRow.durationNights,
      onward: { mode: pkg.transportMode, durationMinutes: legMinutes },
      ret: { mode: pkg.transportMode, durationMinutes: legMinutes },
      stayTier: pkg.stayTier,
      places: input.places,
      groupInterests: input.groupInterests,
    },
    originName: input.originName,
    destination: { slug: dest.slug, name: dest.name, state: dest.state },
    groupSize: input.n,
    rooms: pkg.rooms,
    perRoomPerNightInr: Math.ceil(
      (stayLine?.amountInr ?? 0) / Math.max(1, pkg.rooms * tripRow.durationNights),
    ),
    farePerPersonInr: { onward: onwardLine?.amountInr ?? 0, return: onwardLine?.amountInr ?? 0 },
    costs: {
      totalInr: pkg.totalInr,
      perPersonInr: pkg.perPersonInr,
      items: lines.map((l) => ({ category: l.category, amountInr: l.amountInr })),
    },
  });

  const summary = `${tripRow.durationNights}-night trip to ${dest.name} for ${input.n} people.`;
  let output = toOutput(plan.days, summary, TEMPLATE.reasons);
  let model = TEMPLATE.model;
  let source: ItineraryView['source'] = 'catalogue';

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
    } else {
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
    },
  });
  return getTrip(db, tripId, userId);
}

export const acceptItinerary = (deps: Deps, tripId: string, userId: string) =>
  decide(deps, tripId, userId, 'itineraryAccepted');

export const rejectItinerary = (deps: Deps, tripId: string, userId: string) =>
  decide(deps, tripId, userId, 'itineraryRejected');

export type { TripStatus };
