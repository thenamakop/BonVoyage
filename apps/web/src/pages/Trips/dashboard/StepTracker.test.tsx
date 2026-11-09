import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StepTracker } from './StepTracker';

describe('StepTracker', () => {
  it('names the list by the step line and marks the current step', () => {
    render(<StepTracker status="shortlisted" />);
    const list = screen.getByRole('list', { name: 'Step 4 of 7: Shortlist ready' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(7);
    const current = items.filter((li) => li.getAttribute('aria-current') === 'step');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Shortlist');
    expect(items[0]).toHaveTextContent('Draft, done');
    expect(items[4]).not.toHaveTextContent('done');
  });

  it('marks every step done once the trip is finalised', () => {
    render(<StepTracker status="finalised" />);
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items.every((li) => !li.hasAttribute('aria-current'))).toBe(true);
    expect(items[6]).toHaveTextContent('Day plan, done');
  });

  it.each(['cancelled', 'completed', 'in_progress'] as const)(
    'is hidden for a %s trip',
    (status) => {
      const { container } = render(<StepTracker status={status} />);
      expect(container).toBeEmptyDOMElement();
    },
  );
});
