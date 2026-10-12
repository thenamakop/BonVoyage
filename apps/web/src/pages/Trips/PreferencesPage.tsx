import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import {
  ACTIVITIES,
  ACTIVITY_LABELS,
  CLIMATE_PREFERENCE_LABELS,
  CLIMATE_PREFERENCES,
  DESTINATION_TYPE_LABELS,
  DESTINATION_TYPES,
  PreferenceInput,
  TRAVEL_STYLE_LABELS,
  TRAVEL_STYLES,
  indiaDate,
  type MyPreferenceResponse,
  type SavePreferenceResponse,
  type TripDetail,
} from '@bonvoyage/shared';
import { Alert } from '../../components/ui/Alert';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ChipGroup } from '../../components/ui/ChipGroup';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { RadioGroup } from '../../components/ui/RadioGroup';
import { Skeleton } from '../../components/ui/Skeleton';
import { TextField } from '../../components/ui/TextField';
import { useMyPreference, useSavePreference } from '../../features/preferences/api';
import { useTrip } from '../../features/trips/api';
import { ApiError } from '../../lib/api';
import { groupBudgetLine } from '../../lib/format';
import { useDocumentTitle } from '../../lib/use-document-title';

// The caller's own preferences (wireframe 05, S1-4). Saving drives the state
// machine: I1 or T3 for a first submission, I2 or T5 for a revision.

const CLIMATE_HINTS: Record<string, string> = {
  cold: 'Days mostly below 15 °C',
  mild: '15 to 25 °C',
  warm: 'Above 25 °C',
  any: 'Weather does not matter',
};
const STYLE_HINTS: Record<string, string> = {
  budget: 'Buses or trains, simple stays, local food',
  comfort: 'Trains or cabs, mid-range hotels',
  premium: 'Private car, better hotels, sit-down meals',
};

const EDITABLE = new Set(['collecting_preferences', 'ready_for_recommendation']);

type FieldName = keyof PreferenceInput;
type Fields = Partial<Record<FieldName, string>>;

const num = (raw: string) => (raw.trim() === '' ? Number.NaN : Number(raw));

function savedMessage(t: SavePreferenceResponse['transition']): string {
  if (t.transitionId === 'T3') {
    return 'Saved. Everyone has submitted, so the trip is ready for recommendations.';
  }
  if (t.transitionId === 'T5') return 'Saved. The group profile will be recalculated.';
  return 'Saved.';
}

