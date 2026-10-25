import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import type { RecommendationItem } from '@bonvoyage/shared';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { useChooseDestination } from '../../../features/recommendations/api';
import {
  chooseConfirmText,
  climateText,
  costText,
  distanceText,
  forYouText,
  groupScoreText,
  sharedText,
} from '../../../features/recommendations/wording';
import { ApiError } from '../../../lib/api';

// One ranked destination (wireframe 07). Everything on it is the API's: the
// group sees aggregates, and "For you" comes only from the caller's own match.

const errorText = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Something went wrong. Try again.';

function Choose({ tripId, item }: { tripId: string; item: RecommendationItem }) {
  const choose = useChooseDestination(tripId);
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const { name, slug } = item.destination;
  return (
    <div className="space-y-2 pt-2">
      {/* T9: 422 DESTINATION_NOT_IN_SHORTLIST and 409 show as sent (amendment 11). */}
      {choose.error ? <Alert tone="error">{errorText(choose.error)}</Alert> : null}
      {confirming ? (
        <div className="space-y-2 rounded-md border border-slate-300 p-3">
          <p className="text-sm text-slate-900">{chooseConfirmText(name)}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              loading={choose.isPending}
              onClick={() =>
                choose.mutate(slug, {
                  onSuccess: () => void navigate(`/trips/${tripId}`),
                  onSettled: () => setConfirming(false),
                })
              }
            >
              Choose {name}
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Keep looking
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setConfirming(true)}>
          Choose
        </Button>
      )}
      <p role="status" className="sr-only">
        {choose.isPending ? `Choosing ${name}` : ''}
      </p>
    </div>
  );
}

export function DestinationCard({
  item,
  tripId,
  canChoose,
}: {
  item: RecommendationItem;
  tripId: string;
  canChoose: boolean;
}) {
  const headingId = useId();
  const score = groupScoreText(item.group);
  return (
    <article
      aria-labelledby={headingId}
      className="space-y-1 rounded-lg border border-slate-300 bg-white p-4 text-sm"
    >
      {/* tabIndex -1: "Show all" moves focus here; it is not a tab stop. */}
      <h2 id={headingId} tabIndex={-1} className="text-base font-semibold text-slate-900">
        {item.rank}. {item.destination.name}
      </h2>
      <p className="text-slate-600">{item.destination.state}</p>
      <p className="text-slate-900">{distanceText(item.distanceKm, item.distanceProvenance)}</p>
      <p className="text-slate-900">{costText(item)}</p>
      {score ? <p className="text-slate-900">{score}</p> : null}
      <p className="text-slate-900">{climateText(item.group)}</p>
      <p className="text-slate-900">{sharedText(item.group)}</p>
      {item.mine ? <p className="font-medium text-slate-900">{forYouText(item.mine)}</p> : null}
      {canChoose ? <Choose tripId={tripId} item={item} /> : null}
    </article>
  );
}
