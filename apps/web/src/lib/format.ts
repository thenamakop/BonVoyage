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

export function formatInr(amount: number): string {
  return inr.format(amount);
}

export function formatDate(isoDate: string | Date): string {
  return dateFmt.format(typeof isoDate === 'string' ? new Date(isoDate) : isoDate);
}

/**
 * "The group budget is ₹48,000, about ₹16,000 each for 3 members." The share
 * is the group total over the active members, rounded down to ₹500 (S1-4).
 */
export function groupBudgetLine(totalInr: number, activeMembers: number): string {
  const n = Math.max(activeMembers, 1);
  const each = Math.floor(totalInr / n / 500) * 500;
  const who = `${n} ${n === 1 ? 'member' : 'members'}`;
  return `The group budget is ${formatInr(totalInr)}, about ${formatInr(each)} each for ${who}.`;
}

// "Delhi" rather than "Delhi, Delhi" when the hub is its own state or territory.
export function formatHub(hub: { name: string; state: string }): string {
  return hub.state === hub.name ? hub.name : `${hub.name}, ${hub.state}`;
}
