import { describe, expect, it } from 'vitest';
import type { RunVotes } from '@bonvoyage/shared';
import { canVote, voteView } from './votes';

// R18: when the shortlist draws vote buttons and counts.

const shortlist = { kind: 'shortlist' } as const;
const diagnostic = { kind: 'diagnostic' } as const;
const open = { status: 'shortlisted', myStatus: 'active' } as const;
const votes: RunVotes = { counts: { a: 1, b: 0 }, voted: 1, eligible: 3, mine: 'a' };

describe('canVote', () => {
  it('an active member of a shortlisted trip with a shortlist run', () => {
    expect(canVote(open, shortlist)).toBe(true);
  });

  it.each([
    'draft',
    'collecting_preferences',
    'ready_for_recommendation',
    'packages_proposed',
    'package_selected',
    'itinerary_proposed',
    'finalised',
    'in_progress',
    'completed',
    'cancelled',
  ] as const)('not while the trip is %s', (status) => {
    expect(canVote({ status, myStatus: 'active' }, shortlist)).toBe(false);
  });

  it('not on a diagnostic run', () => {
    expect(canVote(open, diagnostic)).toBe(false);
  });

  it('not for a member who was excluded', () => {
    expect(canVote({ status: 'shortlisted', myStatus: 'excluded' }, shortlist)).toBe(false);
  });
});

describe('voteView', () => {
  it('shows the progress, counts and the caller’s vote with buttons while open', () => {
    expect(voteView(open, shortlist, votes, false)).toEqual({
      show: true,
      canVote: true,
      voted: 1,
      eligible: 3,
      counts: { a: 1, b: 0 },
      mine: 'a',
    });
  });

  it('keeps counts read-only after T9: shown, no buttons', () => {
    const view = voteView(
      { status: 'packages_proposed', myStatus: 'active' },
      shortlist,
      votes,
      false,
    );
    expect(view.show).toBe(true);
    expect(view.canVote).toBe(false);
    expect(view.counts).toEqual({ a: 1, b: 0 });
  });

  it('shows nothing for the earlier run kept after T21', () => {
    const view = voteView(
      { status: 'ready_for_recommendation', myStatus: 'active' },
      shortlist,
      votes,
      true,
    );
    expect(view.show).toBe(false);
    expect(view.canVote).toBe(false);
  });

  it('shows nothing when the API sent no votes or the run is a diagnostic', () => {
    expect(voteView(open, shortlist, undefined, false).show).toBe(false);
    expect(voteView(open, diagnostic, votes, false).show).toBe(false);
  });

  it('passes a waiting pair through: progress without counts (E4)', () => {
    const view = voteView(open, shortlist, { voted: 1, eligible: 2, mine: 'a' }, false);
    expect(view.show).toBe(true);
    expect(view.counts).toBeUndefined();
    expect(view.voted).toBe(1);
    expect(view.eligible).toBe(2);
  });
});
