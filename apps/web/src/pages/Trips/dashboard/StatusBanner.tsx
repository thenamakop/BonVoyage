import { TRIP_STATUS_LABELS, type TripDetail } from '@bonvoyage/shared';
import { stepLine } from './wording';

// Where the trip stands, in words (wireframe 06): the label, its explanation
// and "Step 2 of 7: Collecting preferences" while planning.

export function StatusBanner({ trip }: { trip: TripDetail }) {
  const labels = TRIP_STATUS_LABELS[trip.status];
  return (
    <section
      aria-labelledby="trip-status-heading"
      className="mb-6 rounded-3xl border-[2.5px] border-ink bg-ink p-6 text-white shadow-sticker-accent"
    >
      <h2 id="trip-status-heading" className="text-2xl text-white">
        {labels.label}
      </h2>
      <p className="mt-1 text-sm text-white/85">{labels.explanation}</p>
      <p className="mt-3 text-sm font-semibold text-mint">{stepLine(trip.status)}</p>
    </section>
  );
}
