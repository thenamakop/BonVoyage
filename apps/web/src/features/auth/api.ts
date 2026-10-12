import { MeResponse } from '@bonvoyage/shared';
import { useQuery } from '@tanstack/react-query';
import { ApiError, fetchJson } from '../../lib/api';

// The single source of truth for who is signed in. A 401 means signed out,
// not an error.
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    staleTime: 60_000,
    queryFn: async (): Promise<MeResponse | null> => {
      try {
        return await fetchJson('/api/me', MeResponse);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
  });
}
