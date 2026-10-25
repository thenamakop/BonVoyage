import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TripDetail } from '@bonvoyage/shared';
import { TRIP_ID, tripDetail } from '../../test/trip-fixture';
import { TripEditPage } from './TripEditPage';

// S2-6 (0004 j): the edit page follows the server's editDetails action, so
// details stay editable until the shortlist is made.

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

function stubFetch(trip: TripDetail) {
  fetchMock.mockImplementation((url) => {
    if (url === `/api/trips/${TRIP_ID}`) return Promise.resolve(Response.json(trip));
    if (url === '/api/hubs') {
      return Promise.resolve(
        Response.json({ hubs: [{ slug: 'gurugram', name: 'Gurugram', state: 'Haryana' }] }),
      );
    }
    if (url === '/api/me') {
      return Promise.resolve(
        Response.json({
          id: 'u1',
          name: 'Asha',
          email: 'me@test.bv',
          homeHubSlug: null,
          isAdmin: false,
        }),
      );
    }
    return Promise.resolve(
      Response.json({ error: { code: 'X', message: 'unhandled' } }, { status: 500 }),
    );
  });
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: '/trips/:id/edit', element: <TripEditPage /> }], {
    initialEntries: [`/trips/${TRIP_ID}/edit`],
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('TripEditPage', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lets the organiser edit while the trip is ready for recommendation', async () => {
    stubFetch(tripDetail({ status: 'ready_for_recommendation', myRole: 'organiser' }));
    renderPage();
    expect(await screen.findByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  });

  it('explains that details are locked once the shortlist is made', async () => {
    stubFetch(tripDetail({ status: 'shortlisted', myRole: 'organiser' }));
    renderPage();
    expect(
      await screen.findByText('Trip details can be changed until the shortlist is made.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
  });

  it('tells a member that only the organiser can edit', async () => {
    stubFetch(tripDetail({ status: 'collecting_preferences', myRole: 'member' }));
    renderPage();
    expect(
      await screen.findByText('Only the organiser can edit the trip details.'),
    ).toBeInTheDocument();
  });
});
