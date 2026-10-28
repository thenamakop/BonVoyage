import { MeResponse } from '@bonvoyage/shared';
import { useQuery, type QueryClient } from '@tanstack/react-query';
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

/**
 * Sign the client out after sign-out or account deletion: drop every
 * user-scoped query and reset `me`. Resetting (not removing) keeps the query
 * that mounted observers such as the header hold, so they stop showing the
 * old user; while it refetches `me` has no data, so RequireAuth waits instead
 * of redirecting, and the refetch's 401 makes it null.
 */
export function clearSession(queryClient: QueryClient): void {
  const isMe = (key: readonly unknown[]) => key.length === 1 && key[0] === 'me';
  queryClient.removeQueries({ predicate: (q) => !isMe(q.queryKey) });
  void queryClient.resetQueries({ queryKey: ['me'], exact: true });
}
