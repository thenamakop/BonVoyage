import { Link } from 'react-router';
import { TRIP_STATUS_LABELS } from '@bonvoyage/shared';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { useMyTrips } from '../../features/trips/api';
import { statusTone } from '../../features/trips/status-tone';
import { formatInr } from '../../lib/format';
import { useDocumentTitle } from '../../lib/use-document-title';

export function TripsPage() {
  useDocumentTitle('Your trips');
  const trips = useMyTrips();

  return (
    <>
      <PageHeader title="Your trips" actions={<ButtonLink to="/trips/new">New trip</ButtonLink>} />
      {trips.isLoading ? (
        <div className="space-y-3" aria-label="Loading trips">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : trips.isError ? (
        <Alert
          tone="error"
          action={
            <Button variant="ghost" onClick={() => void trips.refetch()}>
              Retry
            </Button>
          }
        >
          Your trips could not be loaded.
        </Alert>
      ) : trips.data && trips.data.trips.length > 0 ? (
        <ul className="space-y-3">
          {trips.data.trips.map((t) => (
            <li key={t.id}>
              <Link to={`/trips/${t.id}`} className="block">
                <Card className="hover:bg-slate-50">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{t.title}</p>
                    <div className="flex items-center gap-2">
                      {t.myRole === 'organiser' ? <Badge>Organiser</Badge> : null}
                      <Badge tone={statusTone(t.status)}>
                        {TRIP_STATUS_LABELS[t.status].label}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    From {t.originHub.name} · {t.durationNights}{' '}
                    {t.durationNights === 1 ? 'night' : 'nights'} · {formatInr(t.budgetTotalInr)}{' '}
                    for the group · {t.memberCount} {t.memberCount === 1 ? 'member' : 'members'}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No trips yet"
          text="Create a trip to invite your group."
          action={
            <ButtonLink to="/trips/new" variant="secondary">
              Create a trip
            </ButtonLink>
          }
        />
      )}
    </>
  );
}
