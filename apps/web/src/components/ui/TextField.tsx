import { useId } from 'react';
import type { ComponentProps, ReactNode } from 'react';

type TextFieldProps = ComponentProps<'input'> & {
  label: string;
  hint?: string;
  error?: ReactNode;
};

export function TextField({ label, hint, error, id, className = '', ...rest }: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-slate-900">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={`min-h-11 w-full rounded-md border bg-white px-3 text-sm ${
          error ? 'border-danger' : 'border-slate-300'
        }`}
        {...rest}
      />
      {hint ? (
        <p id={hintId} className="mt-1 text-xs text-slate-600">
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
