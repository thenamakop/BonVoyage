import type { TripStatus } from '@bonvoyage/shared';
import { planningSteps, stepLine, type StepState } from './wording';

// The seven planning steps as pills under the trip title. The list is named by
// the step line ("Step 4 of 7: Shortlist ready"), which also stays visible in the
// status banner. Done, current and to-do differ by fill, border style and a
// "done" word for screen readers, not by colour alone.

const pill: Record<StepState, { box: string; number: string }> = {
  done: {
    box: 'border-[2.5px] border-solid border-ink bg-brand-700 text-white',
    number: 'bg-mint text-ink',
  },
  current: {
    box: 'animate-ring border-[2.5px] border-solid border-ink bg-accent text-ink shadow-sticker-chip',
    number: 'bg-white text-ink',
  },
  todo: {
    box: 'border-2 border-dashed border-ink/60 bg-white text-muted',
    number: 'bg-cream text-ink',
  },
};

export function StepTracker({ status }: { status: TripStatus }) {
  const steps = planningSteps(status);
  if (!steps) return null;
  return (
    // Below sm all seven stay on one row: only the current pill shows its label; the
    // others show their number, with the label kept for screen readers.
    <ol aria-label={stepLine(status)} className="mb-4 flex gap-1 sm:flex-wrap sm:gap-2">
      {steps.map((step, i) => {
        const current = step.state === 'current';
        return (
          <li
            key={step.label}
            aria-current={current ? 'step' : undefined}
            className={`flex shrink-0 items-center gap-1.5 rounded-full text-xs font-bold sm:min-h-9 sm:gap-2 sm:py-1 sm:pl-1 sm:pr-3 sm:text-sm ${
              current ? 'pr-2.5' : ''
            } ${pill[step.state].box}`}
          >
            <span
              aria-hidden="true"
              className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink text-[11px] sm:h-7 sm:w-7 sm:text-xs ${pill[step.state].number}`}
            >
              {i + 1}
            </span>
            <span className={current ? '' : 'sr-only sm:not-sr-only'}>{step.label}</span>
            {step.state === 'done' ? <span className="sr-only">, done</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
