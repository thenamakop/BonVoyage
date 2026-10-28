import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, useMe } from './api';

// clearSession (sign-out and account deletion): a header that stays mounted
// must stop showing the old user, and no user-scoped data may survive.

const fetchMock = vi.fn<(url: string) => Promise<Response>>();
const ME = { id: 'u1', name: 'Asha', email: 'a@test.bv', homeHubSlug: null, isAdmin: false };

function Header() {
  const me = useMe();
  return <p>{me.data ? `Signed in as ${me.data.name}` : 'Signed out'}</p>;
}

describe('clearSession', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('signs a mounted header out and drops user-scoped queries', async () => {
    fetchMock.mockResolvedValueOnce(Response.json(ME));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['me', 'profile'], { homeHubSlug: null, pastTrips: [] });
    queryClient.setQueryData(['trips'], { trips: [] });
    render(
      <QueryClientProvider client={queryClient}>
        <Header />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Signed in as Asha')).toBeInTheDocument();

    // The server session is gone: /api/me now answers 401.
    fetchMock.mockResolvedValue(
      Response.json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in.' } }, { status: 401 }),
    );
    act(() => clearSession(queryClient));

    expect(await screen.findByText('Signed out')).toBeInTheDocument();
    expect(queryClient.getQueryData(['me', 'profile'])).toBeUndefined();
    expect(queryClient.getQueryData(['trips'])).toBeUndefined();
    expect(queryClient.getQueryData(['me'])).toBeNull();
  });
});
