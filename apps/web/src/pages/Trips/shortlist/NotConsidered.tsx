import { useDestinations } from '../../../features/profile/api';

// 0004 e: destinations without catalogue costs are listed, never silently
// dropped (amendment 4: on every run, shortlists included).

export function NotConsidered({ slugs }: { slugs: readonly string[] }) {
  const destinations = useDestinations();
  const names = new Map((destinations.data?.destinations ?? []).map((d) => [d.slug, d.name]));
  return (
    <details className="rounded-lg border border-slate-300 bg-white p-4 text-sm">
      <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-slate-900">
        Not considered ({slugs.length})
      </summary>
      <p className="mt-2 text-slate-600">
        These places have no costs in the catalogue yet, so they were left out.
      </p>
      <ul className="mt-2 list-inside list-disc text-slate-900">
        {slugs.map((slug) => (
          <li key={slug}>{names.get(slug) ?? slug}</li>
        ))}
      </ul>
    </details>
  );
}
