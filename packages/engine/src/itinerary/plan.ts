import type {
  Activity,
  ItineraryItemKind,
  PoiCategory,
  StayTier,
  TransportMode,
} from '@bonvoyage/shared';
import { POI_CATEGORY_LABELS } from '@bonvoyage/shared';
import { groupInterestCategories } from './interests';

// 0005 e: the pure day planner. All times are minutes after midnight; emitted
// strings are HH:MM on the UTC calendar. No clock, no I/O, no randomness (P2).

export interface PlannerPlace {
  key: string;
  name: string;
  category: PoiCategory;
  typicalMinutes: number;
  openTime: string | null;
  closeTime: string | null;
  closedDays: number[];
  entryFeeInr: number;
  verified: boolean;
}

export interface PlanInput {
  startDate: string;
  nights: number;
  onward: { mode: TransportMode; durationMinutes: number };
  ret: { mode: TransportMode; durationMinutes: number };
  stayTier: StayTier;
  places: PlannerPlace[];
  groupInterests: Activity[];
}

export interface PlanLeg {
  id: 'onward' | 'return';
  mode: TransportMode;
  depart: string;
  arrive: string;
  durationMinutes: number;
}

export interface PlanItem {
  start: string;
  end: string;
  kind: ItineraryItemKind;
  placeKey?: string;
  legId?: 'onward' | 'return';
  note: string;
}

export interface PlanDay {
  day: number;
  date: string;
  items: PlanItem[];
}

export interface TripPlan {
  legs: PlanLeg[];
  days: PlanDay[];
  scheduledPlaceKeys: string[];
}

const DAY_START = 9 * 60; // 09:00
const ACTIVITY_END = 19 * 60; // 19:00
const MEAL_START = 13 * 60; // 13:00
const MEAL_MINUTES = 60;
const ACTIVITY_GAP = 30;
const MAX_MINUTE = 23 * 60 + 59; // a slot running past 23:59 does not fit
const ONWARD_DEPART = 6 * 60;
const RETURN_BASE = 22 * 60;
const RETURN_MIN = 6 * 60;
const RETURN_MAX = 16 * 60;
const CHECK_IN_MINUTES = 60;
const MIDDLE_DAY_MAX_ACTIVITIES = 3;
const FREE_MIN_MINUTES = 120;

const TIER_STAY_LABEL: Record<StayTier, string> = {
  budget: 'budget',
  mid: 'mid-range',
  premium: 'premium',
};

function toMinutes(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
}

