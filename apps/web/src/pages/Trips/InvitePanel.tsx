import { useRef, useState } from 'react';
import { MAX_MEMBERS, type TripDetail } from '@bonvoyage/shared';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { TextField } from '../../components/ui/TextField';
import {
  useActiveInvitation,
  useCreateInvitation,
  useRevokeInvitation,
} from '../../features/invitations/api';
import { ApiError } from '../../lib/api';
import { formatDate } from '../../lib/format';

// Organiser-only invite link (wireframe 06, S1-3). Creating the first link is
// T2: the trip opens for preferences and its details can no longer change.

const errorText = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Something went wrong. Try again.';

export function InvitePanel({ trip }: { trip: TripDetail }) {
  const isDraft = trip.status === 'draft';
  const active = useActiveInvitation(trip.id, !isDraft);
  const create = useCreateInvitation(trip.id);
  const revoke = useRevokeInvitation(trip.id);
  const inputRef = useRef<HTMLInputElement>(null);
  const [announcement, setAnnouncement] = useState('');
  const [confirmOff, setConfirmOff] = useState(false);

  const memberCount = trip.members.filter((m) => m.status === 'active').length;
  const countLine = `${memberCount} of ${MAX_MEMBERS} members`;
  const invitation = active.data?.invitation ?? null;
  const url = invitation ? `${window.location.origin}/join/${invitation.token}` : '';

  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error('no clipboard');
      await navigator.clipboard.writeText(url);
      setAnnouncement('Link copied');
    } catch {
      inputRef.current?.select();
      setAnnouncement('Press Ctrl+C to copy');
    }
  }

  async function share() {
    try {
      await navigator.share({ title: trip.title, text: `Join "${trip.title}" on BonVoyage`, url });
    } catch {
      // The person closed the share sheet; nothing to report.
    }
  }

  const createButton = (label: string) => (
    <Button loading={create.isPending} onClick={() => create.mutate()}>
      {label}
    </Button>
  );

  let body;
  if (isDraft) {
    body = (
      <>
        <p className="text-sm text-slate-700">
          Creating the link opens the trip for preferences. After that, the trip details can no
          longer be edited.
        </p>
        {createButton('Create invite link')}
      </>
    );
  } else if (active.isLoading) {
    body = (
      <div aria-label="Loading invite link">
        <Skeleton className="h-11" />
      </div>
    );
  } else if (active.isError) {
    body = (
      <Alert
        tone="error"
        action={
          <Button variant="ghost" onClick={() => void active.refetch()}>
            Retry
          </Button>
        }
      >
        The invite link could not be loaded.
      </Alert>
    );
  } else if (!invitation) {
    body = (
      <>
        <p className="text-sm text-slate-700">
          The link is off. Nobody new can join until you create a new one.
        </p>
        {createButton('Create invite link')}
      </>
    );
  } else {
    body = (
      <>
        <TextField
          ref={inputRef}
          label="Invite link"
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          hint={`Expires ${formatDate(invitation.expiresAt)}`}
        />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void copy()}>Copy</Button>
          {typeof navigator.share === 'function' ? (
            <Button variant="secondary" onClick={() => void share()}>
              Share
            </Button>
          ) : null}
          {confirmOff ? null : (
            <Button variant="ghost" onClick={() => setConfirmOff(true)}>
              Turn off link
            </Button>
          )}
        </div>
        {confirmOff ? (
          <div className="space-y-2 rounded-md border border-slate-300 p-3">
            <p className="text-sm text-slate-900">
              Turn off this link? Nobody new can join with it.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="danger"
                loading={revoke.isPending}
                onClick={() =>
                  revoke.mutate(undefined, {
                    onSuccess: () => {
                      setConfirmOff(false);
                      setAnnouncement('Link turned off');
                    },
                  })
                }
              >
                Turn off
              </Button>
              <Button variant="secondary" onClick={() => setConfirmOff(false)}>
                Keep link
              </Button>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  const mutationError = create.error ?? revoke.error;

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Invite people</h2>
        <p className="text-sm text-slate-600">{countLine}</p>
      </div>
      {mutationError ? <Alert tone="error">{errorText(mutationError)}</Alert> : null}
      {body}
      <p role="status" className="text-sm text-slate-700">
        {announcement}
      </p>
    </Card>
  );
}
