import { ButtonLink } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { useDocumentTitle } from '../../lib/use-document-title';

export function TripsPage() {
  useDocumentTitle('Your trips');
  return (
    <>
      <PageHeader title="Your trips" actions={<ButtonLink to="/trips/new">New trip</ButtonLink>} />
      <EmptyState
        title="No trips yet"
        text="Create a trip to invite your group."
        action={
          <ButtonLink to="/trips/new" variant="secondary">
            Create a trip
          </ButtonLink>
        }
      />
    </>
  );
}
