import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AcceptInvitationResponse,
  ActiveInvitationResponse,
  InvitationPreview,
  InvitationResponse,
} from '@bonvoyage/shared';
import { z } from 'zod';
import { fetchJson } from '../../lib/api';

// Invitation link and roster hooks (S1-3). 204 responses parse as undefined.
const NoContent = z.undefined();

// Writes must be JSON (S1-6), so a POST without a payload sends {}.
const EMPTY_JSON_POST = {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: '{}',
};

export function useActiveInvitation(tripId: string, enabled = true) {
  return useQuery({
    queryKey: ['trip', tripId, 'invitation'],
    enabled,
    queryFn: () => fetchJson(`/api/trips/${tripId}/invitations/active`, ActiveInvitationResponse),
  });
}

export function useCreateInvitation(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchJson(`/api/trips/${tripId}/invitations`, InvitationResponse, EMPTY_JSON_POST),
    onSuccess: (invitation) => {
      queryClient.setQueryData(['trip', tripId, 'invitation'], { invitation });
      // The first link is T2: the trip's status changes too.
      void queryClient.invalidateQueries({ queryKey: ['trip', tripId], exact: true });
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}

export function useRevokeInvitation(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchJson(`/api/trips/${tripId}/invitations/active`, NoContent, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.setQueryData(['trip', tripId, 'invitation'], { invitation: null });
    },
  });
}

export function useInvitationPreview(token: string) {
  return useQuery({
    queryKey: ['invitation', token],
    retry: false,
    queryFn: () => fetchJson(`/api/invitations/${token}`, InvitationPreview),
  });
}

export function useAcceptInvitation(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchJson(`/api/invitations/${token}/accept`, AcceptInvitationResponse, EMPTY_JSON_POST),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
      void queryClient.invalidateQueries({ queryKey: ['invitation', token] });
    },
  });
}

export function useRemoveMember(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      fetchJson(`/api/trips/${tripId}/members/${encodeURIComponent(userId)}`, NoContent, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}

export function useLeaveTrip(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => fetchJson(`/api/trips/${tripId}/members/me`, NoContent, { method: 'DELETE' }),
    onSuccess: () => {
      // Mark stale without refetching: the caller navigates away, and a
      // refetch now would only flash "Trip not found".
      void queryClient.invalidateQueries({ queryKey: ['trip', tripId], refetchType: 'none' });
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}