function PreferenceForm({
  trip,
  mine,
  editable,
}: {
  trip: TripDetail;
  mine: MyPreferenceResponse;
  editable: boolean;
}) {
  const save = useSavePreference(trip.id);
  const p = mine.preference;
  const [types, setTypes] = useState<string[]>(p?.destinationTypes ?? []);
  const [activities, setActivities] = useState<string[]>(p?.activities ?? []);
  const [climate, setClimate] = useState<string>(p?.climate ?? '');
  const [style, setStyle] = useState<string>(p?.travelStyle ?? '');
  const [min, setMin] = useState(p ? String(p.budgetMinInr) : '');
  const [max, setMax] = useState(p ? String(p.budgetMaxInr) : '');
  const [start, setStart] = useState(p?.dateStart ?? '');
  const [end, setEnd] = useState(p?.dateEnd ?? '');
  const [fields, setFields] = useState<Fields>({});
  const [formError, setFormError] = useState('');
  const [saved, setSaved] = useState<SavePreferenceResponse['transition'] | null>(null);

  const today = indiaDate(new Date());
  const activeCount = trip.members.filter((m) => m.status === 'active').length;
  const nights = trip.durationNights;
  const submitted = mine.submittedAt !== null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    setSaved(null);
    const parsed = PreferenceInput.safeParse({
      destinationTypes: types,
      activities,
      climate,
      travelStyle: style,
      budgetMinInr: num(min),
      budgetMaxInr: num(max),
      dateStart: start,
      dateEnd: end,
    });
    if (!parsed.success) {
      const next: Fields = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as FieldName | undefined;
        if (key && next[key] === undefined) next[key] = issue.message;
      }
      setFields(next);
      return;
    }
    setFields({});
    save.mutate(parsed.data, {
      onSuccess: (res) => setSaved(res.transition),
      onError: (err) => {
        if (err instanceof ApiError && err.fields) {
          setFields(err.fields);
          if (err.status !== 400) setFormError(err.message);
        } else {
          setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
        }
      },
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-2xl space-y-4">
      {saved ? (
        <Alert
          tone="success"
          action={
            <ButtonLink to={`/trips/${trip.id}`} variant="ghost">
              Back to the trip
            </ButtonLink>
          }
        >
          {savedMessage(saved)}
        </Alert>
      ) : null}
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      <fieldset disabled={!editable} className="space-y-5 disabled:opacity-80">
        <ChipGroup
          legend="Destination types"
          options={DESTINATION_TYPES.map((v) => ({ value: v, label: DESTINATION_TYPE_LABELS[v] }))}
          selected={types}
          onChange={setTypes}
          error={fields.destinationTypes}
        />
        <ChipGroup
          legend="Activities"
          options={ACTIVITIES.map((v) => ({ value: v, label: ACTIVITY_LABELS[v] }))}
          selected={activities}
          onChange={setActivities}
          error={fields.activities}
        />
        <RadioGroup
          legend="Climate"
          name="climate"
          options={CLIMATE_PREFERENCES.map((v) => ({
            value: v,
            label: CLIMATE_PREFERENCE_LABELS[v],
            description: CLIMATE_HINTS[v],
          }))}
          value={climate}
          onChange={setClimate}
          error={fields.climate}
        />
        <RadioGroup
          legend="Travel style"
          name="travelStyle"
          options={TRAVEL_STYLES.map((v) => ({
            value: v,
            label: TRAVEL_STYLE_LABELS[v],
            description: STYLE_HINTS[v],
          }))}
          value={style}
          onChange={setStyle}
          error={fields.travelStyle}
        />
        <div className="space-y-2">
          <p className="text-sm text-slate-700">
            Per person, for the whole trip: travel, stay, food and activities.
          </p>
          <p className="text-sm text-slate-600">
            {groupBudgetLine(trip.budgetTotalInr, activeCount)}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Budget min (₹ per person)"
              inputMode="numeric"
              value={min}
              onChange={(e) => setMin(e.target.value)}
              error={fields.budgetMinInr}
            />
            <TextField
              label="Budget max (₹ per person)"
              inputMode="numeric"
              value={max}
              onChange={(e) => setMax(e.target.value)}
              error={fields.budgetMaxInr}
            />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-slate-700">
            The days you could travel. The trip needs {nights} {nights === 1 ? 'night' : 'nights'}.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Available from"
              type="date"
              min={today}
              value={start}
              onChange={(e) => setStart(e.target.value)}
              error={fields.dateStart}
            />
            <TextField
              label="Available to"
              type="date"
              min={start || today}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              error={fields.dateEnd}
            />
          </div>
        </div>
      </fieldset>
      {editable ? (
        <div className="space-y-2">
          <Button type="submit" loading={save.isPending} fullWidth>
            {submitted ? 'Save changes' : 'Submit preferences'}
          </Button>
          <p className="text-center text-xs text-slate-600">
            You can change this until the shortlist is made.
          </p>
        </div>
      ) : null}
    </form>
  );
}

export function PreferencesPage() {
  const { id = '' } = useParams();
  const trip = useTrip(id);
  useDocumentTitle('Your preferences');
  const t = trip.data;
  const canHave = t !== undefined && t.status !== 'draft' && t.myStatus === 'active';
  const mine = useMyPreference(id, canHave);

  if (trip.isLoading) {
    return (
      <div className="space-y-3" aria-label="Loading preferences">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (trip.isError || !t) {
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

  const header = (
    <>
      <PageHeader title="Your preferences" />
      <p className="mb-4 text-sm text-slate-600">
        For{' '}
        <Link to={`/trips/${t.id}`} className="font-medium text-brand-700 underline">
          {t.title}
        </Link>
        . Only you can see your answers; the group sees totals.
      </p>
    </>
  );

  let body;
  if (t.status === 'draft') {
    body = <Alert>Preferences open once the organiser creates the invite link.</Alert>;
  } else if (t.myStatus === 'excluded') {
    body = <Alert>You were removed from this trip, so you cannot fill in preferences.</Alert>;
  } else if (mine.isLoading) {
    body = (
      <div aria-label="Loading your answers">
        <Skeleton className="h-64" />
      </div>
    );
  } else if (mine.isError || !mine.data) {
    body = (
      <Alert
        tone="error"
        action={
          <Button variant="ghost" onClick={() => void mine.refetch()}>
            Retry
          </Button>
        }
      >
        Your answers could not be loaded.
      </Alert>
    );
  } else {
    const editable = EDITABLE.has(t.status);
    const closed = t.status === 'cancelled' || t.status === 'completed';
    body = (
      <div className="space-y-4">
        {editable ? null : (
          <Alert tone="warning">
            {closed
              ? 'This trip is closed, so preferences can no longer change.'
              : 'Preferences are locked because the shortlist has been made.'}
          </Alert>
        )}
        {!editable && !mine.data.preference ? (
          <Card>
            <p className="text-sm text-slate-700">You did not submit preferences for this trip.</p>
          </Card>
        ) : (
          <PreferenceForm trip={t} mine={mine.data} editable={editable} />
        )}
      </div>
    );
  }

  return (
    <>
      {header}
      {body}
    </>
  );
}
