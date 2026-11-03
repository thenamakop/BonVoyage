import { useEffect, useRef, useState } from 'react';
import type {
  RecommendationItem,
  RecommendationRun,
  RunVotes,
  TripDetail,
} from '@bonvoyage/shared';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { useCastVote, useWithdrawVote } from '../../../features/recommendations/api';
import { voteView } from '../../../features/recommendations/votes';
import { votedOfText, voteErrorText } from '../../../features/recommendations/wording';
import { ApiError } from '../../../lib/api';
import { AskAgain } from './AskAgain';
import { DestinationCard } from './DestinationCard';

// Wireframe 07 (R6, R7): every feasible destination is stored ranked; the page
// shows five, then "Show all" (0004 m).

const FIRST = 5;

export function ShortlistView({
  trip,
  run,
  items,
  votes,
  earlier = false,
}: {
  trip: TripDetail;
  run: RecommendationRun;
  items: RecommendationItem[];
  /** R18: counts and the caller's own vote; sent with a shortlist only. */
  votes?: RunVotes | undefined;
  /** The run before T21, kept for reference: nothing on it can be chosen. */
  earlier?: boolean;
}) {
  const [all, setAll] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  // The button disappears once pressed, so focus moves to the first newly
  // shown card instead of falling back to the top of the page.
  useEffect(() => {
    if (all) listRef.current?.querySelectorAll<HTMLElement>('h2')[FIRST]?.focus();
  }, [all]);
  const canChoose =
    !earlier && trip.availableActions.some((a) => a.action === 'chooseDestination' && a.enabled);
  const canAskAgain =
    !earlier && trip.availableActions.some((a) => a.action === 'reopenShortlist' && a.enabled);
  const view = voteView(trip, run, votes, earlier);
  const cast = useCastVote(trip.id);
  const withdraw = useWithdrawVote(trip.id);
  // One request at a time: every vote button waits while one is in flight.
  const busy = cast.isPending || withdraw.isPending;
  const voteError = cast.error ?? withdraw.error;
  const toggle = (slug: string) => {
    cast.reset();
    withdraw.reset();
    if (view.mine === slug) withdraw.mutate();
    else cast.mutate(slug);
  };
  const shown = all ? items : items.slice(0, FIRST);
  return (
    <div className="space-y-4">
      {run.weakMatch ? (
        // 0004 g: types are soft preferences, so a weak match is still a shortlist.
        <Alert tone="info">
          These are the closest options; none match the types the group asked for well.
        </Alert>
      ) : null}
      {view.show ? (
        <p className="text-sm font-semibold text-slate-900">
          {votedOfText(view.voted, view.eligible)}
        </p>
      ) : null}
      {/* 409 "Voting has closed." and the 400 for a destination outside the run show as sent (amendment 11). */}
      {voteError ? (
        <Alert tone="error">
          {voteError instanceof ApiError
            ? voteErrorText(voteError)
            : 'Something went wrong. Try again.'}
        </Alert>
      ) : null}
      <p role="status" className="sr-only">
        {busy ? 'Saving your vote' : ''}
      </p>
      <ol ref={listRef} className="space-y-3" aria-label="Ranked destinations">
        {shown.map((item) => (
          <li key={item.destination.slug}>
            <DestinationCard
              item={item}
              tripId={trip.id}
              canChoose={canChoose}
              vote={
                view.show
                  ? {
                      count: view.counts ? (view.counts[item.destination.slug] ?? 0) : undefined,
                      mine: view.mine === item.destination.slug,
                      canVote: view.canVote,
                      busy,
                      onToggle: () => toggle(item.destination.slug),
                    }
                  : undefined
              }
            />
          </li>
        ))}
      </ol>
      {!all && items.length > FIRST ? (
        <Button variant="secondary" onClick={() => setAll(true)}>
          Show all {items.length}
        </Button>
      ) : null}
      <p role="status" className="sr-only">
        {all ? `Showing all ${items.length} destinations` : ''}
      </p>
      {canAskAgain ? <AskAgain tripId={trip.id} /> : null}
    </div>
  );
}
