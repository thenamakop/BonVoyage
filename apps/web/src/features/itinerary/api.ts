import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ItineraryResponse, TripDetail } from '@bonvoyage/shared';
import { fetchJson } from '../../lib/api';
import { refetchOnConflict } from '../trips/api';

const post = { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' };

export function useItinerary(id: string, version: string | undefined) {
  return useQuery({
    queryKey: ['trip', id, 'itinerary', version],
    enabled: version !== undefined,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: () => fetchJson(`/api/trips/${id}/itinerary`, ItineraryResponse),
  });
}

export function usePlanDays(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => fetchJson(`/api/trips/${id}/itinerary`, ItineraryResponse, post),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['trip', id] });
      void client.invalidateQueries({ queryKey: ['trips'] });
    },
    onError: refetchOnConflict(client, id),
  });
}

export function useDecideItinerary(id: string, decision: 'accept' | 'reject') {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => fetchJson(`/api/trips/${id}/itinerary/${decision}`, TripDetail, post),
    onSuccess: (trip) => {
      client.setQueryData(['trip', id], trip);
      void client.invalidateQueries({ queryKey: ['trip', id] });
      void client.invalidateQueries({ queryKey: ['trips'] });
    },
    onError: refetchOnConflict(client, id),
  });
}
