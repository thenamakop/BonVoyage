import { useState } from 'react';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useTripActivity } from '../../../features/trips/api';
import { formatDateTime, formatRelative } from '../../../lib/format';

// Recent activity (wireframe 06). State-machine events only: joining,
// leaving and removal are not events, so they never appear here (known gap).

const COLLAPSED = 5;

export function RecentActivity({
  tripId,
  lastActivityAt,
  now,
}: {
  tripId: string;
  lastActivityAt: string | null;
  now: number;
}) {
  const activity = useTripActivity(tripId, lastActivityAt);
  const [showAll, setShowAll] = useState(false);

  let body;
  if (activity.isLoading) {
    body = (
      <div aria-label="Loading activity">
        <Skeleton className="h-16" />
      </div>
    );
  } else if (activity.isError && !activity.data) {
    body = (
      <Alert
        tone="error"
        action={
          <Button variant="ghost" onClick={() => void activity.refetch()}>
            Retry
          </Button>
        }
      >
        The activity could not be loaded.
      </Alert>
    );
  } else {
    const items = activity.data?.items ?? [];
    const shown = showAll ? items : items.slice(0, COLLAPSED);
    body =
      items.length === 0 ? (
        <p className="text-sm text-slate-700">Nothing has happened yet.</p>
      ) : (
        <>
          <ul className="space-y-2 text-sm">
            {shown.map((item) => (
              <li key={item.id} className="text-slate-900">
                {item.summary}
                <span className="text-slate-600">
                  {' · '}
                  <time dateTime={item.createdAt} title={formatDateTime(item.createdAt)}>
                    {formatRelative(item.createdAt, now)}
                  </time>
                </span>
              </li>
            ))}
          </ul>
          {items.length > COLLAPSED ? (
            <Button variant="ghost" onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Show fewer' : 'Show all'}
            </Button>
          ) : null}
        </>
      );
  }

  return (
    <Card className="space-y-2">
      <h2 className="text-sm font-semibold text-slate-900">Recent activity</h2>
      {body}
    </Card>
  );
}
