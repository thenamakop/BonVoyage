import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRIP_ID } from '../../test/trip-fixture';
import { useGroupProfile, useLatestRecommendation, useRequestRecommendations } from './api';

// S2-7 step 1: the two queries reload only when a field of the polled trip
// moves (nothing new polls), and the request mutation primes the run's cache.

const PROFILE_URL = `/api/trips/${TRIP_ID}/group-profile`;
const LATEST_URL = `/api/trips/${TRIP_ID}/recommendations/latest`;
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
const callsTo = (url: string) => fetchMock.mock.calls.filter((c) => c[0] === url).length;

function wrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockImplementation((url, init) => {
    if (url === PROFILE_URL)
      return Promise.resolve(Response.json({ ready: false, memberCount: 1 }));
    if (url === LATEST_URL) return Promise.resolve(Response.json({ run: null, items: [] }));
    if (url === `/api/trips/${TRIP_ID}/recommendations` && init?.method === 'POST') {
      return Promise.resolve(
        Response.json({
          run: null,
          items: [],
          transition: { transitionId: 'T4', to: 'collecting_preferences' },
        }),
      );
    }
    return Promise.resolve(
      Response.json({ error: { code: 'X', message: 'unhandled' } }, { status: 500 }),
    );
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('recommendation hooks', () => {
  it('reloads the group profile when lastActivityAt or updatedAt moves, and only then', async () => {
    const { Wrapper } = wrapper();
    const { rerender, result } = renderHook(
      (trip: { lastActivityAt: string | null; updatedAt: string }) =>
        useGroupProfile(TRIP_ID, trip),
      { wrapper: Wrapper, initialProps: { lastActivityAt: 'a1', updatedAt: 'u1' } },
    );
    await waitFor(() => expect(result.current.data).toEqual({ ready: false, memberCount: 1 }));
    expect(callsTo(PROFILE_URL)).toBe(1);

    rerender({ lastActivityAt: 'a1', updatedAt: 'u1' });
    expect(callsTo(PROFILE_URL)).toBe(1);

    rerender({ lastActivityAt: 'a1', updatedAt: 'u2' }); // a PATCH: no activity, new cap
    await waitFor(() => expect(callsTo(PROFILE_URL)).toBe(2));
    rerender({ lastActivityAt: 'a2', updatedAt: 'u2' });
    await waitFor(() => expect(callsTo(PROFILE_URL)).toBe(3));
  });

  it('waits for the trip, then reloads the run when latestRecommendation changes', async () => {
    const { Wrapper } = wrapper();
    type Summary = Parameters<typeof useLatestRecommendation>[1];
    const { rerender } = renderHook(
      (summary: Summary) => useLatestRecommendation(TRIP_ID, summary),
      {
        wrapper: Wrapper,
        initialProps: undefined as Summary,
      },
    );
    expect(callsTo(LATEST_URL)).toBe(0);
    rerender(null);
    await waitFor(() => expect(callsTo(LATEST_URL)).toBe(1));
    const round1 = { round: 1, kind: 'diagnostic' as const, feasibleCount: 1, createdAt: 't1' };
    rerender(round1);
    await waitFor(() => expect(callsTo(LATEST_URL)).toBe(2));
    rerender(round1);
    expect(callsTo(LATEST_URL)).toBe(2);
  });

  it('a request stores the new run in the cache and reloads the trip', async () => {
    const { Wrapper, queryClient } = wrapper();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useRequestRecommendations(TRIP_ID), { wrapper: Wrapper });
    await act(() => result.current.mutateAsync());
    expect(queryClient.getQueryData(['trip', TRIP_ID, 'recommendation'])).toEqual({
      run: null,
      items: [],
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['trip', TRIP_ID] });
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/trips/${TRIP_ID}/recommendations`,
      expect.objectContaining({ method: 'POST', body: '{}' }),
    );
  });
});
