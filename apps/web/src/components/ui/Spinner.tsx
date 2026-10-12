export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-700"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
