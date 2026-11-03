import { addDaysUtc, weekdayOf } from '@bonvoyage/engine';

// #154: the demo trips' dates follow the run day, but only to the first
// weekend that keeps every destination the demo script names in season. A
// reset after the season ends then still shows the script's places, weekdays
// and prices.

/** The first window starts at least this many days after the run day. */
export const DEMO_MIN_LEAD_DAYS = 14;
/** How far ahead to look for a window before giving up. */
export const DEMO_SEARCH_DAYS = 400;

const SATURDAY = 6;

export interface DemoAnchor {
  slug: string;
  bestMonths: readonly number[];
}

/** Every night from `start` falls in a best month of every anchor (F4, R4). */
export function nightsInSeason(
  start: string,
  nights: number,
  anchors: readonly DemoAnchor[],
): boolean {
  for (let i = 0; i < nights; i++) {
    const month = Number(addDaysUtc(start, i).slice(5, 7));
    if (!anchors.every((a) => a.bestMonths.includes(month))) return false;
  }
  return true;
}

/**
 * The first Saturday at least DEMO_MIN_LEAD_DAYS after `today` (YYYY-MM-DD, India date)
 * such that every night is in season for every anchor. Throws if none lies within
 * DEMO_SEARCH_DAYS.
 */
export function demoWindowStart(
  today: string,
  nights: number,
  anchors: readonly DemoAnchor[],
): string {
  for (let lead = DEMO_MIN_LEAD_DAYS; lead <= DEMO_SEARCH_DAYS; lead++) {
    const start = addDaysUtc(today, lead);
    if (weekdayOf(start) === SATURDAY && nightsInSeason(start, nights, anchors)) return start;
  }
  const names = anchors.map((a) => `${a.slug} (${a.bestMonths.join('|')})`).join(', ');
  throw new Error(
    `No Saturday window of ${nights} nights within ${DEMO_SEARCH_DAYS} days of ${today} is in season for ${names}.`,
  );
}
