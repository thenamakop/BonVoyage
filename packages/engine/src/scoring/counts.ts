import type { ValueCount } from './types';

export function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function countValues<T extends string>(groups: readonly (readonly T[])[]): ValueCount<T>[] {
  const counts = new Map<T, number>();
  for (const group of groups) {
    for (const value of new Set(group)) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || compareText(a.value, b.value));
}
