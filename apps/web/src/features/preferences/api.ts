import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MyPreferenceResponse,
  SavePreferenceResponse,
  type PreferenceInput,
} from '@bonvoyage/shared';
import { fetchJson } from '../../lib/api';

// The caller's own preference for one trip (S1-4). There is no hook for
// anyone else's answers because no endpoint returns them.

export function useMyPreference(tripId: string, enabled = true) {
  return useQuery({
    queryKey: ['trip', tripId, 'preference'],
    enabled,
    queryFn: () => fetchJson(`/api/trips/${tripId}/preferences/me`, MyPreferenceResponse),
  });
}

export function useSavePreference(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PreferenceInput) =>
      fetchJson(`/api/trips/${tripId}/preferences/me`, SavePreferenceResponse, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(['trip', tripId, 'preference'], {
        preference: saved.preference,
        submittedAt: saved.submittedAt,
      });
      // The trip's status and "submitted" flags may have changed (T3).
      void queryClient.invalidateQueries({ queryKey: ['trip', tripId], exact: true });
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}