function toHHMM(minutes: number): string {
  const clamped = Math.min(minutes, MAX_MINUTE);
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function addDaysUtc(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Plain UTC arithmetic on the date string; no local time zone, no Date.now.
export function weekdayOf(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00Z`).getUTCDay();
}

// 0005 e: the whole slot must sit inside the place's hours (both empty means
// open at all hours) and the day must not be one of its closed days.
export function placeFits(
  place: PlannerPlace,
  startMinutes: number,
  endMinutes: number,
  weekday: number,
): boolean {
  if (place.closedDays.includes(weekday)) return false;
  if (endMinutes > MAX_MINUTE) return false;
  if (place.openTime !== null && startMinutes < toMinutes(place.openTime)) return false;
  if (place.closeTime !== null && endMinutes > toMinutes(place.closeTime)) return false;
  return true;
}

// Choice order (0005 e): interest match (+2), verified (+1), then typical
// minutes ascending, then key ascending.
function placeScore(place: PlannerPlace, interestCategories: ReadonlySet<PoiCategory>): number {
  return (interestCategories.has(place.category) ? 2 : 0) + (place.verified ? 1 : 0);
}

function choiceOrder(
  places: readonly PlannerPlace[],
  interestCategories: ReadonlySet<PoiCategory>,
  used: ReadonlySet<string>,
): PlannerPlace[] {
  return places
    .filter((place) => !used.has(place.key))
    .sort((a, b) => {
      const byScore = placeScore(b, interestCategories) - placeScore(a, interestCategories);
      if (byScore !== 0) return byScore;
      const byMinutes = a.typicalMinutes - b.typicalMinutes;
      if (byMinutes !== 0) return byMinutes;
      return a.key.localeCompare(b.key);
    });
}

function activityNote(place: PlannerPlace): string {
  return `Visit ${place.name} (${POI_CATEGORY_LABELS[place.category].toLowerCase()}). Entry ₹${place.entryFeeInr} per person.`;
}

interface ScheduleState {
  items: PlanItem[];
  used: Set<string>;
  scheduled: string[];
}

function scheduleActivities(
  state: ScheduleState,
  ordered: PlannerPlace[],
  weekday: number,
  startCursor: number,
  windowEnd: number,
  options: { maxActivities: number | null; gap: number; meal: boolean },
): void {
  let cursor = startCursor;
  let activities = 0;
  let mealPlaced = false;
  const placeMeal = (at: number): void => {
    const mealStart = Math.max(MEAL_START, at);
    state.items.push({
      start: toHHMM(mealStart),
      end: toHHMM(mealStart + MEAL_MINUTES),
      kind: 'meal',
      note: 'Lunch break.',
    });
    mealPlaced = true;
    cursor = Math.max(cursor, mealStart + MEAL_MINUTES + options.gap);
  };
  const placeActivity = (place: PlannerPlace, start: number): void => {
    const end = start + place.typicalMinutes;
    state.items.push({
      start: toHHMM(start),
      end: toHHMM(end),
      kind: 'activity',
      placeKey: place.key,
      note: activityNote(place),
    });
    state.used.add(place.key);
    state.scheduled.push(place.key);
    activities += 1;
    cursor = end + options.gap;
    // 0005 e: a 60-minute meal from 13:00, or straight after the activity
    // running at 13:00.
    if (options.meal && !mealPlaced && end >= MEAL_START) placeMeal(end);
  };
  for (const place of ordered) {
    if (options.maxActivities !== null && activities >= options.maxActivities) break;
    // Lunch is late: place it before scheduling anything further.
    if (options.meal && !mealPlaced && cursor > MEAL_START) placeMeal(cursor - options.gap);
    const start = cursor;
    const end = start + place.typicalMinutes;
    if (end > windowEnd || !placeFits(place, start, end, weekday)) continue;
    placeActivity(place, start);
  }
  if (options.meal && !mealPlaced) {
    const lastEnd = state.items.reduce(
      (end, item) => Math.max(end, toMinutes(item.end)),
      cursor - options.gap,
    );
    placeMeal(lastEnd);
  }
}

export function planDays(input: PlanInput): TripPlan {
  const interestCategories = groupInterestCategories(input.groupInterests);
  const used = new Set<string>();
  const state: ScheduleState = { items: [], used, scheduled: [] };

  const days = input.nights + 1;
  const onwardDepart = ONWARD_DEPART;
  const onwardArrive = onwardDepart + input.onward.durationMinutes;
  const returnDepart = Math.min(
    Math.max(RETURN_BASE - input.ret.durationMinutes, RETURN_MIN),
    RETURN_MAX,
  );
  const returnArrive = returnDepart + input.ret.durationMinutes;

  const legs: PlanLeg[] = [
    {
      id: 'onward',
      mode: input.onward.mode,
      depart: toHHMM(onwardDepart),
      arrive: toHHMM(onwardArrive),
      durationMinutes: input.onward.durationMinutes,
    },
    {
      id: 'return',
      mode: input.ret.mode,
      depart: toHHMM(returnDepart),
      arrive: toHHMM(returnArrive),
      durationMinutes: input.ret.durationMinutes,
    },
  ];

  const outDays: PlanDay[] = [];

  for (let index = 0; index < days; index += 1) {
    const day = index + 1;
    const date = addDaysUtc(input.startDate, index);
    const weekday = weekdayOf(date);
    const ordered = choiceOrder(input.places, interestCategories, used);
    const items: PlanItem[] = [];
    let cursor: number;
    let windowEnd: number;

    if (index === 0) {
      items.push({
        start: toHHMM(onwardDepart),
        end: toHHMM(onwardArrive),
        kind: 'travel',
        legId: 'onward',
        note: 'Onward journey.',
      });
      const checkInEnd = Math.min(onwardArrive + CHECK_IN_MINUTES, MAX_MINUTE);
      items.push({
        start: toHHMM(onwardArrive),
        end: toHHMM(checkInEnd),
        kind: 'stay',
        note: `Check in to your ${TIER_STAY_LABEL[input.stayTier]} stay.`,
      });
      cursor = checkInEnd;
      windowEnd = ACTIVITY_END;
    } else if (index === days - 1) {
      cursor = DAY_START;
      windowEnd = returnDepart - 60; // leave an hour before the return leg
    } else {
      cursor = DAY_START;
      windowEnd = ACTIVITY_END;
    }

    const dayState: ScheduleState = { items, used, scheduled: state.scheduled };
    const isMiddle = index !== 0 && index !== days - 1;
    scheduleActivities(dayState, ordered, weekday, cursor, windowEnd, {
      maxActivities: isMiddle ? MIDDLE_DAY_MAX_ACTIVITIES : null,
      gap: isMiddle ? ACTIVITY_GAP : 0,
      meal: isMiddle,
    });

    // 0005 e: a free item fills a day with fewer than 2 activities and at
    // least 2 hours left in its activity window.
    const activityCount = items.filter((item) => item.kind === 'activity').length;
    const lastEnd = items.reduce(
      (end, item) => Math.max(end, toMinutes(item.end)),
      index === 0 ? 0 : DAY_START,
    );
    if (activityCount < 2 && windowEnd - lastEnd >= FREE_MIN_MINUTES) {
      items.push({
        start: toHHMM(lastEnd),
        end: toHHMM(windowEnd),
        kind: 'free',
        note: 'Free time to explore.',
      });
    }

    if (index === days - 1) {
      items.push({
        start: toHHMM(returnDepart),
        end: toHHMM(returnArrive),
        kind: 'travel',
        legId: 'return',
        note: 'Return journey.',
      });
    }

    items.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    outDays.push({ day, date, items });
  }

  return { legs, days: outDays, scheduledPlaceKeys: state.scheduled };
}

// 0005 h (I5): the unused places that fit a given slot on a given day, in the
// same choice order the planner used. For S3-7's replace action.
export function unusedPlacesFitting(
  plan: TripPlan,
  input: PlanInput,
  day: number,
  slot: { start: string; end: string },
): PlannerPlace[] {
  const interestCategories = groupInterestCategories(input.groupInterests);
  const used = new Set(plan.scheduledPlaceKeys);
  const date = plan.days[day - 1]?.date;
  if (date === undefined) return [];
  const weekday = weekdayOf(date);
  const start = toMinutes(slot.start);
  const end = toMinutes(slot.end);
  return choiceOrder(input.places, interestCategories, used).filter((place) =>
    placeFits(place, start, end, weekday),
  );
}
