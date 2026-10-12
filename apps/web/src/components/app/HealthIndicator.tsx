import { HealthOk } from '@bonvoyage/shared';
import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '../../lib/api';

export function describeHealth(
  isPending: boolean,
  isSuccess: boolean,
): { ok: boolean; text: string } {
  if (isPending) return { ok: true, text: 'Checking the service' };
  if (isSuccess) return { ok: true, text: 'All systems normal' };
  return { ok: false, text: 'Service problem' };
}

export function HealthIndicator() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => fetchJson('/api/health', HealthOk),
    retry: false,
    refetchInterval: 60_000,
  });
  const { ok, text } = describeHealth(health.isPending, health.isSuccess);

  return (
    <p role="status" className="flex items-center gap-2 text-xs text-slate-500">
      <span
        aria-hidden="true"
        className={`inline-block h-2 w-2 rounded-full ${ok ? 'bg-success' : 'bg-danger'}`}
      />
      {text}
    </p>
  );
}
