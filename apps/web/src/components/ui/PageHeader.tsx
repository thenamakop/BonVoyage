import type { ReactNode } from 'react';

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-bold text-slate-900">{title}</h1>
      {actions}
    </div>
  );
}
