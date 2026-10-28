import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LandingPage } from './LandingPage';

// The home page, and the one-off notice handed over in router state (#54).

const NOTICE = 'Your account has been deleted.';
const fetchMock = vi.fn<(url: string) => Promise<Response>>();

function signedIn(yes: boolean) {
  fetchMock.mockImplementation(() =>
    Promise.resolve(
      yes
        ? Response.json({
            id: 'u1',
            name: 'Asha',
            email: 'a@test.bv',
            homeHubSlug: null,
            isAdmin: false,
          })
        : Response.json(
            { error: { code: 'UNAUTHENTICATED', message: 'Sign in.' } },
            { status: 401 },
          ),
    ),
  );
}

function renderAt(entry: string | { pathname: string; state: unknown }) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <LandingPage /> },
      { path: '/trips', element: <p>trips page</p> },
    ],
    { initialEntries: [entry] },
  );
  const view = render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, ...view };
}

describe('LandingPage', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows the notice once in a status region and drops it from history', async () => {
    signedIn(false);
    const { router, unmount } = renderAt({ pathname: '/', state: { notice: NOTICE } });
    expect(await screen.findByRole('status')).toHaveTextContent(NOTICE);
    // The history entry no longer carries it, so a reload has nothing to show.
    await waitFor(() => expect(router.state.location.state).toBeNull());
    expect(screen.getByRole('status')).toHaveTextContent(NOTICE);
    const reloaded = router.state.location;
    unmount();

    renderAt({ pathname: reloaded.pathname, state: reloaded.state });
    expect(
      await screen.findByRole('heading', { name: 'Group trips, decided together.' }),
    ).toBeVisible();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });

  it('shows no notice without one, and ignores a state that is not a notice', async () => {
    signedIn(false);
    renderAt({ pathname: '/', state: { notice: 42 } });
    expect(
      await screen.findByRole('heading', { name: 'Group trips, decided together.' }),
    ).toBeVisible();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('sends a signed-in user to their trips', async () => {
    signedIn(true);
    renderAt('/');
    expect(await screen.findByText('trips page')).toBeInTheDocument();
  });
});
