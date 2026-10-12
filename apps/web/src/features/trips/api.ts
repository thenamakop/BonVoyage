import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  HubsResponse,
  TripDetail,
  TripsResponse,
  type CreateTripInput,
  type UpdateTripInput,
} from '@bonvoyage/shared';
import { fetchJson } from '../../lib/api';

export function useHubs() {
  return useQuery({
    queryKey: ['hubs'],
    staleTime: 60 * 60 * 1000,
    queryFn: () => fetchJson('/api/hubs', HubsResponse),
  });
}

export function useMyTrips() {
  return useQuery({
    queryKey: ['trips'],
    queryFn: () => fetchJson('/api/me/trips', TripsResponse),
  });
}

export function useTrip(id: string) {
  return useQuery({
    queryKey: ['trip', id],
    retry: false,
    queryFn: () => fetchJson(`/api/trips/${id}`, TripDetail),
  });
}

export function useCreateTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTripInput) =>
      fetchJson('/api/trips', TripDetail, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: (detail) => {
      queryClient.setQueryData(['trip', detail.id], detail);
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}

export function useUpdateTrip(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTripInput) =>
      fetchJson(`/api/trips/${id}`, TripDetail, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: (detail) => {
      queryClient.setQueryData(['trip', id], detail);
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}
