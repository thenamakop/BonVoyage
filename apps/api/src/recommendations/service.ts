import type { Db } from '@bonvoyage/db';
import { hub } from '@bonvoyage/db/schema';
import {
  buildDiagnostic,
  capSource,
  evaluateCandidate,
  explainMatch,
  groupProfile,
  groupSummary,
  rankDestinations,
  type CostedDestination,
  type DestinationInput,
  type Evaluation,
  type Failure,
  type FeasibilityContext,
  type GroupProfile,
  type GroupSummary,
  type MatchExplanation,
  type MemberInput,
  type Suggestion,
  type Weights,
} from '@bonvoyage/engine';
import type { Routing } from '@bonvoyage/integrations/routing';
import {
  ERROR_CODES,
  indiaDate,
  type Activity,
  type ChooseDestinationInput,
  type DestinationType,
  type DiagnosticFailure,
  type GroupProfileReady,
  type GroupProfileResponse,
  type LatestRecommendationResponse,
  type RecommendationItem,
  type RecommendationKind,
  type RecommendationRun,
  type RequestRecommendationsResponse,
  type TransportMode,
  type TripDetail,
  type TripEventName,
} from '@bonvoyage/shared';
import { eq } from 'drizzle-orm';
import type { Logger } from 'pino';
import { AppError } from '../http/errors';
import { loadTripForMember, requireActiveMember, requireOrganiser } from '../trips/access';
import { draftPackages, storePackages } from '../packages/service';
import { MIN_MEMBERS_FOR_RANGE, hidesBudgetFigures } from './budget-figures';
import { getTrip } from '../trips/service';
import { assertEventLegal, transitionTrip } from '../trips/transition-trip';
import {
  findLatestRun,
  findRunItemDestination,
  insertItems,
  insertRun,
  listActiveDestinationRows,
  listLikedPastTypes,
  listParticipants,
  listPublicFares,
  listRunItems,
  nextRound,
  readCostRules,
  readRoundHistory,
  readStalenessStamp,
  setSelectedDestination,
  type DestinationRow,
  type ItemWithDestination,
  type Participant,
  type RunRow,
} from './repository';
import { earlierRounds, roundWeights } from './earlier-rounds';

// S2-6: recommendation runs (T4, T6>T7, T6>T8) and the destination choice (T9).
// Everything slow (profile, distances, F1 to F5, scores, diagnostic) is computed
// before the trip lock; beforeDecide re-checks that nothing changed and stores
// the run in the same transaction as the transition (rule S7).

export interface RecommendationHooks {
  /** Runs between computing and persisting; the staleness test revises a preference here. */
  afterCompute?: (tripId: string) => Promise<void>;
}

interface Deps {
  db: Db;
  logger: Logger;
  clock: () => Date;
}

interface RequestDeps extends Deps {
  routing: Routing;
  weights: Weights;
  /** R17 fairness lambda from scoring.json, stored on every run. */
  lambda: number;
  hooks?: RecommendationHooks;
}

/** A shortlist needs this many feasible destinations (T6 guard). */
const SHORTLIST_SIZE = 3;
/** 0004 g: below this best mean the page says the match is weak. */
const WEAK_MATCH_MEAN = 0.25;
/**
 * Group budget figures that come from members' limits are rounded to this many
 * rupees (0004 i), maxima and caps down, minima up, so a response never carries
 * a member's exact limit and never shows a cap above the real one.
 */
const GROUP_BUDGET_STEP = 500;

// ---------------------------------------------------------------------------
// Stored shapes. The run's `diagnostic` jsonb column holds the whole run
// document: the inputs the run was computed from (the group profile snapshot,
// member count, whose cap bound), the weak-match flag, the incomplete
// destinations and, for diagnostic runs, the diagnostic itself. The snapshot
// keeps a run auditable; it is never returned unrounded (views below), and
// GET group-profile still computes the live profile on read (0004 b). Each
// item's `reasons` holds per-member explanations.

type CapSource = ReturnType<typeof capSource>;

interface StoredEvaluation {
  slug: string;
  estimatedCostInr: number;
  cheapestMode: TransportMode;
  failures: Evaluation['failures'];
}

