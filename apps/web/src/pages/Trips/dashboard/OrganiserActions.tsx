import { useId, useState } from 'react';
import type { TripAction, TripDetail } from '@bonvoyage/shared';
import { Alert } from '../../../components/ui/Alert';
import { Button, ButtonLink } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { useCancelTrip, useCloseSubmissions } from '../../../features/trips/api';
import { ApiError } from '../../../lib/api';
import { InvitePanel } from '../InvitePanel';
import { exclusionWarning } from './wording';

// Organiser actions (wireframe 06), driven only by availableActions: nothing
// here decides from the status itself. A disabled action shows its reason.

const errorText = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Something went wrong. Try again.';

function Confirm({
  text,
  confirmLabel,
  keepLabel,
  busy,
  onConfirm,
  onKeep,
}: {
  text: string;
  confirmLabel: string;
  keepLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onKeep: () => void;
}) {
  return (
    <div className="space-y-2 rounded-md border border-slate-300 p-3">
      <p className="text-sm text-slate-900">{text}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="danger" loading={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button variant="secondary" onClick={onKeep}>
          {keepLabel}
        </Button>
      </div>
    </div>
  );
}

function CloseSubmissions({ trip, action }: { trip: TripDetail; action: TripAction }) {
  const close = useCloseSubmissions(trip.id);
  const [confirming, setConfirming] = useState(false);
  const reasonId = useId();
  const pending = trip.members.filter((m) => m.status === 'active' && !m.submitted);

  if (!action.enabled) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" disabled aria-describedby={reasonId}>
          Close submissions
        </Button>
        <p id={reasonId} className="text-sm text-slate-600">
          {action.reason}
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {close.error ? <Alert tone="error">{errorText(close.error)}</Alert> : null}
      {confirming ? (
        <Confirm
          text={exclusionWarning(pending.map((m) => m.name))}
          confirmLabel="Close submissions"
          keepLabel="Keep waiting"
          busy={close.isPending}
          onConfirm={() => close.mutate(undefined, { onSettled: () => setConfirming(false) })}
          onKeep={() => setConfirming(false)}
        />
      ) : (
        <Button variant="secondary" onClick={() => setConfirming(true)}>
          Close submissions
        </Button>
      )}
    </div>
  );
}

function CancelTrip({ trip }: { trip: TripDetail }) {
  const cancel = useCancelTrip(trip.id);
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="space-y-2">
      {cancel.error ? <Alert tone="error">{errorText(cancel.error)}</Alert> : null}
      {confirming ? (
        <Confirm
          text="Cancel this trip? Nobody will be able to plan it after this."
          confirmLabel="Cancel trip"
          keepLabel="Keep the trip"
          busy={cancel.isPending}
          onConfirm={() => cancel.mutate(undefined, { onSettled: () => setConfirming(false) })}
          onKeep={() => setConfirming(false)}
        />
      ) : (
        <Button variant="ghost" onClick={() => setConfirming(true)}>
          Cancel trip
        </Button>
      )}
    </div>
  );
}

export function OrganiserActions({ trip }: { trip: TripDetail }) {
  const find = (name: TripAction['action']) => trip.availableActions.find((a) => a.action === name);
  const invite = find('invite');
  const editDetails = find('editDetails');
  const closeAction = find('closeSubmissions');
  const cancel = find('cancelTrip');
  if (!invite && !editDetails && !closeAction && !cancel) return null;

  return (
    <div className="space-y-4">
      {invite ? <InvitePanel trip={trip} /> : null}
      {editDetails || closeAction || cancel ? (
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Organiser actions</h2>
          {editDetails?.enabled ? (
            <ButtonLink to={`/trips/${trip.id}/edit`} variant="secondary">
              Edit details
            </ButtonLink>
          ) : null}
          {closeAction ? <CloseSubmissions trip={trip} action={closeAction} /> : null}
          {cancel?.enabled ? <CancelTrip trip={trip} /> : null}
        </Card>
      ) : null}
    </div>
  );
}
