import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePage } from './ProfilePage';

// S1-4: the /me profile page.

const ME = { id: 'u4', name: 'Kabir', email: 'kabir@test.bv', homeHubSlug: null, isAdmin: false };
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

function stubFetch(profile: Record<string, unknown>) {
  fetchMock.mockImplementation((url, init) => {
    if (url === '/api/me') return Promise.resolve(Response.json(ME));
    if (url === '/api/me/profile') return Promise.resolve(Response.json(profile));
    if (url === '/api/hubs') {
      return Promise.resolve(
        Response.json({ hubs: [{ slug: 'delhi', name: 'Delhi', state: 'Delhi' }] }),
      );
    }
    if (url === '/api/destinations') {
      return Promise.resolve(
        Response.json({
          destinations: [{ slug: 'rishikesh', name: 'Rishikesh', state: 'Uttarakhand' }],
        }),
      );
    }
    if (url === '/api/me/past-trips' && init?.method === 'POST') {
      return Promise.resolve(
        Response.json(
          { id: 'p9', destination: null, placeName: 'Chopta', visitedOn: null, rating: 4 },
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
  const router = createMemoryRouter([{ path: '/me', element: <ProfilePage /> }], {
    initialEntries: ['/me'],
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('ProfilePage', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lists past trips with the rating in words', async () => {
    stubFetch({
      homeHubSlug: 'delhi',
      pastTrips: [
        {
          id: 'p1',
          destination: { slug: 'rishikesh', name: 'Rishikesh' },
          placeName: null,
          visitedOn: '2025-03-10',
          rating: 4,
        },
      ],
    });
    renderPage();
    expect(await screen.findByText('Rishikesh', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText(/Rated 4 out of 5/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Rishikesh' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Home city')).toHaveValue('delhi');
  });

  it('"Somewhere else" reveals the place name field, which is then sent', async () => {
    stubFetch({ homeHubSlug: null, pastTrips: [] });
    const user = userEvent.setup();
    renderPage();
    const destination = await screen.findByLabelText('Destination');
    await screen.findByRole('option', { name: 'Rishikesh, Uttarakhand' });
    expect(screen.queryByLabelText('Place name')).not.toBeInTheDocument();
    await user.selectOptions(destination, 'Somewhere else');
    const place = screen.getByLabelText('Place name');
    await user.type(place, 'Chopta');
    await user.click(screen.getByRole('radio', { name: '4 out of 5' }));
    await user.click(screen.getByRole('button', { name: 'Add past trip' }));
    const post = fetchMock.mock.calls.find((c) => c[0] === '/api/me/past-trips');
    expect(JSON.parse(post?.[1]?.body as string)).toEqual({ placeName: 'Chopta', rating: 4 });
  });

  it('asks for a destination when nothing is chosen', async () => {
    stubFetch({ homeHubSlug: null, pastTrips: [] });
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText('Destination');
    await user.click(screen.getByRole('radio', { name: '3 out of 5' }));
    await user.click(screen.getByRole('button', { name: 'Add past trip' }));
    expect(
      await screen.findByText('Choose a destination, or pick "Somewhere else" and name the place.'),
    ).toBeInTheDocument();
  });
});
