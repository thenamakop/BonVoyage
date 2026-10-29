import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { useReopenShortlist } from '../../../features/recommendations/api';
import { ASK_AGAIN_CONFIRM } from '../../../features/recommendations/wording';
import { ApiError } from '../../../lib/api';

// T21 "Ask again" (decision E1): the organiser sends the trip back to
// ready_for_recommendation so members can revise and a new round can run.

const errorText = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Something went wrong. Try again.';

export function AskAgain({ tripId }: { tripId: string }) {
  const reopen = useReopenShortlist(tripId);
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="space-y-2">
      {reopen.error ? <Alert tone="error">{errorText(reopen.error)}</Alert> : null}
      {confirming ? (
        <div className="space-y-2 rounded-md border border-slate-300 p-3">
          <p className="text-sm text-slate-900">{ASK_AGAIN_CONFIRM}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              loading={reopen.isPending}
              onClick={() =>
                reopen.mutate(undefined, {
                  onSuccess: () => void navigate(`/trips/${tripId}`),
                  onSettled: () => setConfirming(false),
                })
              }
            >
              Ask again
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Keep this shortlist
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setConfirming(true)}>
          Ask again
        </Button>
      )}
      <p role="status" className="sr-only">
        {reopen.isPending ? 'Asking again' : ''}
      </p>
    </div>
  );
}
