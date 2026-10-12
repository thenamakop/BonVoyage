import { useState } from 'react';
import { useNavigate } from 'react-router';
import { MAX_MEMBERS, type TripDetail, type TripMember } from '@bonvoyage/shared';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useLeaveTrip, useRemoveMember } from '../../features/invitations/api';
import { ApiError } from '../../lib/api';

// Roster (wireframe 06, S1-3). The organiser can remove a member and a member
// can leave while the trip is draft or collecting preferences; removed
// members stay listed separately and keep read-only access.

const errorText = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Something went wrong. Try again.';

function ConfirmRow({
  text,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  text: string;
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-2 space-y-2 rounded-md border border-slate-300 p-3">
      <p className="text-sm text-slate-900">{text}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="danger" loading={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function Roster({ trip }: { trip: TripDetail }) {
  const navigate = useNavigate();
  const remove = useRemoveMember(trip.id);
  const leave = useLeaveTrip(trip.id);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const open = trip.status === 'draft' || trip.status === 'collecting_preferences';
  const isOrganiser = trip.myRole === 'organiser';
  const canLeave = open && !isOrganiser && trip.myStatus === 'active';
  const active = trip.members.filter((m) => m.status === 'active');
  const removed = trip.members.filter((m) => m.status === 'excluded');
  const error = remove.error ?? leave.error;

  const memberRow = (m: TripMember) => (
    <li key={m.userId} className="py-2">
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-slate-900">{m.name}</span>
        <span className="flex items-center gap-2">
          <Badge>{m.role === 'organiser' ? 'Organiser' : 'Member'}</Badge>
          {isOrganiser && open && m.role !== 'organiser' && confirmRemove !== m.userId ? (
            <Button
              variant="ghost"
              aria-label={`Remove ${m.name}`}
              onClick={() => setConfirmRemove(m.userId)}
            >
              Remove
            </Button>
          ) : null}
        </span>
      </div>
      {confirmRemove === m.userId ? (
        <ConfirmRow
          text={`Remove ${m.name}? Their preferences will be deleted.`}
          confirmLabel="Remove"
          busy={remove.isPending}
          onConfirm={() => remove.mutate(m.userId, { onSuccess: () => setConfirmRemove(null) })}
          onCancel={() => setConfirmRemove(null)}
        />
      ) : null}
    </li>
  );

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Members</h2>
        <p className="text-sm text-slate-600">
          {active.length} of {MAX_MEMBERS} members
        </p>
      </div>
      {error ? (
        <div className="mt-2">
          <Alert tone="error">{errorText(error)}</Alert>
        </div>
      ) : null}
      <ul className="mt-1 divide-y divide-slate-200">{active.map(memberRow)}</ul>

      {removed.length > 0 ? (
        <>
          <h3 className="mt-3 text-sm font-semibold text-slate-900">Removed</h3>
          <ul className="mt-1 divide-y divide-slate-200">
            {removed.map((m) => (
              <li
                key={m.userId}
                className="flex min-h-11 items-center justify-between gap-2 text-sm"
              >
                <span className="text-slate-600">{m.name}</span>
                <Badge tone="danger">Removed</Badge>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {canLeave ? (
        confirmLeave ? (
          <ConfirmRow
            text="Leave this trip? Your preferences will be deleted."
            confirmLabel="Leave trip"
            busy={leave.isPending}
            onConfirm={() => leave.mutate(undefined, { onSuccess: () => void navigate('/trips') })}
            onCancel={() => setConfirmLeave(false)}
          />
        ) : (
          <div className="mt-3">
            <Button variant="secondary" onClick={() => setConfirmLeave(true)}>
              Leave trip
            </Button>
          </div>
        )
      ) : null}
    </Card>
  );
}
