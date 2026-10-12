import { z } from 'zod';
import { InvitationStatus } from '../domain';

// Invitation and roster contracts (S1-3). A trip has 2 to 8 travellers (SRS);
// one shareable link per trip, valid for INVITATION_TTL_DAYS.

export const MAX_MEMBERS = 8;
export const INVITATION_TTL_DAYS = 14;

export const InvitationResponse = z.object({
  token: z.string(),
  status: InvitationStatus,
  expiresAt: z.string(),
});
export type InvitationResponse = z.infer<typeof InvitationResponse>;

export const ActiveInvitationResponse = z.object({
  invitation: InvitationResponse.nullable(),
});
export type ActiveInvitationResponse = z.infer<typeof ActiveInvitationResponse>;

export const InvitationPreviewState = z.enum(['open', 'expired', 'revoked', 'closed', 'full']);
export type InvitationPreviewState = z.infer<typeof InvitationPreviewState>;

// The link may be forwarded beyond the group, so the preview carries the
// organiser's name and nothing else personal: no budget, dates, emails or
// other member names.
export const InvitationPreview = z.strictObject({
  tripTitle: z.string(),
  organiserName: z.string(),
  memberCount: z.number().int(),
  maxMembers: z.number().int(),
  state: InvitationPreviewState,
  alreadyMember: z.boolean(),
});
export type InvitationPreview = z.infer<typeof InvitationPreview>;

export const AcceptInvitationResponse = z.object({ tripId: z.string() });
export type AcceptInvitationResponse = z.infer<typeof AcceptInvitationResponse>;
