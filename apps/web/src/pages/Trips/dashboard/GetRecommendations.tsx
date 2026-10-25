import { useNavigate } from 'react-router';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { useRequestRecommendations } from '../../../features/recommendations/api';
import { ApiError } from '../../../lib/api';

// S2-7: the organiser's Get recommendations (T4, T6). The pending state is
// announced; a 409 (RECOMMENDATION_STALE, ILLEGAL_TRANSITION, GUARD_FAILED)
// shows the server's own sentence (amendment 11).

const errorText = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Something went wrong. Try again.';

export function GetRecommendations({ tripId }: { tripId: string }) {
  const request = useRequestRecommendations(tripId);
  const navigate = useNavigate();
  return (
    <div className="space-y-2">
      {request.error ? <Alert tone="error">{errorText(request.error)}</Alert> : null}
      <Button
        loading={request.isPending}
        onClick={() =>
          request.mutate(undefined, {
            onSuccess: () => void navigate(`/trips/${tripId}/shortlist`),
          })
        }
      >
        Get recommendations
      </Button>
      <p role="status" className="text-sm text-slate-600">
        {request.isPending ? 'Finding destinations, this takes a few seconds' : ''}
      </p>
    </div>
  );
}
