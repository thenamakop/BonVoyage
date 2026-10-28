import type { TripAction } from '@bonvoyage/shared';
import { useNavigate } from 'react-router';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { usePlanDays } from '../../../features/itinerary/api';

export function PlanDays({ id, action }: { id: string; action: TripAction }) {
  const plan = usePlanDays(id);
  const navigate = useNavigate();
  return (
    <div className="space-y-2">
      <Button
        disabled={!action.enabled}
        loading={plan.isPending}
        onClick={() =>
          plan.mutate(undefined, { onSuccess: () => void navigate(`/trips/${id}/itinerary`) })
        }
      >
        Plan the days
      </Button>
      {!action.enabled && action.reason ? <p>{action.reason}</p> : null}
      {plan.isPending ? (
        <p role="status">Planning the days. This can take up to 30 seconds.</p>
      ) : null}
      {plan.error ? (
        <Alert tone="error">
          {plan.error instanceof Error ? plan.error.message : 'Something went wrong. Try again.'}
        </Alert>
      ) : null}
    </div>
  );
}
