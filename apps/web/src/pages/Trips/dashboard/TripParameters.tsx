import type { ReactNode } from 'react';
import type { TripDetail } from '@bonvoyage/shared';
import { Card } from '../../../components/ui/Card';
import { formatDate, formatHub, formatInr, perPersonShare } from '../../../lib/format';

// Trip parameters (wireframe 06). At 360 px each label sits above its value;
// from sm up they sit side by side (S1-2 review).

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-slate-600">{label}</dt>
      <dd className="text-slate-900 sm:text-right">{children}</dd>
    </div>
  );
}

export function TripParameters({ trip }: { trip: TripDetail }) {
  const n = trip.durationNights;
  return (
    <Card>
      <h2 className="text-sm font-semibold text-slate-900">Trip parameters</h2>
      <dl className="mt-2 space-y-2 text-sm">
        {trip.selectedDestination ? (
          // T9: the organiser's choice from the shortlist.
          <Row label="Destination">{formatHub(trip.selectedDestination)}</Row>
        ) : null}
        <Row label="Starting city">{formatHub(trip.originHub)}</Row>
        <Row label="Nights">
          {n} {n === 1 ? 'night' : 'nights'}
        </Row>
        <Row label="Group budget">
          {formatInr(trip.budgetTotalInr)} for the group
          <span className="block text-slate-600">
            {perPersonShare(trip.budgetTotalInr, trip.progress.activeCount)}
          </span>
        </Row>
        <Row label="Search radius">{trip.radiusKm} km by road</Row>
        {trip.startDate && trip.endDate ? (
          <Row label="Dates">
            {formatDate(trip.startDate)} to {formatDate(trip.endDate)}
          </Row>
        ) : null}
      </dl>
    </Card>
  );
}
