import type { ReactNode } from 'react';

export function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
      <p className="text-base font-semibold text-slate-900">{title}</p>
      {text ? <p className="mt-1 text-sm text-slate-600">{text}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
