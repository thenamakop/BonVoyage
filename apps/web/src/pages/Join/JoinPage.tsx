import { useNavigate, useParams } from 'react-router';
import { MAX_MEMBERS, type InvitationPreview } from '@bonvoyage/shared';
import { Alert } from '../../components/ui/Alert';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { useMe } from '../../features/auth/api';
import { useAcceptInvitation, useInvitationPreview } from '../../features/invitations/api';
import { ApiError } from '../../lib/api';
import { useDocumentTitle } from '../../lib/use-document-title';

// Public join page (wireframe 04, S1-3). Outside RequireAuth: anyone with the
// link sees the safe preview, then signs in or up and comes back here.

const CLOSED_TEXT: Record<Exclude<InvitationPreview['state'], 'open'>, string> = {
  expired: 'This link has expired. Ask the organiser for a new one.',
  revoked: 'This link was turned off. Ask the organiser for a new one.',
  closed: 'This trip is no longer taking new members.',
  full: `This trip already has ${MAX_MEMBERS} members, so nobody else can join.`,
};

export function JoinPage() {
  useDocumentTitle('Join a trip');
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const me = useMe();
  const preview = useInvitationPreview(token);
  const accept = useAcceptInvitation(token);

  if (preview.isLoading || me.isPending) {
    return (
      <div className="mx-auto max-w-md space-y-3" aria-label="Loading invitation">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (preview.isError || !preview.data) {
    const invalid = preview.error instanceof ApiError && preview.error.status === 404;
    return (
      <Card className="mx-auto max-w-md space-y-3">
        {invalid ? (
          <>
            <h1 className="text-xl font-bold">Invitation not found</h1>
            <p className="text-sm text-slate-700">This invitation link is not valid.</p>
            <ButtonLink to="/trips" variant="secondary">
              Go to your trips
            </ButtonLink>
          </>
        ) : (
          <Alert
            tone="error"
            action={
              <Button variant="ghost" onClick={() => void preview.refetch()}>
                Retry
              </Button>
            }
          >
            The invitation could not be loaded.
          </Alert>
        )}
      </Card>
    );
  }

  const p = preview.data;
  const signedIn = Boolean(me.data);
  const next = encodeURIComponent(`/join/${token}`);
  const join = () =>
    accept.mutate(undefined, { onSuccess: ({ tripId }) => void navigate(`/trips/${tripId}`) });

  let body;
  if (p.alreadyMember) {
    body = (
      <>
        <p className="text-sm text-slate-900">You are already in this trip.</p>
        {p.state === 'open' ? (
          // Accepting again is idempotent and returns the trip id.
          <Button fullWidth loading={accept.isPending} onClick={join}>
            Open trip
          </Button>
        ) : (
          <ButtonLink to="/trips" fullWidth>
            Open your trips
          </ButtonLink>
        )}
      </>
    );
  } else if (p.state !== 'open') {
    body = (
      <>
        <Alert tone="warning">{CLOSED_TEXT[p.state]}</Alert>
        <ButtonLink to="/trips" variant="secondary" fullWidth>
          Go to your trips
        </ButtonLink>
      </>
    );
  } else if (!signedIn) {
    body = (
      <>
        <p className="text-sm text-slate-700">Sign in to join. You return here after signing in.</p>
        <ButtonLink to={`/sign-in?next=${next}`} fullWidth>
          Sign in to join
        </ButtonLink>
        <ButtonLink to={`/sign-up?next=${next}`} variant="secondary" fullWidth>
          Create an account
        </ButtonLink>
      </>
    );
  } else {
    body = (
      <>
        <p className="text-sm text-slate-700">
          Your answers are visible only to you; the group sees totals.
        </p>
        <Button fullWidth loading={accept.isPending} onClick={join}>
          Join the trip
        </Button>
      </>
    );
  }

  return (
    <Card className="mx-auto max-w-md space-y-3">
      <h1 className="text-xl font-bold">{p.tripTitle}</h1>
      <p className="text-sm text-slate-700">{p.organiserName} invited you</p>
      <p className="text-sm text-slate-600">
        {p.memberCount} of {p.maxMembers} members
      </p>
      {accept.error ? (
        <Alert tone="error">
          {accept.error instanceof ApiError
            ? accept.error.message
            : 'Something went wrong. Try again.'}
        </Alert>
      ) : null}
      {body}
    </Card>
  );
}
