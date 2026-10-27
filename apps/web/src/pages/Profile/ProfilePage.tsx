import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  AddPastTripInput,
  type ActiveTrip,
  type PastTrip,
  type ProfileResponse,
} from '@bonvoyage/shared';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { RadioGroup } from '../../components/ui/RadioGroup';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { TextField } from '../../components/ui/TextField';
import { useMe } from '../../features/auth/api';
import {
  useAddPastTrip,
  useDeleteAccount,
  useDeletePastTrip,
  useDestinations,
  useProfile,
  useUpdateProfile,
} from '../../features/profile/api';
import { useHubs } from '../../features/trips/api';
import { ApiError } from '../../lib/api';
import { formatDate, formatHub } from '../../lib/format';
import { useDocumentTitle } from '../../lib/use-document-title';

// The caller's profile (S1-4): home city and past trips. Sprint 2's scoring
// reads past trips rated 4 or 5; the trip form preselects the home city.

const SOMEWHERE_ELSE = '__other__';
const RATINGS = ['1', '2', '3', '4', '5'];

const errorText = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Something went wrong. Try again.';

function HomeCity({ profile }: { profile: ProfileResponse }) {
  const hubs = useHubs();
  const update = useUpdateProfile();
  const [slug, setSlug] = useState(profile.homeHubSlug ?? '');
  const [status, setStatus] = useState('');

  function onSave(e: FormEvent) {
    e.preventDefault();
    setStatus('');
    update.mutate(
      { homeHubSlug: slug === '' ? null : slug },
      { onSuccess: () => setStatus('Saved') },
    );
  }

  if (hubs.isLoading) return <Skeleton className="h-11" />;
  if (hubs.isError) {
    return (
      <Alert
        tone="error"
        action={
          <Button variant="ghost" onClick={() => void hubs.refetch()}>
            Retry
          </Button>
        }
      >
        The list of cities could not be loaded.
      </Alert>
    );
  }
  const fieldError =
    update.error instanceof ApiError ? update.error.fields?.homeHubSlug : undefined;
  return (
    <form onSubmit={onSave} className="space-y-3">
      {update.error && !fieldError ? <Alert tone="error">{errorText(update.error)}</Alert> : null}
      <Select
        label="Home city"
        value={slug}
        onChange={(e) => {
          setSlug(e.target.value);
          setStatus('');
        }}
        hint="New trips start from here unless you choose another city."
        error={fieldError}
      >
        <option value="">Not set</option>
        {(hubs.data?.hubs ?? []).map((h) => (
          <option key={h.slug} value={h.slug}>
            {formatHub(h)}
          </option>
        ))}
      </Select>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" loading={update.isPending}>
          Save
        </Button>
        <p role="status" className="text-sm text-slate-700">
          {status}
        </p>
      </div>
    </form>
  );
}

function PastTripRow({ trip }: { trip: PastTrip }) {
  const remove = useDeletePastTrip();
  const name = trip.destination?.name ?? trip.placeName ?? 'Unnamed place';
  return (
    <li className="py-2">
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <p className="font-medium text-slate-900">{name}</p>
          <p className="text-slate-600">
            {trip.visitedOn ? `Visited ${formatDate(trip.visitedOn)} · ` : ''}Rated {trip.rating}{' '}
            out of 5
          </p>
        </div>
        <Button
          variant="ghost"
          aria-label={`Remove ${name}`}
          loading={remove.isPending}
          onClick={() => remove.mutate(trip.id)}
        >
          Remove
        </Button>
      </div>
      {remove.error ? <Alert tone="error">{errorText(remove.error)}</Alert> : null}
    </li>
  );
}

type PastTripFields = Partial<
  Record<'destinationSlug' | 'placeName' | 'visitedOn' | 'rating', string>
>;

function AddPastTripForm() {
  const destinations = useDestinations();
  const add = useAddPastTrip();
  const [choice, setChoice] = useState('');
  const [placeName, setPlaceName] = useState('');
  const [visitedOn, setVisitedOn] = useState('');
  const [rating, setRating] = useState('');
  const [fields, setFields] = useState<PastTripFields>({});
  const [formError, setFormError] = useState('');
  const other = choice === SOMEWHERE_ELSE;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    const parsed = AddPastTripInput.safeParse({
      ...(other ? { placeName } : choice ? { destinationSlug: choice } : {}),
      ...(visitedOn ? { visitedOn } : {}),
      rating: rating ? Number(rating) : Number.NaN,
    });
    if (!parsed.success) {
      const next: PastTripFields = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof PastTripFields | undefined;
        if (key && next[key] === undefined) next[key] = issue.message;
      }
      setFields(next);
      return;
    }
    setFields({});
    add.mutate(parsed.data, {
      onSuccess: () => {
        setChoice('');
        setPlaceName('');
        setVisitedOn('');
        setRating('');
      },
      onError: (err) => {
        if (err instanceof ApiError && err.fields) setFields(err.fields);
        else setFormError(errorText(err));
      },
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-900">Add a past trip</h3>
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      {destinations.isError ? (
        <Alert tone="error">The list of destinations could not be loaded.</Alert>
      ) : null}
      <Select
        label="Destination"
        value={choice}
        onChange={(e) => setChoice(e.target.value)}
        error={fields.destinationSlug}
        disabled={destinations.isLoading}
      >
        <option value="">Choose a destination</option>
        {(destinations.data?.destinations ?? []).map((d) => (
          <option key={d.slug} value={d.slug}>
            {formatHub(d)}
          </option>
        ))}
        <option value={SOMEWHERE_ELSE}>Somewhere else</option>
      </Select>
      {other ? (
        <TextField
          label="Place name"
          value={placeName}
          onChange={(e) => setPlaceName(e.target.value)}
          error={fields.placeName}
          autoComplete="off"
        />
      ) : null}
      <TextField
        label="Visited on (optional)"
        type="date"
        value={visitedOn}
        onChange={(e) => setVisitedOn(e.target.value)}
        error={fields.visitedOn}
      />
      <RadioGroup
        legend="How much did you enjoy it?"
        name="rating"
        options={RATINGS.map((r) => ({ value: r, label: `${r} out of 5` }))}
        value={rating}
        onChange={setRating}
        error={fields.rating}
      />
      <Button type="submit" loading={add.isPending}>
        Add past trip
      </Button>
    </form>
  );
}

