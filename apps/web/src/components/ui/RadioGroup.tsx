import { useId } from 'react';

type RadioGroupProps = {
  legend: string;
  name: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
};

export function RadioGroup({
  legend,
  name,
  options,
  value,
  onChange,
  hint,
  error,
}: RadioGroupProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <fieldset aria-describedby={describedBy || undefined}>
      <legend className="mb-1 text-sm font-medium text-slate-900">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-4 text-sm ${
              value === opt.value
                ? 'border-brand-700 bg-brand-700 text-white'
                : 'border-slate-300 bg-white text-slate-900'
            }`}
          >
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
            />
            {opt.label}
          </label>
        ))}
      </div>
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
    </fieldset>
  );
}
