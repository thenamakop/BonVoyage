import type { ReactNode } from 'react';

type Tone = 'info' | 'success' | 'warning' | 'error';

const tones: Record<Tone, { box: string; icon: string }> = {
  info: { box: 'border-sky-700 bg-sky-50 text-sky-900', icon: 'ℹ' },
  success: { box: 'border-green-700 bg-green-50 text-green-900', icon: '✓' },
  warning: { box: 'border-amber-700 bg-amber-50 text-amber-900', icon: '⚠' },
  error: { box: 'border-danger bg-red-50 text-red-900', icon: '⚠' },
};

export function Alert({
  tone = 'info',
  action,
  children,
}: {
  tone?: Tone;
  action?: ReactNode;
  children: ReactNode;
}) {
  const t = tones[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start justify-between gap-3 rounded-md border-l-4 p-3 text-sm ${t.box}`}
    >
      <p className="flex items-center gap-2">
        <span aria-hidden="true">{t.icon}</span>
        <span>{children}</span>
      </p>
      {action}
    </div>
  );
}
