// Conventions rule 7: "today" is the Asia/Kolkata calendar date. Callers pass
// the instant (from their clock dependency); this never reads the clock.

const indiaFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });

/** The Asia/Kolkata calendar date of an instant, as YYYY-MM-DD. */
export function indiaDate(date: Date): string {
  return indiaFormat.format(date);
}

const indiaClock = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/** An instant in India time for a sentence: "2 Nov, 3:40 pm". */
export function indiaDateTime(date: Date): string {
  return indiaClock
    .format(date)
    .replace(/\bam\b/i, 'am')
    .replace(/\bpm\b/i, 'pm');
}

/** Whole nights between two YYYY-MM-DD dates (end minus start; negative if reversed). */
export function nightsBetween(start: string, end: string): number {
  return Math.round(
    (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000,
  );
}
