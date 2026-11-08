import type { ReactNode } from 'react';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const tones: Record<Tone, string> = {
  neutral: 'bg-cream text-ink',
  info: 'bg-sky-100 text-sky-900',
  success: 'bg-mint-soft text-ink',
  warning: 'bg-amber-100 text-amber-900',
  danger: 'bg-red-100 text-red-900',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border-2 border-ink px-2.5 py-1 text-xs font-bold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
