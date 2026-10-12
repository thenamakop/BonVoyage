import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '../index';
import { INVITATION_TTL_DAYS, InvitationPreview, MAX_MEMBERS } from './invitations';

const preview = {
  tripTitle: 'Long weekend in the hills',
  organiserName: 'Asha',
  memberCount: 3,
  maxMembers: MAX_MEMBERS,
  state: 'open',
  alreadyMember: false,
};

describe('InvitationPreview', () => {
  it('accepts the safe preview', () => {
    expect(InvitationPreview.parse(preview)).toEqual(preview);
  });

  it('rejects any extra field, so a budget or member list cannot leak through', () => {
    expect(InvitationPreview.safeParse({ ...preview, budgetTotalInr: 48000 }).success).toBe(false);
    expect(InvitationPreview.safeParse({ ...preview, members: ['Rohan'] }).success).toBe(false);
  });
});

describe('invitation constants and codes', () => {
  it('caps a trip at 8 travellers and a link at 14 days', () => {
    expect(MAX_MEMBERS).toBe(8);
    expect(INVITATION_TTL_DAYS).toBe(14);
  });

  it('adds the seven S1-3 error codes', () => {
    for (const code of [
      'INVITATIONS_CLOSED',
      'INVITATION_EXPIRED',
      'TRIP_FULL',
      'MEMBER_EXCLUDED',
      'CANNOT_REMOVE_ORGANISER',
      'ORGANISER_CANNOT_LEAVE',
      'TRIP_LOCKED',
    ]) {
      expect(ERROR_CODES).toHaveProperty(code, code);
    }
  });
});
