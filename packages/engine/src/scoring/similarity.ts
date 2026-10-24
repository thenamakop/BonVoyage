import type { MemberInput } from './types';

export function jaccard(a: Iterable<string>, b: Iterable<string>): number {
  const left = new Set(a);
  const right = new Set(b);
  const union = new Set([...left, ...right]);
  if (union.size === 0) return 0;
  return [...left].filter((value) => right.has(value)).length / union.size;
}

export function weightedJaccard(
  memberWeights: ReadonlyMap<string, number>,
  destination: ReadonlySet<string>,
): number {
  let intersection = 0;
  let union = 0;
  for (const value of new Set([...memberWeights.keys(), ...destination])) {
    const memberWeight = memberWeights.get(value) ?? 0;
    const destinationWeight = destination.has(value) ? 1 : 0;
    intersection += Math.min(memberWeight, destinationWeight);
    union += Math.max(memberWeight, destinationWeight);
  }
  return union === 0 ? 0 : intersection / union;
}

export function memberTypeWeights(member: MemberInput): Map<string, number> {
  const weights = new Map<string, number>();
  for (const value of member.likedPastTypes) weights.set(value, 0.5);
  for (const value of member.types) weights.set(value, 1);
  return weights;
}
