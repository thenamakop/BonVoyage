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
    <div className="rounded-3xl border-[2.5px] border-dashed border-ink bg-white p-8 text-center">
      <p className="font-display text-lg font-extrabold tracking-tight text-ink">{title}</p>
      {text ? <p className="mt-1 text-sm text-muted">{text}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
