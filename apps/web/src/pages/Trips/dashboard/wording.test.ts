import { describe, expect, it } from 'vitest';
import { exclusionWarning, progressText, stepLine, waitingFor } from './wording';

describe('dashboard wording', () => {
  it('the step line counts the seven planning statuses', () => {
    expect(stepLine('draft')).toBe('Step 1 of 7: Draft');
    expect(stepLine('collecting_preferences')).toBe('Step 2 of 7: Collecting preferences');
    expect(stepLine('cancelled')).toBe('This trip was cancelled, so planning has stopped.');
    expect(stepLine('completed')).toBe('This trip is over.');
  });

  it('progress repeats the bar as text', () => {
    expect(progressText(2, 3)).toBe('2 of 3 members have submitted');
    expect(progressText(0, 1)).toBe('0 of 1 member has submitted');
  });

  it('waiting names up to 3 people, then counts the rest', () => {
    expect(waitingFor(['Meera'])).toBe('Waiting for Meera.');
    expect(waitingFor(['Rohan', 'Meera'])).toBe('Waiting for Rohan and Meera.');
    expect(waitingFor(['A', 'B', 'C'])).toBe('Waiting for A, B and C.');
    expect(waitingFor(['A', 'B', 'C', 'D', 'E'])).toBe('Waiting for A, B, C and 2 others.');
    expect(waitingFor([])).toBe('Waiting for others to join.');
  });

  it('the close-submissions confirm names who will be left out', () => {
    expect(exclusionWarning(['Meera'])).toBe(
      'Meera has not submitted and will be left out of planning.',
    );
    expect(exclusionWarning(['Meera', 'Dev'])).toBe(
      'Meera and Dev have not submitted and will be left out of planning.',
    );
  });
});
