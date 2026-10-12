import { useNavigate } from 'react-router';
import { PageHeader } from '../../components/ui/PageHeader';
import { useCreateTrip } from '../../features/trips/api';
import { useDocumentTitle } from '../../lib/use-document-title';
import { TripForm } from './TripForm';

export function TripNewPage() {
  useDocumentTitle('New trip');
  const navigate = useNavigate();
  const createTrip = useCreateTrip();

  return (
    <>
      <PageHeader title="New trip" />
      <TripForm
        submitLabel="Create trip"
        onSubmit={async (input) => {
          const detail = await createTrip.mutateAsync(input);
          void navigate(`/trips/${detail.id}`);
          return detail;
        }}
      />
    </>
  );
}
