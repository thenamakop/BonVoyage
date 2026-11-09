import { useId } from 'react';

type ChipGroupProps = {
  legend: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  hint?: string;
  error?: string;
};

export function ChipGroup({ legend, options, selected, onChange, hint, error }: ChipGroupProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  function toggle(value: string, checked: boolean) {
    onChange(checked ? [...selected, value] : selected.filter((v) => v !== value));
  }

  return (
    <fieldset aria-describedby={describedBy || undefined}>
      <legend className="mb-1 text-sm font-semibold text-ink">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const checked = selected.includes(opt.value);
          return (
            <label
              key={opt.value}
              className={`flex min-h-11 cursor-pointer items-center rounded-full border-2 border-ink px-4 text-sm font-semibold text-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-[#808080] ${
                checked ? 'gap-1.5 bg-mint pl-3' : 'bg-white'
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                onChange={(e) => toggle(opt.value, e.target.checked)}
              />
              {/* A tick as well as the fill, so selection is not shown by colour alone. */}
              {checked ? (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  className="h-4 w-4 fill-none stroke-ink stroke-[2.5]"
                >
                  <path d="M3 8.5l3.2 3L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
              {opt.label}
            </label>
          );
        })}
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
