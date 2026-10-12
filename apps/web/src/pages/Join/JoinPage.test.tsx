import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JoinPage } from './JoinPage';

const TOKEN = 'abcdefghijklmnopqrstuvwxyz012345';
const TRIP_ID = '11111111-1111-4111-8111-111111111111';
const ME = { id: 'u2', name: 'Rohan', email: 'r@test.bv', homeHubSlug: null };
const PREVIEW = {
  tripTitle: 'Long weekend in the hills',
  organiserName: 'Asha',
  memberCount: 3,
  maxMembers: 8,
  state: 'open',
  alreadyMember: false,
};

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

function stubFetch({
  signedIn = true,
  preview = () => Response.json(PREVIEW),
}: { signedIn?: boolean; preview?: () => Response } = {}) {
  fetchMock.mockImplementation((url, init) => {
    if (url === '/api/me') {
      return Promise.resolve(
        signedIn
          ? Response.json(ME)
          : Response.json(
              { error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' } },
              { status: 401 },
            ),
      );
    }
    if (url === `/api/invitations/${TOKEN}`) return Promise.resolve(preview());
    if (url === `/api/invitations/${TOKEN}/accept` && init?.method === 'POST') {
      return Promise.resolve(Response.json({ tripId: TRIP_ID }));
    }
    return Promise.resolve(
      Response.json({ error: { code: 'X', message: 'unhandled' } }, { status: 500 }),
    );
  });
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: '/join/:token', element: <JoinPage /> },
      { path: '/trips/:id', element: <p>Trip page</p> },
    ],
    { initialEntries: [`/join/${TOKEN}`] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe('JoinPage', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('signed out: shows the preview and sign-in and sign-up links that come back here', async () => {
    stubFetch({ signedIn: false });
    renderPage();
    expect(await screen.findByText('Long weekend in the hills')).toBeInTheDocument();
    expect(screen.getByText('Asha invited you')).toBeInTheDocument();
    expect(screen.getByText('3 of 8 members')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in to join' })).toHaveAttribute(
      'href',
      `/sign-in?next=%2Fjoin%2F${TOKEN}`,
    );
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      `/sign-up?next=%2Fjoin%2F${TOKEN}`,
    );
    expect(screen.queryByRole('button', { name: 'Join the trip' })).not.toBeInTheDocument();
  });

  it('signed in: Join accepts and navigates to the trip', async () => {
    stubFetch();
    const user = userEvent.setup();
    const router = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Join the trip' }));
    expect(await screen.findByText('Trip page')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/trips/${TRIP_ID}`);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/invitations/${TOKEN}/accept`,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('an expired link shows its sentence and no Join button', async () => {
    stubFetch({ preview: () => Response.json({ ...PREVIEW, state: 'expired' }) });
    renderPage();
    expect(
      await screen.findByText('This link has expired. Ask the organiser for a new one.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Join the trip' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to your trips' })).toHaveAttribute(
      'href',
      '/trips',
    );
  });

  it('an unknown token says the link is not valid', async () => {
    stubFetch({
      preview: () =>
        Response.json(
          { error: { code: 'NOT_FOUND', message: 'This invitation link is not valid.' } },
          { status: 404 },
        ),
    });
    renderPage();
    expect(await screen.findByText('This invitation link is not valid.')).toBeInTheDocument();
  });

  it('an existing member is told so instead of being offered Join', async () => {
    stubFetch({ preview: () => Response.json({ ...PREVIEW, alreadyMember: true }) });
    renderPage();
    expect(await screen.findByText('You are already in this trip.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open trip' })).toBeInTheDocument();
  });
});
