import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { POI_CATEGORY_LABELS } from '@bonvoyage/shared';
import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { Button, ButtonLink } from '../../../components/ui/Button';
import { useDecideItinerary, useItinerary } from '../../../features/itinerary/api';
import { useTrip } from '../../../features/trips/api';
import { formatDate, formatInr } from '../../../lib/format';
import { useDocumentTitle } from '../../../lib/use-document-title';

const KIND = {
  travel: 'Travel',
  stay: 'Check-in',
  activity: 'Visit',
  meal: 'Lunch',
  free: 'Free time',
};

export function ItineraryPage() {
  const { id = '' } = useParams();
  const trip = useTrip(id);
  const latest = trip.data?.latestItinerary;
  const plan = useItinerary(
    id,
    trip.data ? `${latest?.version ?? 0}:${latest?.status ?? ''}` : undefined,
  );
  const accept = useDecideItinerary(id, 'accept');
  const reject = useDecideItinerary(id, 'reject');
  const [confirm, setConfirm] = useState<'accept' | 'reject' | null>(null);
  const navigate = useNavigate();
  useDocumentTitle('Day plan');
  if (trip.isLoading || plan.isLoading) return <p role="status">Loading the day plan.</p>;
  if (trip.error || plan.error)
    return <Alert tone="error">{trip.error?.message ?? plan.error?.message}</Alert>;
  const view = plan.data?.itinerary;
  if (!trip.data || !view)
    return (
      <p>
        No day plan yet. <ButtonLink to={`/trips/${id}`}>Back to the trip</ButtonLink>
      </p>
    );
  const actions = trip.data.availableActions;
  const decisions = [
    {
      name: 'accept' as const,
      action: actions.find((a) => a.action === 'acceptItinerary'),
      label: 'Accept this plan',
      text: 'Accept this plan? The trip is finalised.',
      mutation: accept,
    },
    {
      name: 'reject' as const,
      action: actions.find((a) => a.action === 'rejectItinerary'),
      label: 'Reject and plan again',
      text: 'Reject this plan? You can plan the days again.',
      mutation: reject,
    },
  ];
  return (
    <div className="space-y-4 break-words">
      <ButtonLink to={`/trips/${id}`} variant="secondary">
        Back to the trip
      </ButtonLink>
      <header className="space-y-2">
        <h1 className="text-xl font-semibold">
          {trip.data.selectedDestination?.name}:{' '}
          {view.days
            .map((d) => formatDate(d.date))
            .filter((_, i) => i === 0 || i === view.days.length - 1)
            .join(' – ')}
        </h1>
        <p>
          {view.packageLabel} package · version {view.version}
        </p>
        <p>
          {view.source === 'catalogue'
            ? 'Planned from the BonVoyage catalogue'
            : `Written with ${view.model} from catalogue facts`}
        </p>
        <p>Travel times are planned, not a timetable.</p>
        <p>{view.summary}</p>
        <ul className="list-inside list-disc">
          {view.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </header>
      {view.days.map((day) => (
        <section
          key={day.day}
          aria-label={`Day ${day.day}`}
          className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
        >
          <h2 className="font-semibold">
            Day {day.day} · {formatDate(day.date)}
          </h2>
          <ol className="space-y-3">
            {day.items.map((item) => (
              <li key={item.id} className="space-y-1 border-t border-slate-100 pt-3">
                <p className="font-medium">
                  {item.start}–{item.end} · {KIND[item.kind]}
                  {item.legId ? ` · ${item.legId === 'onward' ? 'Onward' : 'Return'}` : ''}
                </p>
                {item.place ? (
                  <p>
                    {item.place.name} · {POI_CATEGORY_LABELS[item.place.category]} · Entry{' '}
                    {formatInr(item.place.entryFeeInr)} per person (estimate)
                  </p>
                ) : null}
                <p>{item.note}</p>
                <Badge tone={item.verified ? 'success' : 'warning'}>
                  {item.verified
                    ? 'Verified'
                    : `Not verified: ${item.unverifiedReason ?? 'Details have not been verified.'}`}
                </Badge>
              </li>
            ))}
          </ol>
        </section>
      ))}
      {decisions.map(({ name, action, label, text, mutation }) =>
        action ? (
          <div key={name} className="space-y-2">
            {confirm === name ? (
              <div className="space-y-2">
                <p>{text}</p>
                <Button
                  loading={mutation.isPending}
                  onClick={() =>
                    mutation.mutate(undefined, { onSuccess: () => void navigate(`/trips/${id}`) })
                  }
                >
                  {name === 'accept' ? 'Accept plan' : 'Reject plan'}
                </Button>{' '}
                <Button variant="secondary" onClick={() => setConfirm(null)}>
                  Keep reviewing
                </Button>
              </div>
            ) : (
              <Button disabled={!action.enabled} onClick={() => setConfirm(name)}>
                {label}
              </Button>
            )}
            {!action.enabled ? <p>{action.reason}</p> : null}
            {mutation.error ? (
              <Alert tone="error">
                {mutation.error instanceof Error
                  ? mutation.error.message
                  : 'Something went wrong. Try again.'}
              </Alert>
            ) : null}
          </div>
        ) : null,
      )}
      {view.status === 'proposed' && !decisions.some((d) => d.action) ? (
        <p>Waiting for {trip.data.organiser.name} to accept the plan.</p>
      ) : null}
    </div>
  );
}
