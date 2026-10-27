import type { TripDetail } from '@bonvoyage/shared';
import { Alert } from '../../../components/ui/Alert';
import { useItinerary } from '../../../features/itinerary/api';
import { formatDate, formatInr } from '../../../lib/format';

export function FinalisedTrip({ trip }: { trip: TripDetail }) {
  const latest = trip.latestItinerary;
  const plan = useItinerary(trip.id, `${latest?.version ?? 0}:${latest?.status ?? ''}`);
  const days = plan.data?.itinerary?.days;
  const pkg = trip.selectedPackage;
  if (plan.error) return <Alert tone="error">{plan.error.message}</Alert>;
  if (!days?.length || !pkg) return <p role="status">Loading the finalised trip.</p>;
  return (
    <p>
      Trip finalised: {trip.selectedDestination?.name},{' '}
      {days
        .filter((_, i) => i === 0 || i === days.length - 1)
        .map((d) => formatDate(d.date))
        .join(' – ')}
      , {pkg.label} package, {formatInr(pkg.totalInr)} for the group, about{' '}
      {formatInr(pkg.perPersonInr)} each (estimate).
    </p>
  );
}
