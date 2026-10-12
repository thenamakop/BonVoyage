import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-slate-300 bg-white p-4 ${className}`}>
      {children}
    </section>
  );
}
