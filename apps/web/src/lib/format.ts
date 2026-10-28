const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const dateFmt = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});

const dateTimeFmt = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
});

const relative = new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' });

export function formatInr(amount: number): string {
  return inr.format(amount);
}

/** One wording for a place's fee on the day plan and in the Swap list. */
export function entryFeeText(entryFeeInr: number): string {
  return entryFeeInr > 0 ? `Entry ${formatInr(entryFeeInr)} per person (estimate)` : 'Free entry';
}

export function formatDate(isoDate: string | Date): string {
  return dateFmt.format(typeof isoDate === 'string' ? new Date(isoDate) : isoDate);
}

/** "13 Oct 2026, 2:05 pm" in India time, for title attributes. */
export function formatDateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso));
}

/** "just now", "5 minutes ago", "2 hours ago", "yesterday", "3 days ago". */
export function formatRelative(iso: string, now: number): string {
  const seconds = Math.round((Date.parse(iso) - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return 'just now';
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute');
  if (abs < 86_400) return relative.format(Math.round(seconds / 3600), 'hour');
  return relative.format(Math.round(seconds / 86_400), 'day');
}

/** The dashboard footer: "Updated just now", "Updated 5 seconds ago", "Updated 2 minutes ago". */
export function updatedAgo(updatedAt: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - updatedAt) / 1000));
  if (seconds < 5) return 'Updated just now';
  if (seconds < 60) return `Updated ${Math.floor(seconds / 5) * 5} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  return `Updated ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
}

/**
 * The one per-person wording (S1-2 review): the group total over the active
 * members, rounded down to ₹500. A lone member has no share to show yet.
 */
export function perPersonShare(totalInr: number, activeCount: number): string {
  if (activeCount <= 1) return 'Per-person share appears once people join';
  return `about ${formatInr(Math.floor(totalInr / activeCount / 500) * 500)} each`;
}

/** "The group budget is ₹48,000, about ₹16,000 each for 3 members." (S1-4) */
export function groupBudgetLine(totalInr: number, activeCount: number): string {
  const total = `The group budget is ${formatInr(totalInr)}`;
  if (activeCount <= 1) return `${total}. ${perPersonShare(totalInr, activeCount)}.`;
  return `${total}, ${perPersonShare(totalInr, activeCount)} for ${activeCount} members.`;
}

// "Delhi" rather than "Delhi, Delhi" when the hub is its own state or territory.
export function formatHub(hub: { name: string; state: string }): string {
  return hub.state === hub.name ? hub.name : `${hub.name}, ${hub.state}`;
}
