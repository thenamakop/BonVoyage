import { useParams } from 'react-router';
import { Alert } from '../../../components/ui/Alert';
import { Button, ButtonLink } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useLatestRecommendation } from '../../../features/recommendations/api';
import { useTrip } from '../../../features/trips/api';
import { ApiError } from '../../../lib/api';
import { useDocumentTitle } from '../../../lib/use-document-title';
import { DiagnosticView } from './DiagnosticView';
import { NotConsidered } from './NotConsidered';
import { ShortlistView } from './ShortlistView';

// /trips/:id/shortlist (S2-7), any member, removed members included. It does
// not poll: the dashboard's 8 s poll is the one live query (amendment 10).

export function ShortlistPage() {
  const { id = '' } = useParams();
  const trip = useTrip(id);
  const latest = useLatestRecommendation(id, trip.data?.latestRecommendation);
  useDocumentTitle('Shortlist');

  const back = (
    <ButtonLink to={`/trips/${id}`} variant="secondary">
      Back to the trip
    </ButtonLink>
  );

  if (trip.isLoading || (trip.data && latest.isLoading)) {
    return (
      <div className="space-y-3" aria-label="Loading the shortlist">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
      </div>
    );
  }
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
  if (!latest.data) {
    return (
      <>
        <PageHeader title="Shortlist" actions={back} />
        <Alert
          tone="error"
          action={
            <Button variant="ghost" onClick={() => void latest.refetch()}>
              Retry
            </Button>
          }
        >
          The recommendations could not be loaded.
        </Alert>
      </>
    );
  }

  const t = trip.data;
  const { run, items } = latest.data;
  return (
    <>
      <PageHeader title="Shortlist" actions={back} />
      <p className="-mt-2 mb-4 text-sm text-slate-600">{t.title}</p>
      {!run ? (
        <EmptyState
          title="No recommendations yet."
          text="The organiser gets them once everyone has submitted."
        />
      ) : (
        <div className="space-y-4">
          {run.round > 1 ? (
            <p className="text-sm font-semibold text-slate-900">Round {run.round}</p>
          ) : null}
          {run.kind === 'shortlist' ? (
            <ShortlistView trip={t} run={run} items={items} />
          ) : (
            <DiagnosticView trip={t} run={run} items={items} />
          )}
          {run.incomplete.length > 0 ? <NotConsidered slugs={run.incomplete} /> : null}
        </div>
      )}
    </>
  );
}
