import type { TripDetail } from '@bonvoyage/shared';
import { Card } from '../../../components/ui/Card';
import { progressText } from './wording';

// Progress (wireframe 06, note 1): the bar always repeats its numbers as text.

export function ProgressCard({ trip }: { trip: TripDetail }) {
  const { activeCount, submittedCount, excludedCount } = trip.progress;
  const text = progressText(submittedCount, activeCount);
  const percent = activeCount > 0 ? Math.round((submittedCount / activeCount) * 100) : 0;
  return (
    <Card>
      <h2 className="text-sm font-semibold text-slate-900">Preferences</h2>
      <div
        role="progressbar"
        aria-label="Preferences submitted"
        aria-valuemin={0}
        aria-valuemax={activeCount}
        aria-valuenow={submittedCount}
        aria-valuetext={text}
        className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-200"
      >
        <div className="h-full rounded-full bg-brand-700" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-sm text-slate-900">{text}</p>
      {excludedCount > 0 ? (
        <p className="mt-1 text-sm text-slate-600">
          {excludedCount} {excludedCount === 1 ? 'member was' : 'members were'} removed and
          {excludedCount === 1 ? ' does' : ' do'} not count.
        </p>
      ) : null}
    </Card>
  );
}
