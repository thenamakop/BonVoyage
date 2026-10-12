import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DestinationsResponse,
  PastTrip,
  ProfileResponse,
  type AddPastTripInput,
  type UpdateProfileInput,
} from '@bonvoyage/shared';
import { z } from 'zod';
import { fetchJson } from '../../lib/api';

const NoContent = z.undefined();
const json = (body: unknown) => ({
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export function useProfile() {
  return useQuery({
    queryKey: ['me', 'profile'],
    queryFn: () => fetchJson('/api/me/profile', ProfileResponse),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      fetchJson('/api/me/profile', ProfileResponse, { method: 'PATCH', ...json(input) }),
    onSuccess: (profile) => {
      queryClient.setQueryData(['me', 'profile'], profile);
      // /api/me carries homeHubSlug, which the trip form preselects.
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export function useAddPastTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddPastTripInput) =>
      fetchJson('/api/me/past-trips', PastTrip, { method: 'POST', ...json(input) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['me', 'profile'] }),
  });
}

export function useDeletePastTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/me/past-trips/${encodeURIComponent(id)}`, NoContent, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['me', 'profile'] }),
  });
}

export function useDestinations() {
  return useQuery({
    queryKey: ['destinations'],
    staleTime: 60 * 60 * 1000,
    queryFn: () => fetchJson('/api/destinations', DestinationsResponse),
  });
}
