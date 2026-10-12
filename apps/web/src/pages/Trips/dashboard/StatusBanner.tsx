import { TRIP_STATUS_LABELS, type TripDetail } from '@bonvoyage/shared';
import { stepLine } from './wording';

// Where the trip stands, in words (wireframe 06): the label, its explanation
// and "Step 2 of 7: Collecting preferences" while planning.

export function StatusBanner({ trip }: { trip: TripDetail }) {
  const labels = TRIP_STATUS_LABELS[trip.status];
  return (
    <section
      aria-labelledby="trip-status-heading"
      className="mb-4 rounded-lg border border-slate-300 bg-white p-4"
    >
      <h2 id="trip-status-heading" className="text-lg font-semibold text-slate-900">
        {labels.label}
      </h2>
      <p className="mt-1 text-sm text-slate-700">{labels.explanation}</p>
      <p className="mt-2 text-sm font-medium text-slate-900">{stepLine(trip.status)}</p>
    </section>
  );
}
