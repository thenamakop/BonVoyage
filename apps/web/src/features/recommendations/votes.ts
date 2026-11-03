import type { RecommendationRun, RunVotes, TripDetail } from '@bonvoyage/shared';

// R18: when the shortlist shows vote buttons and counts. The API refuses a vote that
// the state machine does not allow (I6 is legal in shortlisted only), so this only
// decides what to draw; the organiser's choice never reads any of it (0005 h).

type VoteTrip = Pick<TripDetail, 'status' | 'myStatus'>;

/**
 * Buttons: the trip is shortlisted, the run is a shortlist (not a diagnostic) and the
 * caller is an active member. There is no `vote` entry in availableActions, so the
 * rule is here.
 */
export function canVote(trip: VoteTrip, run: Pick<RecommendationRun, 'kind'>): boolean {
  return trip.status === 'shortlisted' && run.kind === 'shortlist' && trip.myStatus === 'active';
}

export interface VoteView {
  /** Show the "N of M voted" line and the counts. */
  show: boolean;
  canVote: boolean;
  voted: number;
  eligible: number;
  /** Absent while a 2-member trip waits for its second vote (E4). */
  counts: Record<string, number> | undefined;
  /** The slug the caller voted for, if any. */
  mine: string | undefined;
}

/**
 * `earlier` is the run kept after T21: its votes belong to a round that is over, so
 * nothing about it is drawn.
 */
export function voteView(
  trip: VoteTrip,
  run: Pick<RecommendationRun, 'kind'>,
  votes: RunVotes | undefined,
  earlier: boolean,
): VoteView {
  const show = Boolean(votes) && run.kind === 'shortlist' && !earlier;
  return {
    show,
    canVote: show && canVote(trip, run),
    voted: votes?.voted ?? 0,
    eligible: votes?.eligible ?? 0,
    counts: votes?.counts,
    mine: votes?.mine,
  };
}
