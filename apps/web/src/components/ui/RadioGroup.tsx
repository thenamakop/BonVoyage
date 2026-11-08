import { useId } from 'react';

type RadioGroupProps = {
  legend: string;
  name: string;
  options: { value: string; label: string; description?: string }[];
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
      <legend className="mb-1 text-sm font-semibold text-ink">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={`flex min-h-11 cursor-pointer flex-col justify-center rounded-2xl border-2 bg-white px-4 py-1 text-sm text-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-[#808080] ${
              value === opt.value ? 'border-accent font-semibold shadow-sticker-chip' : 'border-ink'
            }`}
          >
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
            />
            <span>{opt.label}</span>
            {opt.description ? <span className="text-xs text-muted">{opt.description}</span> : null}
          </label>
        ))}
      </div>
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
    </fieldset>
  );
}