export function ProfilePage() {
  useDocumentTitle('Your profile');
  const me = useMe();
  const profile = useProfile();

  return (
    <>
      <PageHeader title="Your profile" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">About you</h2>
          <dl className="space-y-1 text-sm text-slate-700">
            <div className="flex flex-wrap justify-between gap-2">
              <dt>Name</dt>
              <dd>{me.data?.name ?? ''}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt>Email</dt>
              <dd className="break-all">{me.data?.email ?? ''}</dd>
            </div>
          </dl>
          {profile.isLoading ? (
            <Skeleton className="h-11" />
          ) : profile.data ? (
            <HomeCity profile={profile.data} />
          ) : null}
        </Card>

        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Past trips</h2>
          <p className="text-sm text-slate-600">
            Places you have been help us suggest trips you will enjoy.
          </p>
          {profile.isLoading ? (
            <div aria-label="Loading past trips">
              <Skeleton className="h-20" />
            </div>
          ) : profile.isError || !profile.data ? (
            <Alert
              tone="error"
              action={
                <Button variant="ghost" onClick={() => void profile.refetch()}>
                  Retry
                </Button>
              }
            >
              Your profile could not be loaded.
            </Alert>
          ) : profile.data.pastTrips.length === 0 ? (
            <p className="text-sm text-slate-700">No past trips yet.</p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {profile.data.pastTrips.map((t) => (
                <PastTripRow key={t.id} trip={t} />
              ))}
            </ul>
          )}
          <AddPastTripForm />
        </Card>
        <DeleteAccount />
      </div>
    </>
  );
}

// #54: delete the caller's account after password and typed email. A 422
// names the trips that block it; success goes home with a goodbye line.
function DeleteAccount() {
  const me = useMe();
  const navigate = useNavigate();
  const remove = useDeleteAccount();
  const [password, setPassword] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [blocking, setBlocking] = useState<ActiveTrip[]>([]);
  const [message, setMessage] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBlocking([]);
    setMessage('');
    setFields({});
    remove.mutate(
      { password, confirmEmail },
      {
        onSuccess: () => {
          void navigate('/', { state: { notice: 'Your account has been deleted.' } });
        },
        onError: (err) => {
          if (err instanceof ApiError && err.code === 'ACCOUNT_HAS_ACTIVE_TRIPS') {
            const details = err.details as { trips?: ActiveTrip[] } | undefined;
            setBlocking(details?.trips ?? []);
          }
          if (err instanceof ApiError && err.fields) setFields(err.fields);
          setMessage(errorText(err));
        },
      },
    );
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-900">Delete account</h2>
      <ul className="list-disc pl-5 text-sm text-slate-600">
        <li>Your sign-in, profile and past trips.</li>
        <li>Your preference answers and package opinions.</li>
        <li>Your memberships in other people's trips.</li>
        <li>Trips you organised that are finalised, completed or cancelled.</li>
      </ul>
      {blocking.length > 0 && (
        <Alert tone="error">
          Cancel or finish these trips first:
          <ul className="list-disc pl-5">
            {blocking.map((t) => (
              <li key={t.id}>
                <Link className="underline" to={`/trips/${t.id}`}>
                  {t.title}
                </Link>
              </li>
            ))}
          </ul>
        </Alert>
      )}
      {message !== '' && <Alert tone="error">{message}</Alert>}
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <TextField
          label="Password"
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          error={fields.password}
        />
        <TextField
          label={`Type ${me.data?.email ?? 'your email'} to confirm`}
          name="confirmEmail"
          type="email"
          value={confirmEmail}
          onChange={(e) => setConfirmEmail(e.target.value)}
          required
          error={fields.confirmEmail}
        />
        <Button
          type="submit"
          variant="danger"
          disabled={password === '' || confirmEmail === '' || remove.isPending}
        >
          {remove.isPending ? 'Deleting…' : 'Delete my account'}
        </Button>
      </form>
    </Card>
  );
}
