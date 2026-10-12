import { useEffect, useRef, useState } from 'react';
import { TRIP_STATUS_LABELS, type TripStatus } from '@bonvoyage/shared';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { updatedAgo } from '../../../lib/format';

// The live parts of the dashboard (SRS 3.3): a clock that ticks every 5 s,
// the "Updated 5 seconds ago" footer, and a polite announcement of status
// changes that arrive between polls.

export function StatusAnnouncer({ status }: { status: TripStatus }) {
  const previous = useRef(status);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (previous.current !== status) {
      previous.current = status;
      setMessage(`Trip status changed to ${TRIP_STATUS_LABELS[status].label}`);
    }
  }, [status]);
  return (
    <div aria-live="polite" className="sr-only" data-testid="status-announcer">
      {message}
    </div>
  );
}

export function LiveFooter({
  updatedAt,
  now,
  failing,
  refreshing,
  onRefresh,
}: {
  updatedAt: number;
  now: number;
  failing: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="mt-4 space-y-2">
      {failing ? (
        <Alert
          tone="warning"
          action={
            <Button variant="ghost" onClick={onRefresh}>
              Retry
            </Button>
          }
        >
          Could not refresh the trip. Trying again.
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <p>{updatedAgo(updatedAt, Math.max(now, updatedAt))}</p>
        <Button variant="ghost" loading={refreshing} onClick={onRefresh}>
          Refresh
        </Button>
      </div>
    </div>
  );
}