interface RunDocument {
  memberCount: number;
  weakMatch: boolean;
  groupProfile: GroupProfile;
  /** Whose limit set the group cap at run time (0004 c). */
  capSource: CapSource;
  /** 0004 e: active destinations left out for missing costs, on every run. */
  incomplete: string[];
  diagnostic: {
    feasible: string[];
    nearMisses: StoredEvaluation[];
    alternatives: StoredEvaluation[];
    suggestions: Suggestion[];
    incomplete: string[];
  } | null;
  /** Display names for every slug the diagnostic mentions. */
  names: Record<string, string>;
}

interface MemberReason extends MatchExplanation {
  tripMemberId: string;
  score: number;
}

interface ItemReasons {
  members: MemberReason[];
  summary: GroupSummary;
  cheapestMode: TransportMode;
}

// ---------------------------------------------------------------------------
// Mapping database rows to engine inputs.

function toMemberInput(p: Participant, likedPastTypes: readonly string[]): MemberInput {
  return {
    memberId: p.tripMemberId,
    types: p.preference.destinationTypes as DestinationType[],
    activities: p.preference.activities as Activity[],
    climate: p.preference.climate,
    likedPastTypes: likedPastTypes as DestinationType[],
    budgetMinInr: p.preference.budgetMinInr,
    budgetMaxInr: p.preference.budgetMaxInr,
    dateStart: p.preference.dateStart,
    dateEnd: p.preference.dateEnd,
  };
}

function toDestinationInput(d: DestinationRow): DestinationInput {
  return {
    id: d.id,
    slug: d.slug,
    types: d.types as DestinationType[],
    activities: d.activities as Activity[],
    climate: d.climate,
    bestMonths: d.bestMonths,
    minNights: d.minNights,
  };
}

/** 0004 e: a candidate needs its budget stay, food and local costs. */
function toCosted(d: DestinationRow): CostedDestination | null {
  if (d.stayBudgetInr === null || d.foodPerDayInr === null || d.localPerDayInr === null) {
    return null;
  }
  return {
    ...toDestinationInput(d),
    stayBudgetInr: d.stayBudgetInr,
    foodPerDayInr: d.foodPerDayInr,
    localPerDayInr: d.localPerDayInr,
  };
}

export async function loadMembers(db: Db, tripId: string) {
  const participants = await listParticipants(db, tripId);
  const liked = await listLikedPastTypes(
    db,
    participants.map((p) => p.userId),
  );
  return participants.map((p) => toMemberInput(p, liked.get(p.userId) ?? []));
}

// ---------------------------------------------------------------------------
// Group-facing views (0004 i).

const floorStep = (inr: number) => Math.floor(inr / GROUP_BUDGET_STEP) * GROUP_BUDGET_STEP;
const ceilStep = (inr: number) => Math.ceil(inr / GROUP_BUDGET_STEP) * GROUP_BUDGET_STEP;
const score10 = (score: number) => Math.round(score * 100) / 10;

/**
 * The group cap as the group may see it: the trip budget is shared with every
 * member, so a trip-sourced cap stays exact; a cap set by members' maxima is
 * n times the per-person cap rounded down.
 */
function shownGroupCap(profile: GroupProfile, source: CapSource): number {
  return source === 'trip'
    ? profile.groupCapInr
    : profile.memberCount * floorStep(profile.perPersonCapInr);
}

export function groupProfileView(profile: GroupProfile, source: CapSource): GroupProfileReady {
  const shared = <T extends string>(votes: { value: T; count: number }[]) =>
    votes.filter((v) => v.count >= 2);
  const singles = [...profile.typeVotes, ...profile.activityVotes, ...profile.climateVotes].filter(
    (v) => v.count === 1,
  ).length;
  const hide = hidesBudgetFigures(profile.memberCount);
  const minInr = ceilStep(profile.budgetBand.minInr);
  const maxInr = floorStep(profile.budgetBand.maxInr);
  return {
    ready: true,
    memberCount: profile.memberCount,
    commonWindow: profile.commonWindow,
    windowFits: profile.windowFits,
    budgetBand: {
      // A band narrower than one step would round to min > max; show it closed.
      minInr: hide ? null : profile.budgetBand.overlaps ? Math.min(minInr, maxInr) : minInr,
      maxInr: hide ? null : maxInr,
      overlaps: profile.budgetBand.overlaps,
    },
    perPersonCapInr: hide ? null : floorStep(profile.perPersonCapInr),
    // The trip budget is public, so a cap it sets is always shown.
    groupCapInr: hide && source === 'members' ? null : shownGroupCap(profile, source),
    typeVotes: shared(profile.typeVotes),
    activityVotes: shared(profile.activityVotes),
    climateVotes: shared(profile.climateVotes),
    otherInterestCount: singles,
    conflicts: profile.conflicts,
  };
}

