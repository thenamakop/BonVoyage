import { useEffect, useRef, useState } from 'react';
import type { RecommendationItem, RecommendationRun, TripDetail } from '@bonvoyage/shared';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { AskAgain } from './AskAgain';
import { DestinationCard } from './DestinationCard';

// Wireframe 07 (R6, R7): every feasible destination is stored ranked; the page
// shows five, then "Show all" (0004 m).

const FIRST = 5;

export function ShortlistView({
  trip,
  run,
  items,
  earlier = false,
}: {
  trip: TripDetail;
  run: RecommendationRun;
  items: RecommendationItem[];
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
  const shown = all ? items : items.slice(0, FIRST);
  return (
    <div className="space-y-4">
      {run.weakMatch ? (
        // 0004 g: types are soft preferences, so a weak match is still a shortlist.
        <Alert tone="info">
          These are the closest options; none match the types the group asked for well.
        </Alert>
      ) : null}
      <ol ref={listRef} className="space-y-3" aria-label="Ranked destinations">
        {shown.map((item) => (
          <li key={item.destination.slug}>
            <DestinationCard item={item} tripId={trip.id} canChoose={canChoose} />
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
