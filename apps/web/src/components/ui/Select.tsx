import { useId } from 'react';
import type { ComponentProps, ReactNode } from 'react';

type SelectProps = ComponentProps<'select'> & {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

export function Select({ label, hint, error, id, className = '', children, ...rest }: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const hintId = `${selectId}-hint`;
  const errorId = `${selectId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <div className={className}>
      <label htmlFor={selectId} className="mb-1 block text-sm font-semibold text-ink">
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={`min-h-11 w-full rounded-xl border-2 bg-white px-3 text-sm text-ink focus:shadow-[0_0_0_4px_var(--color-accent)] focus-visible:outline-offset-4 ${
          error ? 'border-danger' : 'border-ink'
        }`}
        {...rest}
      >
        {children}
      </select>
      {hint ? (
        <p id={hintId} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="mt-1 flex items-center gap-1 text-xs text-danger">
          <span aria-hidden="true">⚠</span>
          {error}
        </p>
      ) : null}
    </div>
  );
}
