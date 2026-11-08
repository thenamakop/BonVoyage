import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-3xl border-[2.5px] border-ink bg-white p-6 shadow-sticker ${className}`}
    >
      {children}
    </section>
  );
}
