import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NotificationsResponse, RemindResponse } from '@bonvoyage/shared';
import { z } from 'zod';
import { fetchJson } from '../../lib/api';

// S5-3 (E3, M4): in-app notifications and the organiser's reminder. 204 responses
// parse as undefined; writes must be JSON (S1-6), so a POST with no payload sends {}.
const NoContent = z.undefined();
const EMPTY_JSON_POST = {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: '{}',
};

// The bell's one query: on focus, and every 60 s only while the tab is visible.
const REFRESH_MS = 60_000;
const KEY = ['notifications'];

export function useNotifications() {
  return useQuery({
    queryKey: KEY,
    retry: false,
    queryFn: () => fetchJson('/api/notifications', NotificationsResponse),
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/notifications/${id}/read`, NoContent, EMPTY_JSON_POST),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => fetchJson('/api/notifications/read-all', NoContent, EMPTY_JSON_POST),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRemindMember(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      fetchJson(
        `/api/trips/${tripId}/members/${encodeURIComponent(userId)}/remind`,
        RemindResponse,
        EMPTY_JSON_POST,
      ),
    // Also on a 409 or 429: the trip's canRemindAt then matches what just happened.
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['trip', tripId] }),
  });
}
