import { useNavigate, useParams } from 'react-router';
import { Alert } from '../../../components/ui/Alert';
import { Button, ButtonLink } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { usePackages } from '../../../features/packages/api';
import { useTrip } from '../../../features/trips/api';
import { ApiError } from '../../../lib/api';
import { useDocumentTitle } from '../../../lib/use-document-title';
import { PackageCard } from './PackageCard';

// /trips/:id/packages (S3-3 / S3-4), any active member. Actions come from
// TripDetail.availableActions, never from myRole.

export function PackagesPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const trip = useTrip(id);
  const packages = usePackages(id, { enabled: Boolean(trip.data) });
  useDocumentTitle('Packages');

  if (trip.isLoading || (trip.data && packages.isLoading)) {
    return (
      <div className="space-y-3" aria-label="Loading the packages">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (!trip.data || !packages.data) {
    const notFound =
      (trip.error instanceof ApiError && trip.error.status === 404) ||
      (packages.error instanceof ApiError && packages.error.status === 404);
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
          <Button variant="ghost" onClick={() => void packages.refetch()}>
            Retry
          </Button>
        }
      >
        The packages could not be loaded.
      </Alert>
    );
  }

  const { destination, n, note, packages: pkgs, choices } = packages.data;
  const actions = Object.fromEntries(trip.data.availableActions.map((a) => [a.action, a]));
  // T10: removing the last package sends the trip back to the shortlist.
  const onRemoved = (status: string) => {
    if (status === 'shortlisted') void navigate(`/trips/${id}/shortlist`);
  };

  return (
    <div className="space-y-4">
      <div>
        <ButtonLink to={`/trips/${id}`} variant="secondary">
          Back to the trip
        </ButtonLink>
      </div>
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Packages for {destination.name}</h1>
        <p className="mt-1 text-sm text-slate-700">
          From {trip.data.originHub.name} · {trip.data.durationNights}{' '}
          {trip.data.durationNights === 1 ? 'night' : 'nights'} · {n}{' '}
          {n === 1 ? 'person' : 'people'}
        </p>
        {note ? <p className="mt-1 text-sm text-slate-600">{note}</p> : null}
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pkgs.map((pkg) => (
          <PackageCard
            key={pkg.id}
            pkg={pkg}
            choices={choices}
            tripId={id}
            isLast={pkgs.length === 1}
            actions={actions}
            onRemoved={onRemoved}
          />
        ))}
      </div>
    </div>
  );
}
