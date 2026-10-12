import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TripDetail } from '@bonvoyage/shared';
import { TRIP_ID, member, tripDetail } from '../../test/trip-fixture';
import { TripPage } from './TripPage';

// S1-3: the invite panel and the roster on /trips/:id (now the S1-5 dashboard).

const TOKEN = 'abcdefghijklmnopqrstuvwxyz012345';

// Asha organises; Rohan and Meera are active; Dev was removed.
const MEMBERS = [
  member('u1', 'Asha', { role: 'organiser' }),
  member('u2', 'Rohan'),
  member('u3', 'Meera'),
  member('u4', 'Dev', { status: 'excluded' }),
];
const detail = (overrides: Partial<TripDetail> = {}) =>
  tripDetail({ members: MEMBERS, ...overrides });

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

function stubFetch(trip: TripDetail, meId = trip.myRole === 'organiser' ? 'u1' : 'u2') {
  fetchMock.mockImplementation((url, init) => {
    if (url === `/api/trips/${TRIP_ID}`) return Promise.resolve(Response.json(trip));
    if (url === '/api/me') {
      return Promise.resolve(
        Response.json({
          id: meId,
          name: 'Me',
          email: 'me@test.bv',
          homeHubSlug: null,
          isAdmin: false,
        }),
      );
    }
    if (url === `/api/trips/${TRIP_ID}/activity`) {
      return Promise.resolve(Response.json({ items: [] }));
    }
    if (url === `/api/trips/${TRIP_ID}/invitations/active`) {
      return Promise.resolve(
        Response.json({
          invitation: { token: TOKEN, status: 'active', expiresAt: '2026-10-27T06:00:00.000Z' },
        }),
      );
    }
    if (url === `/api/trips/${TRIP_ID}/invitations` && init?.method === 'POST') {
      return Promise.resolve(
        Response.json(
          { token: TOKEN, status: 'active', expiresAt: '2026-10-27T06:00:00.000Z' },
          { status: 201 },
        ),
      );
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
      { path: '/trips/:id', element: <TripPage /> },
      { path: '/trips', element: <p>Trips list</p> },
    ],
    { initialEntries: [`/trips/${TRIP_ID}`] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe('TripPage invite panel', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('Copy writes the full join URL to the clipboard and announces "Link copied"', async () => {
    stubFetch(detail());
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    renderPage();
    const url = `${window.location.origin}/join/${TOKEN}`;
    expect(await screen.findByLabelText('Invite link')).toHaveValue(url);
    expect(screen.getByText('Expires 27 Oct 2026')).toBeInTheDocument();
    expect(screen.getAllByText('3 of 8 members').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith(url);
    expect(await screen.findByRole('status')).toHaveTextContent('Link copied');
  });

  it('in draft, explains the link and creates it on click', async () => {
    stubFetch(detail({ status: 'draft', members: [member('u1', 'Asha', { role: 'organiser' })] }));
    const user = userEvent.setup();
    renderPage();
    expect(
      await screen.findByText(/Creating the link opens the trip for preferences/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create invite link' }));
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/trips/${TRIP_ID}/invitations`,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('is hidden from a member', async () => {
    stubFetch(detail({ myRole: 'member' }));
    renderPage();
    await screen.findByText('Rohan');
    expect(screen.queryByText('Invite people')).not.toBeInTheDocument();
  });
});

describe('TripPage roster', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('the organiser sees Remove with an inline confirm; removed members are listed apart', async () => {
    stubFetch(detail());
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Remove Rohan' }));
    expect(
      screen.getByText('Remove Rohan? Their preferences will be deleted.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove Asha' })).not.toBeInTheDocument();
    const removedHeading = screen.getByRole('heading', { name: 'Removed' });
    const removedList = removedHeading.nextElementSibling as HTMLElement;
    expect(within(removedList).getByText('Dev')).toBeInTheDocument();
  });

  it('a member sees no Remove button, and Leave trip asks first', async () => {
    stubFetch(detail({ myRole: 'member' }));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Rohan');
    expect(screen.queryByRole('button', { name: /^Remove/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Leave trip' }));
    expect(
      screen.getByText('Leave this trip? Your preferences will be deleted.'),
    ).toBeInTheDocument();
  });

  it('a removed member is told the trip is read-only', async () => {
    stubFetch(detail({ myRole: 'member', myStatus: 'excluded' }));
    renderPage();
    expect(
      await screen.findByText('You were removed from this trip, so you can only view it.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Leave trip' })).not.toBeInTheDocument();
  });
});
