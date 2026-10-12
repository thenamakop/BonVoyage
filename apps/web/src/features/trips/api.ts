import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import {
  ActivityResponse,
  HubsResponse,
  TripDetail,
  TripsResponse,
  type CreateTripInput,
  type UpdateTripInput,
} from '@bonvoyage/shared';
import { z } from 'zod';
import { ApiError, fetchJson } from '../../lib/api';

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

// SRS 3.3: the dashboard sees other people's changes within 10 seconds. Only
// the trip is polled, only on the dashboard (live), only while the tab is
// visible, and never once the trip is over.
const LIVE_INTERVAL_MS = 10_000;
const FINISHED = new Set(['cancelled', 'completed']);

export function useTrip(id: string, { live = false }: { live?: boolean } = {}) {
  return useQuery({
    queryKey: ['trip', id],
    retry: false,
    queryFn: () => fetchJson(`/api/trips/${id}`, TripDetail),
    refetchInterval: live
      ? (query) => {
          const data = query.state.data;
          // A trip that never loaded (404, network) is not polled; a failed
          // background refetch keeps the old data and keeps trying.
          if (!data || FINISHED.has(data.status)) return false;
          return LIVE_INTERVAL_MS;
        }
      : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

/**
 * The activity list is not polled: it reloads only when the polled trip's
 * lastActivityAt moves, which halves the dashboard's requests.
 */
export function useTripActivity(id: string, lastActivityAt: string | null | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['trip', id, 'activity'],
    retry: false,
    enabled: lastActivityAt !== undefined,
    // Not on focus either: the trip's own focus refetch reveals any new activity.
    refetchOnWindowFocus: false,
    queryFn: () => fetchJson(`/api/trips/${id}/activity`, ActivityResponse),
  });
  const seen = useRef(lastActivityAt);
  useEffect(() => {
    if (seen.current !== lastActivityAt) {
      seen.current = lastActivityAt;
      void queryClient.invalidateQueries({ queryKey: ['trip', id, 'activity'] });
    }
  }, [id, lastActivityAt, queryClient]);
  return query;
}

// On a 409 the trip moved under the viewer: show the server's message (the
// caller does) and reload the trip so the buttons match the new state.
function refetchOnConflict(queryClient: QueryClient, id: string) {
  return (err: unknown) => {
    if (err instanceof ApiError && err.status === 409) {
      void queryClient.invalidateQueries({ queryKey: ['trip', id] });
    }
  };
}

export function useCloseSubmissions(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchJson(`/api/trips/${id}/close-submissions`, TripDetail, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
    onSuccess: (detail) => {
      queryClient.setQueryData(['trip', id], detail);
      // Prefix match: the activity and invitation queries reload too.
      void queryClient.invalidateQueries({ queryKey: ['trip', id] });
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
    onError: refetchOnConflict(queryClient, id),
  });
}

const CancelResponse = z.object({ id: z.string(), status: z.string() });

export function useCancelTrip(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => fetchJson(`/api/trips/${id}/cancel`, CancelResponse, { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trip', id] });
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
    onError: refetchOnConflict(queryClient, id),
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
