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
