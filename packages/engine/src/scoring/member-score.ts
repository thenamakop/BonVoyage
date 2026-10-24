import { jaccard, memberTypeWeights, weightedJaccard } from './similarity';
import type { DestinationInput, MemberInput } from './types';

export function memberScore(member: MemberInput, destination: DestinationInput): number {
  const climate = member.climate === 'any' || member.climate === destination.climate ? 1 : 0;
  return (
    0.5 * weightedJaccard(memberTypeWeights(member), new Set(destination.types)) +
    0.3 * jaccard(member.activities, destination.activities) +
    0.2 * climate
  );
}