/**
 * F5 compares the estimate with the group cap. When members' maxima set the
 * cap, the exact limit is n times the lowest member maximum, so the view
 * replaces it with the rounded cap the profile shows and recomputes the gap.
 * Below 3 contributors even the rounded cap gives a member's maximum away, and
 * actual - relaxation would rebuild it, so all three figures are left out (D1,
 * #116). The stored order, closest first by the real gap, is kept.
 */
function failureView(
  failure: Failure,
  source: CapSource,
  shownCapInr: number,
  memberCount: number,
): DiagnosticFailure {
  if (failure.id !== 'F5' || source === 'trip') return failure;
  if (hidesBudgetFigures(memberCount)) {
    return { ...failure, id: 'F5', limit: null, relaxation: null, relative: null };
  }
  const relaxation = failure.actual - shownCapInr;
  return {
    ...failure,
    limit: shownCapInr,
    relaxation,
    relative: shownCapInr > 0 ? relaxation / shownCapInr : 1,
  };
}

/** Runs stored before capSource and incomplete were added fall back safely. */
function sourceOf(doc: RunDocument): CapSource {
  if (doc.capSource) return doc.capSource;
  const p = doc.groupProfile;
  return p.groupCapInr < p.memberCount * p.perPersonCapInr ? 'trip' : 'members';
}

function toRunView(run: RunRow, doc: RunDocument, favoursLessServed: boolean): RecommendationRun {
  const source = sourceOf(doc);
  const shownCap = shownGroupCap(doc.groupProfile, source);
  const evaluationView = (e: StoredEvaluation) => ({
    ...e,
    name: doc.names[e.slug] ?? e.slug,
    failures: e.failures.map((f) => failureView(f, source, shownCap, doc.groupProfile.memberCount)),
  });
  const diagnostic = doc.diagnostic
    ? {
        feasible: doc.diagnostic.feasible,
        nearMisses: doc.diagnostic.nearMisses.map(evaluationView),
        alternatives: doc.diagnostic.alternatives.map(evaluationView),
        suggestions: doc.diagnostic.suggestions,
        incomplete: doc.diagnostic.incomplete,
      }
    : null;
  return {
    id: run.id,
    round: run.round,
    kind: run.kind,
    createdAt: run.createdAt.toISOString(),
    weights: { alpha: run.alpha, beta: run.beta, gamma: run.gamma },
    memberCount: doc.memberCount,
    feasibleCount: run.feasibleCount,
    bindingConstraint: run.bindingConstraint as RecommendationRun['bindingConstraint'],
    weakMatch: doc.weakMatch,
    favoursLessServed,
    incomplete: doc.incomplete ?? doc.diagnostic?.incomplete ?? [],
    diagnostic,
    groupProfile: groupProfileView(doc.groupProfile, source),
  };
}

