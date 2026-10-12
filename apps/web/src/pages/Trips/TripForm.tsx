import { useState } from 'react';
import type { FormEvent } from 'react';
import { CreateTripInput, type TripDetail } from '@bonvoyage/shared';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Spinner } from '../../components/ui/Spinner';
import { TextField } from '../../components/ui/TextField';
import { useMe } from '../../features/auth/api';
import { useHubs } from '../../features/trips/api';
import { ApiError } from '../../lib/api';
import { formatHub, formatInr } from '../../lib/format';

// Shared create/edit form (wireframe 03). Numbers stay as strings so an empty
// box means "missing", never 0; every typed value is kept on any error.

export interface TripFormInitial {
  title?: string;
  originHubSlug?: string;
  durationNights?: number;
  budgetTotalInr?: number;
  radiusKm?: number;
}

type Fields = Partial<Record<keyof CreateTripInput, string>>;

const num = (raw: string) => (raw.trim() === '' ? Number.NaN : Number(raw));

export function TripForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: TripFormInitial;
  submitLabel: string;
  onSubmit: (input: CreateTripInput) => Promise<TripDetail>;
}) {
  const me = useMe();
  const hubs = useHubs();
  const [title, setTitle] = useState(initial?.title ?? '');
  // null = untouched, so the home-hub preselect applies; choosing the empty
  // option stores '' and stays empty.
  const [originHubSlug, setOriginHubSlug] = useState<string | null>(initial?.originHubSlug ?? null);
  const [nights, setNights] = useState(
    initial?.durationNights !== undefined ? String(initial.durationNights) : '',
  );
  const [budget, setBudget] = useState(
    initial?.budgetTotalInr !== undefined ? String(initial.budgetTotalInr) : '',
  );
  const [radius, setRadius] = useState(
    initial?.radiusKm !== undefined ? String(initial.radiusKm) : '',
  );
  const [fields, setFields] = useState<Fields>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  // The home-hub preselect reads /api/me; it yields once the user picks anything.
  const hubValue = originHubSlug ?? me.data?.homeHubSlug ?? '';

  const budgetNumber = num(budget);
  const budgetHint = (
    <>
      Total for the whole group, for the whole trip
      {Number.isInteger(budgetNumber) && budgetNumber > 0 ? (
        <span className="block font-medium text-slate-900">
          {formatInr(budgetNumber)} for the group
        </span>
      ) : null}
    </>
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    const parsed = CreateTripInput.safeParse({
      title,
      originHubSlug: hubValue,
      durationNights: num(nights),
      budgetTotalInr: num(budget),
      radiusKm: num(radius),
    });
    if (!parsed.success) {
      const next: Fields = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string' && next[key as keyof CreateTripInput] === undefined) {
          next[key as keyof CreateTripInput] = issue.message;
        }
      }
      setFields(next);
      return;
    }
    setFields({});
    setBusy(true);
    try {
      await onSubmit(parsed.data);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fields) setFields(err.fields);
        if (err.status === 409 || !err.fields) setFormError(err.message);
      } else {
        setFormError('Something went wrong. Try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate className="max-w-md space-y-4">
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      <TextField
        label="Trip title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        error={fields.title}
        autoComplete="off"
      />
      {hubs.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Spinner /> Loading cities…
        </div>
      ) : hubs.isError ? (
        <Alert
          tone="error"
          action={
            <Button type="button" variant="ghost" onClick={() => void hubs.refetch()}>
              Retry
            </Button>
          }
        >
          The list of cities could not be loaded.
        </Alert>
      ) : (
        <Select
          label="Starting city"
          value={hubValue}
          onChange={(e) => setOriginHubSlug(e.target.value)}
          error={fields.originHubSlug}
        >
          <option value="">Choose a city</option>
          {(hubs.data?.hubs ?? []).map((h) => (
            <option key={h.slug} value={h.slug}>
              {formatHub(h)}
            </option>
          ))}
        </Select>
      )}
      <TextField
        label="Nights"
        inputMode="numeric"
        value={nights}
        onChange={(e) => setNights(e.target.value)}
        error={fields.durationNights}
      />
      <TextField
        label="Group budget (₹)"
        inputMode="numeric"
        value={budget}
        onChange={(e) => setBudget(e.target.value)}
        hint={budgetHint}
        error={fields.budgetTotalInr}
      />
      <TextField
        label="Search radius (km)"
        inputMode="numeric"
        value={radius}
        onChange={(e) => setRadius(e.target.value)}
        hint="How far from your starting city you are willing to travel by road"
        error={fields.radiusKm}
      />
      <Button type="submit" loading={busy} fullWidth>
        {submitLabel}
      </Button>
    </form>
  );
}
