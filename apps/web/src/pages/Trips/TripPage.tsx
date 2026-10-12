import { useParams } from 'react-router';
import { TRIP_STATUS_LABELS } from '@bonvoyage/shared';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { useMe } from '../../features/auth/api';
import { useTrip } from '../../features/trips/api';
import { statusTone } from '../../features/trips/status-tone';
import { ApiError } from '../../lib/api';
import { useDocumentTitle } from '../../lib/use-document-title';
import { useNow } from '../../lib/use-now';
import { LiveFooter, StatusAnnouncer } from './dashboard/LiveStatus';
import { NextStep } from './dashboard/NextStep';
import { OrganiserActions } from './dashboard/OrganiserActions';
import { ProgressCard } from './dashboard/ProgressCard';
import { RecentActivity } from './dashboard/RecentActivity';
import { Roster } from './dashboard/Roster';
import { StatusBanner } from './dashboard/StatusBanner';
import { TripParameters } from './dashboard/TripParameters';

// The trip dashboard (wireframe 06, S1-5). The trip is polled every 10 s while
// the tab is visible (SRS 3.3); everything below re-renders from that one query.

const TICK_MS = 5_000;

export function TripPage() {
  const { id = '' } = useParams();
  const trip = useTrip(id, { live: true });
  const me = useMe();
  const now = useNow(TICK_MS);
  useDocumentTitle(trip.data?.title ?? 'Trip');

  if (trip.isLoading) {
    return (
      <div className="space-y-3" aria-label="Loading trip">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  // Only a trip that never loaded replaces the page; a failed background
  // refetch keeps the last data on screen (see LiveFooter).
  if (!trip.data) {
    const notFound = trip.error instanceof ApiError && trip.error.status === 404;
    return notFound ? (
      <EmptyState
        title="Trip not found"
        text="This trip does not exist, or you are not a member of it."
        action={<ButtonLink to="/trips">Back to your trips</ButtonLink>}
      />
    ) : (
      <Alert
        tone="error"
        action={
          <Button variant="ghost" onClick={() => void trip.refetch()}>
            Retry
          </Button>
        }
      >
        The trip could not be loaded.
      </Alert>
    );
  }

  const t = trip.data;
  return (
    <>
      <PageHeader
        title={t.title}
        actions={<Badge tone={statusTone(t.status)}>{TRIP_STATUS_LABELS[t.status].label}</Badge>}
      />
      <StatusAnnouncer status={t.status} />
      <StatusBanner trip={t} />
      <NextStep trip={t} myUserId={me.data?.id} />

      {/* One column at 360 px in reading order; two columns from lg up
          (parameters, progress and activity left; roster and actions right). */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
        <div className="contents lg:flex lg:flex-col lg:gap-4">
          <div className="order-1 lg:order-none">
            <TripParameters trip={t} />
          </div>
          <div className="order-2 lg:order-none">
            <ProgressCard trip={t} />
          </div>
          <div className="order-5 lg:order-none">
            <RecentActivity tripId={t.id} lastActivityAt={t.lastActivityAt} now={now} />
          </div>
        </div>
        <div className="contents lg:flex lg:flex-col lg:gap-4">
          <div className="order-3 lg:order-none">
            <Roster trip={t} />
          </div>
          <div className="order-4 empty:hidden lg:order-none">
            <OrganiserActions trip={t} />
          </div>
        </div>
      </div>

      <LiveFooter
        updatedAt={trip.dataUpdatedAt}
        now={now}
        failing={trip.isError}
        refreshing={trip.isFetching}
        onRefresh={() => void trip.refetch()}
      />
    </>
  );
}
