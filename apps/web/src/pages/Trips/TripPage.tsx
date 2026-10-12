import { useParams } from 'react-router';
import { TRIP_STATUS_LABELS } from '@bonvoyage/shared';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { useTrip } from '../../features/trips/api';
import { statusTone } from '../../features/trips/status-tone';
import { ApiError } from '../../lib/api';
import { formatInr } from '../../lib/format';
import { useDocumentTitle } from '../../lib/use-document-title';

export function TripPage() {
  const { id = '' } = useParams();
  const trip = useTrip(id);
  useDocumentTitle(trip.data?.title ?? 'Trip');

  if (trip.isLoading) {
    return (
      <div className="space-y-3" aria-label="Loading trip">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (trip.isError || !trip.data) {
    const notFound = trip.error instanceof ApiError && trip.error.status === 404;
    return (
      <div className="space-y-4">
        {notFound ? (
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
        )}
      </div>
    );
  }

  const t = trip.data;
  const labels = TRIP_STATUS_LABELS[t.status];
  const perPerson = t.members.length > 0 ? Math.round(t.budgetTotalInr / t.members.length) : 0;
  const canEdit = t.myRole === 'organiser' && t.status === 'draft';

  return (
    <>
      <PageHeader
        title={t.title}
        actions={
          <span className="flex items-center gap-2">
            <Badge tone={statusTone(t.status)}>{labels.label}</Badge>
            {canEdit ? (
              <ButtonLink to={`/trips/${t.id}/edit`} variant="secondary">
                Edit details
              </ButtonLink>
            ) : null}
          </span>
        }
      />
      <p className="mb-4 text-sm text-slate-600">{labels.explanation}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Trip details</h2>
          <dl className="mt-2 space-y-1 text-sm text-slate-700">
            <div className="flex justify-between gap-2">
              <dt>Starting city</dt>
              <dd>
                {t.originHub.name}, {t.originHub.state}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Duration</dt>
              <dd>
                {t.durationNights} {t.durationNights === 1 ? 'night' : 'nights'}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Group budget</dt>
              <dd>
                {formatInr(t.budgetTotalInr)} for the group · {formatInr(perPerson)} each
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Search radius</dt>
              <dd>{t.radiusKm} km by road</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Dates</dt>
              <dd>{t.startDate ? `${t.startDate} to ${t.endDate}` : 'Not set yet'}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Members</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {t.members.map((m) => (
              <li key={m.userId} className="flex items-center justify-between gap-2">
                <span>{m.name}</span>
                <span className="flex items-center gap-2">
                  {m.role === 'organiser' ? <Badge>Organiser</Badge> : null}
                  {m.status === 'excluded' ? <Badge tone="danger">Removed</Badge> : null}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
