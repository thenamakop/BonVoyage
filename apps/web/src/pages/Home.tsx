import { HealthOk } from '@bonvoyage/shared';
import { useQuery } from '@tanstack/react-query';
import { ApiError, fetchJson } from '../lib/api';

function describe(
  isPending: boolean,
  isSuccess: boolean,
  error: Error | null,
): { icon: string; text: string } {
  if (isPending) return { icon: '…', text: 'Checking the API' };
  if (isSuccess) return { icon: '✓', text: 'API ok · Database ok' };
  if (error instanceof ApiError && error.status === 503 && error.code === 'DB_UNAVAILABLE') {
    return { icon: '⚠', text: 'API ok · Database unreachable' };
  }
  return { icon: '✕', text: 'API unreachable' };
}

export function Home() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => fetchJson('/api/health', HealthOk),
    retry: false,
    refetchInterval: 10_000,
  });
  const { icon, text } = describe(health.isPending, health.isSuccess, health.error);

  return (
    <section>
      <h1 className="text-3xl font-bold">BonVoyage</h1>
      <p className="mt-2 text-slate-700">Plan a group trip everyone agrees on.</p>
      <div
        role="status"
        className="mt-6 flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2"
      >
        <span aria-hidden="true">{icon}</span>
        <span>{text}</span>
      </div>
    </section>
  );
}
