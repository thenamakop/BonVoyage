import { useParams } from 'react-router';
import { useNavigate } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { ButtonLink } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { useTrip, useUpdateTrip } from '../../features/trips/api';
import { ApiError } from '../../lib/api';
import { useDocumentTitle } from '../../lib/use-document-title';
import { TripForm } from './TripForm';

export function TripEditPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const trip = useTrip(id);
  const updateTrip = useUpdateTrip(id);
  useDocumentTitle('Edit trip');

  if (trip.isLoading) {
    return <Skeleton className="h-64 max-w-md" />;
  }
  if (trip.isError || !trip.data) {
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
          <ButtonLink to="/trips" variant="ghost">
            Back to your trips
          </ButtonLink>
        }
      >
        The trip could not be loaded.
      </Alert>
    );
  }

  const t = trip.data;
  // 0004 j: the server lists editDetails until the shortlist is made.
  const canEdit = t.availableActions.some((a) => a.action === 'editDetails' && a.enabled);
  if (t.myRole !== 'organiser' || !canEdit) {
    const reason =
      t.myRole !== 'organiser'
        ? 'Only the organiser can edit the trip details.'
        : 'Trip details can be changed until the shortlist is made.';
    return (
      <div className="max-w-md space-y-4">
        <PageHeader title="Edit trip" />
        <Alert tone="info">{reason}</Alert>
        <ButtonLink to={`/trips/${t.id}`} variant="secondary">
          Back to the trip
        </ButtonLink>
      </div>
    );
  }

  return (
    <>
      <PageHeader title={`Edit ${t.title}`} />
      <TripForm
        submitLabel="Save changes"
        initial={{
          title: t.title,
          originHubSlug: t.originHub.slug,
          durationNights: t.durationNights,
          budgetTotalInr: t.budgetTotalInr,
          radiusKm: t.radiusKm,
        }}
        onSubmit={async (input) => {
          const detail = await updateTrip.mutateAsync(input);
          void navigate(`/trips/${detail.id}`);
          return detail;
        }}
      />
    </>
  );
}
