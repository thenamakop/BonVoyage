import { useState } from 'react';
import type { TripAction } from '@bonvoyage/shared';
import { POI_CATEGORY_LABELS } from '@bonvoyage/shared';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { useAlternatives, useModifyItinerary } from '../../../features/itinerary/api';
import { entryFeeText } from '../../../lib/format';

export function AdjustVisit({
  tripId,
  itemId,
  action,
}: {
  tripId: string;
  itemId: string;
  action: TripAction;
}) {
  const [swapping, setSwapping] = useState(false);
  const choices = useAlternatives(tripId, itemId, swapping && action.enabled);
  const modify = useModifyItinerary(tripId, itemId);
  const error = modify.error ?? choices.error;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={!action.enabled || modify.isPending}
          onClick={() => modify.mutate({ action: 'remove' })}
        >
          Remove
        </Button>
        <Button
          variant="secondary"
          disabled={!action.enabled || modify.isPending}
          onClick={() => setSwapping(!swapping)}
        >
          Swap
        </Button>
      </div>
      {!action.enabled ? <p>{action.reason}</p> : null}
      {swapping ? (
        <div className="space-y-2" aria-label="Fitting alternatives">
          {choices.isLoading ? <p role="status">Loading alternatives.</p> : null}
          {choices.data?.places.length === 0 ? <p>No unused places fit this slot.</p> : null}
          {choices.data?.places.map((place) => (
            <Button
              key={place.key}
              variant="secondary"
              disabled={modify.isPending}
              onClick={() =>
                modify.mutate(
                  { action: 'replace', placeKey: place.key },
                  { onSuccess: () => setSwapping(false) },
                )
              }
            >
              {place.name} · {POI_CATEGORY_LABELS[place.category]} ·{' '}
              {entryFeeText(place.entryFeeInr)}
            </Button>
          ))}
        </div>
      ) : null}
      {error ? (
        <Alert tone="error">
          {error instanceof Error ? error.message : 'Something went wrong. Try again.'}
        </Alert>
      ) : null}
    </div>
  );
}
