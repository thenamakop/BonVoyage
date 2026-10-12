import type { FactSheet, ItineraryOutput } from '@bonvoyage/shared';

export interface ValidationError {
  code: string;
  message: string;
  day?: number;
}

export interface ItemVerdict {
  day: number;
  index: number;
  verified: boolean;
  reasons: string[];
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationError[];
  items: ItemVerdict[];
  verifiedRatio: number;
}

const TIME_TOKEN = /\d{1,2}:\d{2}/;
const NUMBER_TOKEN = /(?:₹|Rs\.?)\s?\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?/;
const TOKEN = new RegExp(`${TIME_TOKEN.source}|${NUMBER_TOKEN.source}`, 'g');

function toMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

interface Token {
  kind: 'time' | 'number';
  raw: string;
  value: number | string;
}

function extractTokens(text: string): Token[] {
  const tokens: Token[] = [];
  for (const match of text.matchAll(TOKEN)) {
    const raw = match[0];
    if (TIME_TOKEN.test(raw)) {
      tokens.push({ kind: 'time', raw, value: raw });
    } else {
      const cleaned = raw.replace(/^(?:₹|Rs\.?)\s?/, '').replaceAll(',', '');
      const value = Number(cleaned);
      if (Number.isFinite(value)) tokens.push({ kind: 'number', raw, value });
    }
  }
  return tokens;
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function validateItinerary(output: ItineraryOutput, facts: FactSheet): ValidationResult {
  const errors: ValidationError[] = [];
  const items: ItemVerdict[] = [];

  const factNumbers = new Set<number>();
  const factTimes = new Set<string>();
  for (const token of extractTokens(JSON.stringify(facts))) {
    if (token.kind === 'number') factNumbers.add(token.value as number);
    else factTimes.add(token.value as string);
  }
  factNumbers.add(facts.trip.nights);
  factNumbers.add(facts.trip.groupSize);

  const expectedDays = facts.trip.nights + 1;
  const dayCount = output.days.length;
  const poisById = new Map(facts.pois.map((poi) => [poi.id, poi]));

  const numberAllowed = (value: number) =>
    factNumbers.has(value) || (value >= 1 && value <= dayCount && Number.isInteger(value));

  for (const [dayIndex, day] of output.days.entries()) {
    const dayNumber = dayIndex + 1;
    if (day.day !== dayNumber) {
      errors.push({
        code: 'WRONG_DAY_NUMBER',
        message: `Day ${dayIndex + 1} is labelled ${day.day}.`,
        day: dayIndex + 1,
      });
    }
    if (day.date !== addDays(facts.trip.startDate, dayIndex)) {
      errors.push({
        code: 'WRONG_DATE',
        message: `Day ${dayNumber} is dated ${day.date}, expected ${addDays(facts.trip.startDate, dayIndex)}.`,
        day: dayNumber,
      });
    }
    const weekday = new Date(`${day.date}T00:00:00Z`).getUTCDay();

    let previousEnd: number | null = null;
    let dayStart: number | null = null;
    let dayEnd: number | null = null;

    for (const [itemIndex, item] of day.items.entries()) {
      const reasons: string[] = [];
      const start = toMinutes(item.start);
      const end = toMinutes(item.end);

      if (start === null || end === null) {
        errors.push({
          code: 'INVALID_TIME',
          message: `Day ${dayNumber} item ${itemIndex + 1} has an invalid time.`,
          day: dayNumber,
        });
      } else {
        if (end <= start) {
          errors.push({
            code: 'END_BEFORE_START',
            message: `Day ${dayNumber} item ${itemIndex + 1} ends at or before it starts.`,
            day: dayNumber,
          });
        }
        if (previousEnd !== null && start < previousEnd) {
          errors.push({
            code: 'OVERLAP',
            message: `Day ${dayNumber} item ${itemIndex + 1} overlaps the previous item.`,
            day: dayNumber,
          });
        }
        if (end > (previousEnd ?? 0)) previousEnd = end;
        if (item.kind !== 'stay') {
          if (dayStart === null || start < dayStart) dayStart = start;
          if (dayEnd === null || end > dayEnd) dayEnd = end;
        }
      }

      if (item.poiId !== undefined) {
        const poi = poisById.get(item.poiId);
        if (!poi) {
          reasons.push(`unknown poiId "${item.poiId}"`);
        } else if (item.kind === 'activity') {
          const openAt = poi.openTime === null ? null : toMinutes(poi.openTime);
          const closeAt = poi.closeTime === null ? null : toMinutes(poi.closeTime);
          if (openAt !== null && start !== null && start < openAt) {
            reasons.push(`starts before ${poi.id} opens at ${poi.openTime}`);
          }
          if (closeAt !== null && end !== null && end > closeAt) {
            reasons.push(`ends after ${poi.id} closes at ${poi.closeTime}`);
          }
          if (poi.closedDays.includes(weekday)) {
            reasons.push(`${poi.id} is closed on this weekday`);
          }
        }
      } else if (item.kind === 'activity') {
        reasons.push('activity without a poiId');
      }

      for (const token of extractTokens(item.note)) {
        if (token.kind === 'time') {
          const known =
            token.value === item.start ||
            token.value === item.end ||
            factTimes.has(token.value as string);
          if (!known) reasons.push(`unverified time ${token.raw} in note`);
        } else if (!numberAllowed(token.value as number)) {
          reasons.push(`unverified number ${token.raw} in note`);
        }
      }

      items.push({ day: dayNumber, index: itemIndex, verified: reasons.length === 0, reasons });
    }

    if (dayStart !== null && dayEnd !== null && dayEnd - dayStart > facts.limits.maxDayHours * 60) {
      errors.push({
        code: 'DAY_TOO_LONG',
        message: `Day ${dayNumber} runs ${dayEnd - dayStart} minutes, over the ${facts.limits.maxDayHours} hour limit.`,
        day: dayNumber,
      });
    }
  }

  if (dayCount !== expectedDays) {
    errors.push({
      code: 'WRONG_DAY_COUNT',
      message: `${dayCount} days for ${facts.trip.nights} nights; expected ${expectedDays}.`,
    });
  }
  const firstDay = output.days.at(0);
  const lastDay = output.days.at(-1);
  if (!firstDay?.items.some((item) => item.kind === 'travel' && item.legId === 'onward')) {
    errors.push({
      code: 'MISSING_ONWARD_LEG',
      message: 'Day 1 has no travel item with legId onward.',
      day: 1,
    });
  }
  if (!lastDay?.items.some((item) => item.kind === 'travel' && item.legId === 'return')) {
    errors.push({
      code: 'MISSING_RETURN_LEG',
      message: `The last day has no travel item with legId return.`,
      day: dayCount,
    });
  }

  for (const text of [output.summary, ...output.reasons]) {
    for (const token of extractTokens(text)) {
      const known =
        token.kind === 'time'
          ? factTimes.has(token.value as string)
          : numberAllowed(token.value as number);
      if (!known) {
        errors.push({
          code: 'UNVERIFIED_NUMBER',
          message: `${token.kind === 'time' ? 'Time' : 'Number'} ${token.raw} does not appear in the fact sheet.`,
        });
      }
    }
  }

  const verified = items.filter((item) => item.verified).length;
  return {
    ok: errors.length === 0,
    errors,
    items,
    verifiedRatio: items.length === 0 ? 1 : verified / items.length,
  };
}