function toItemView(
  row: ItemWithDestination,
  memberCount: number,
  callerTripMemberId: string,
): RecommendationItem {
  const reasons = row.item.reasons as ItemReasons;
  const own = reasons.members.find((m) => m.tripMemberId === callerTripMemberId);
  const scores = reasons.members.map((m) => m.score);
  const showRange = memberCount >= MIN_MEMBERS_FOR_RANGE;
  return {
    rank: row.item.rank,
    destination: row.destination,
    gfs: row.item.gfs,
    mean: row.item.mean,
    min: row.item.min,
    sd: row.item.sd,
    estimatedCostInr: row.item.estimatedCostInr,
    perPersonInr: Math.ceil(row.item.estimatedCostInr / memberCount),
    cheapestMode: reasons.cheapestMode,
    distanceKm: row.item.distanceKm,
    distanceProvenance: row.item.distanceProvenance as RecommendationItem['distanceProvenance'],
    group: {
      memberCount: reasons.summary.memberCount,
      climateMetCount: reasons.summary.climateMetCount,
      sharedTypes: reasons.summary.sharedTypes,
      sharedActivities: reasons.summary.sharedActivities,
      lowestScore10: showRange ? score10(Math.min(...scores)) : null,
      highestScore10: showRange ? score10(Math.max(...scores)) : null,
    },
    mine: own
      ? {
          score10: score10(own.score),
          metTypes: own.metTypes,
          missedTypes: own.missedTypes,
          metActivities: own.metActivities,
          missedActivities: own.missedActivities,
          climateMet: own.climateMet,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// GET /api/trips/:id/recommendations/latest: any member, excluded included.

export async function getLatestRecommendation(
  db: Db,
  tripId: string,
  userId: string,
): Promise<LatestRecommendationResponse> {
  const { membership } = await loadTripForMember(db, tripId, userId);
  const run = await findLatestRun(db, tripId);
  if (!run) return { run: null, items: [] };
  const doc = run.diagnostic as RunDocument;
  const rows = await listRunItems(db, run.id);
  return {
    run: toRunView(run, doc, await favoursLessServed(db, tripId, run, rows)),
    items: rows.map((row) => toItemView(row, doc.memberCount, membership.id)),
  };
}

/**
 * R7's fairness sentence shows when this run was ranked with weights that are not
 * all 1. They are recomputed from the stored scores and the run's own lambda,
 * exactly as planRun computed them, because they are never stored (E2).
 */
async function favoursLessServed(
  db: Db,
  tripId: string,
  run: RunRow,
  rows: readonly ItemWithDestination[],
): Promise<boolean> {
  const first = rows[0];
  if (run.lambda === 0 || run.round === 1 || !first) return false;
  const history = await readRoundHistory(db, tripId);
  const rounds = earlierRounds(history.runs, history.candidates, history.packages, run.round);
  const memberIds = (first.item.reasons as ItemReasons).members.map((m) => m.tripMemberId);
  return roundWeights(rounds, memberIds, run.lambda) !== undefined;
}

// GET /api/trips/:id/group-profile: any member; computed on read (0004 b).
export async function getGroupProfile(
  db: Db,
  tripId: string,
  userId: string,
): Promise<GroupProfileResponse> {
  const { trip: row } = await loadTripForMember(db, tripId, userId);
  const members = await loadMembers(db, tripId);
  if (members.length < 2) return { ready: false, memberCount: members.length };
  const profile = groupProfile(members, row);
  return groupProfileView(
    profile,
    capSource(row.budgetTotalInr, members.length, profile.perPersonCapInr),
  );
}

// ---------------------------------------------------------------------------
// POST /api/trips/:id/recommendations: the organiser, while ready.

interface Plan {
  event: Extract<TripEventName, 'conflictDetected' | 'recommendationRequested'>;
  feasibleCount: number;
  kind: RecommendationKind;
  bindingConstraint: string | null;
  doc: RunDocument;
  items: {
    destinationId: string;
    rank: number;
    gfs: number;
    mean: number;
    min: number;
    sd: number;
    estimatedCostInr: number;
    distanceKm: number;
    distanceProvenance: RecommendationItem['distanceProvenance'];
    reasons: ItemReasons;
  }[];
  candidates: number;
}

const storeEvaluation = (e: Evaluation): StoredEvaluation => ({
  slug: e.slug,
  estimatedCostInr: e.estimatedGroupCostInr,
  cheapestMode: e.cheapest.mode,
  failures: e.failures,
});

async function planRun(
  deps: RequestDeps,
  tripRow: {
    id: string;
    originHubId: string;
    durationNights: number;
    budgetTotalInr: number;
    radiusKm: number;
  },
  members: MemberInput[],
): Promise<Plan> {
  const { db, routing, weights, lambda } = deps;
  const profile = groupProfile(members, tripRow);
  const n = members.length;
  const source = capSource(tripRow.budgetTotalInr, n, profile.perPersonCapInr);

  // F3 (0004 c): a blocking window conflict sends the group back (T4).
  if (profile.commonWindow === null || profile.conflicts.some((c) => c.blocking)) {
    return {
      event: 'conflictDetected',
      feasibleCount: 0,
      kind: 'diagnostic',
      bindingConstraint: 'F3',
      doc: {
        memberCount: n,
        weakMatch: false,
        groupProfile: profile,
        capSource: source,
        // The catalogue is not read when the window blocks (F3).
        incomplete: [],
        diagnostic: {
          feasible: [],
          nearMisses: [],
          alternatives: [],
          suggestions: [],
          incomplete: [],
        },
        names: {},
      },
      items: [],
      candidates: 0,
    };
  }

  const [rows, hubRows, costRules, history] = await Promise.all([
    listActiveDestinationRows(db),
    db.select().from(hub).where(eq(hub.id, tripRow.originHubId)).limit(1),
    readCostRules(db),
    readRoundHistory(db, tripRow.id),
  ]);
  const origin = hubRows[0];
  if (!origin || !costRules) {
    deps.logger.error(
      { hasHub: Boolean(origin), hasCostRules: Boolean(costRules) },
      'recommendation inputs missing from the catalogue',
    );
    throw new AppError(500, ERROR_CODES.INTERNAL, 'Something went wrong.');
  }

  const costed: { row: DestinationRow; destination: CostedDestination }[] = [];
  const incomplete: string[] = [];
  for (const row of rows) {
    const destination = toCosted(row);
    if (destination) costed.push({ row, destination });
    else incomplete.push(row.slug);
  }

  const [distances, fares] = await Promise.all([
    routing.getDistances(
      { key: origin.slug, lat: origin.lat, lng: origin.lng },
      costed.map(({ row }) => ({ id: row.id, lat: row.lat, lng: row.lng })),
    ),
    listPublicFares(db, origin.id),
  ]);

  const ctx: FeasibilityContext = {
    n,
    durationNights: tripRow.durationNights,
    radiusKm: tripRow.radiusKm,
    groupCapInr: profile.groupCapInr,
    capSource: source,
    perPersonCapInr: profile.perPersonCapInr,
    commonWindow: { start: profile.commonWindow.start, end: profile.commonWindow.end },
  };

  const evaluated = costed.map(({ row, destination }) => {
    const distance = distances.get(row.id);
    if (!distance) throw new Error(`routing returned no distance for ${row.slug}`);
    const evaluation = evaluateCandidate(
      {
        destination,
        distanceKm: distance.km,
        distanceProvenance: distance.provenance,
        fares: fares.get(row.id) ?? { busInr: null, trainInr: null },
        costRules,
      },
      ctx,
    );
    return { row, destination, distance, evaluation };
  });

  const feasible = evaluated.filter((e) => e.evaluation.feasible);
  // R17: every existing run is earlier than this one. Only the order follows the
  // weights; items keep the unweighted gfs, mean, min and sd (E1).
  const memberWeights = roundWeights(
    earlierRounds(history.runs, history.candidates, history.packages, Infinity),
    members.map((m) => m.memberId),
    lambda,
  );
  const ranked = rankDestinations(
    members,
    feasible.map((e) => e.destination),
    weights,
    memberWeights,
  );
  const diagnostic = buildDiagnostic({
    evaluations: evaluated.map((e) => e.evaluation),
    ctx,
    profile,
    incomplete,
  });
  const byId = new Map(feasible.map((e) => [e.row.id, e]));

  const items = ranked.map((r, index) => {
    // Safe: rankDestinations ranks exactly the feasible destinations in byId.
    const facts = byId.get(r.destinationId)!;
    const explanations = members.map((m) => explainMatch(m, facts.destination));
    const reasons: ItemReasons = {
      members: members.map((m, i) => ({
        tripMemberId: m.memberId,
        score: r.memberScores.find((s) => s.memberId === m.memberId)?.score ?? 0,
        // Safe: explanations was mapped from the same members array.
        ...explanations[i]!,
      })),
      summary: groupSummary(explanations, n),
      cheapestMode: facts.evaluation.cheapest.mode,
    };
    return {
      destinationId: r.destinationId,
      rank: index + 1,
      gfs: r.gfs,
      mean: r.mean,
      min: r.min,
      sd: r.sd,
      estimatedCostInr: facts.evaluation.estimatedGroupCostInr,
      distanceKm: facts.distance.km,
      distanceProvenance: facts.distance.provenance,
      reasons,
    };
  });

  const kind: RecommendationKind =
    diagnostic.feasibleCount >= SHORTLIST_SIZE ? 'shortlist' : 'diagnostic';
  const nameBySlug = new Map(rows.map((row) => [row.slug, row.name]));
  const names: Record<string, string> = {};
  for (const e of diagnostic.nearMisses) names[e.slug] = nameBySlug.get(e.slug) ?? e.slug;
  return {
    event: 'recommendationRequested',
    feasibleCount: diagnostic.feasibleCount,
    kind,
    bindingConstraint: diagnostic.bindingConstraint,
    doc: {
      memberCount: n,
      weakMatch: ranked.length > 0 && Math.max(...ranked.map((r) => r.mean)) < WEAK_MATCH_MEAN,
      groupProfile: profile,
      capSource: source,
      incomplete: diagnostic.incomplete,
      diagnostic:
        kind === 'diagnostic'
          ? {
              feasible: diagnostic.feasible,
              nearMisses: diagnostic.nearMisses.map(storeEvaluation),
              alternatives: diagnostic.alternatives.map(storeEvaluation),
              suggestions: diagnostic.suggestions,
              incomplete: diagnostic.incomplete,
            }
          : null,
      names,
    },
    items,
    candidates: costed.length,
  };
}

export async function requestRecommendations(
  deps: RequestDeps,
  tripId: string,
  userId: string,
): Promise<RequestRecommendationsResponse> {
  const started = performance.now();
  const { db, logger, clock, weights, lambda } = deps;
  const { trip: tripRow, membership } = await loadTripForMember(db, tripId, userId);
  requireActiveMember(membership);
  requireOrganiser(membership);
  assertEventLegal(tripRow.status, 'recommendationRequested', indiaDate(clock()));

  const stamp = await readStalenessStamp(db, tripId);
  const members = await loadMembers(db, tripId);
  if (members.length < 2) {
    throw new AppError(409, ERROR_CODES.GUARD_FAILED, 'At least 2 members need to submit first.');
  }
  const plan = await planRun(deps, tripRow, members);
  await deps.hooks?.afterCompute?.(tripId);

  const outcome = await transitionTrip(
    { db, logger, clock },
    {
      tripId,
      event: plan.event,
      actorUserId: userId,
      ...(plan.event === 'recommendationRequested' ? { feasibleCount: plan.feasibleCount } : {}),
      beforeDecide: async (tx, locked) => {
        // A request that lost a race to another run sees the new status here and
        // gets the state machine's 409, not a misleading staleness message.
        assertEventLegal(locked.status, plan.event, indiaDate(clock()));
        if ((await readStalenessStamp(tx, tripId)) !== stamp) {
          throw new AppError(
            409,
            ERROR_CODES.RECOMMENDATION_STALE,
            'Preferences changed while recommending. Try again.',
          );
        }
        const run = await insertRun(tx, {
          tripId,
          round: await nextRound(tx, tripId),
          kind: plan.kind,
          alpha: weights.alpha,
          beta: weights.beta,
          gamma: weights.gamma,
          lambda,
          feasibleCount: plan.feasibleCount,
          bindingConstraint: plan.bindingConstraint,
          diagnostic: plan.doc,
        });
        await insertItems(
          tx,
          plan.items.map((item) => ({ ...item, runId: run.id })),
        );
      },
    },
  );

  const latest = await getLatestRecommendation(db, tripId, userId);
  logger.info(
    {
      tripId,
      round: latest.run?.round,
      kind: plan.kind,
      feasibleCount: plan.feasibleCount,
      candidates: plan.candidates,
      durationMs: Math.round(performance.now() - started),
    },
    'recommendation run stored',
  );
  return { ...latest, transition: { transitionId: outcome.transitionId, to: outcome.to } };
}

// ---------------------------------------------------------------------------
// POST /api/trips/:id/destination: the organiser picks from the shortlist (T9).

export async function chooseDestination(
  deps: Deps,
  tripId: string,
  userId: string,
  input: ChooseDestinationInput,
): Promise<TripDetail> {
  const { db, clock } = deps;
  const { trip: tripRow, membership } = await loadTripForMember(db, tripId, userId);
  requireActiveMember(membership);
  requireOrganiser(membership);
  assertEventLegal(tripRow.status, 'destinationSelected', indiaDate(clock()));

  const run = await findLatestRun(db, tripId);
  const destinationId =
    run?.kind === 'shortlist'
      ? await findRunItemDestination(db, run.id, input.destinationSlug)
      : undefined;
  if (!destinationId) {
    throw new AppError(
      422,
      ERROR_CODES.DESTINATION_NOT_IN_SHORTLIST,
      'Choose a destination from the shortlist.',
      { destinationSlug: 'Choose a destination from the shortlist.' },
    );
  }

  // 0005 a (T9): packages are computed with the real catalogue before the
  // lock, then stored atomically with the transition in beforeDecide.
  const members = await loadMembers(db, tripId);
  const { drafts } = await draftPackages(db, tripRow, members, destinationId);
  await transitionTrip(deps, {
    tripId,
    event: 'destinationSelected',
    actorUserId: userId,
    beforeDecide: async (tx) => {
      await setSelectedDestination(tx, tripId, destinationId);
      await storePackages(tx, tripId, destinationId, drafts);
    },
  });
  return getTrip(db, tripId, userId);
}
