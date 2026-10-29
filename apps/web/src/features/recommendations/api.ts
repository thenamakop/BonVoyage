import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import {
  GroupProfileResponse,
  LatestRecommendationResponse,
  RequestRecommendationsResponse,
  TripDetail,
  type LatestRecommendationSummary,
} from '@bonvoyage/shared';
import { fetchJson } from '../../lib/api';
import { refetchOnConflict } from '../trips/api';

// S2-7: the recommendation and group-profile queries. Neither polls: each
// reloads only when a field of the polled trip moves (the useTripActivity
// pattern), so the dashboard still makes one request every 8 s.

const json = (body: unknown) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

/** Invalidate ["trip", id, part] whenever `version` changes after the first render. */
function useInvalidateOn(id: string, part: string, version: string | undefined) {
  const queryClient = useQueryClient();
  const seen = useRef(version);
  useEffect(() => {
    if (seen.current !== version) {
      seen.current = version;
      void queryClient.invalidateQueries({ queryKey: ['trip', id, part] });
    }
  }, [id, part, version, queryClient]);
}

/**
 * The newest run, reloaded when TripDetail.latestRecommendation changes.
 * `summary` is undefined until the trip has loaded.
 */
export function useLatestRecommendation(
  id: string,
  summary: LatestRecommendationSummary | null | undefined,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const version =
    summary === undefined ? undefined : summary ? `${summary.round}|${summary.createdAt}` : 'none';
  useInvalidateOn(id, 'recommendation', version);
  return useQuery({
    queryKey: ['trip', id, 'recommendation'],
    retry: false,
    enabled: enabled && version !== undefined,
    refetchOnWindowFocus: false,
    queryFn: () =>
      fetchJson(`/api/trips/${id}/recommendations/latest`, LatestRecommendationResponse),
  });
}

/**
 * Computed from current preferences on the server (0004 b). It reloads when
 * lastActivityAt moves (a submission) or updatedAt moves (a PATCH changes the
 * cap but writes no activity).
 */
export function useGroupProfile(
  id: string,
  trip: { lastActivityAt: string | null; updatedAt: string } | undefined,
) {
  const version = trip ? `${trip.lastActivityAt ?? ''}|${trip.updatedAt}` : undefined;
  useInvalidateOn(id, 'group-profile', version);
  return useQuery({
    queryKey: ['trip', id, 'group-profile'],
    retry: false,
    enabled: version !== undefined,
    refetchOnWindowFocus: false,
    queryFn: () => fetchJson(`/api/trips/${id}/group-profile`, GroupProfileResponse),
  });
}

export function useRequestRecommendations(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchJson(`/api/trips/${id}/recommendations`, RequestRecommendationsResponse, json({})),
    onSuccess: ({ run, items }) => {
      queryClient.setQueryData(['trip', id, 'recommendation'], { run, items });
      // Prefix match: the trip, its activity and the group profile reload too.
      void queryClient.invalidateQueries({ queryKey: ['trip', id] });
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
    onError: refetchOnConflict(queryClient, id),
  });
}

export function useChooseDestination(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (destinationSlug: string) =>
      fetchJson(`/api/trips/${id}/destination`, TripDetail, json({ destinationSlug })),
    onSuccess: (detail) => {
      queryClient.setQueryData(['trip', id], detail);
      void queryClient.invalidateQueries({ queryKey: ['trip', id] });
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
    onError: refetchOnConflict(queryClient, id),
  });
}

/** T21 "Ask again": the trip returns to ready_for_recommendation (decision E1). */
export function useReopenShortlist(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => fetchJson(`/api/trips/${id}/reopen-shortlist`, TripDetail, json({})),
    onSuccess: (detail) => {
      queryClient.setQueryData(['trip', id], detail);
      void queryClient.invalidateQueries({ queryKey: ['trip', id] });
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
    onError: refetchOnConflict(queryClient, id),
  });
}
