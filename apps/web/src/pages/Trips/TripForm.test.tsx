import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TripNewPage } from './TripNewPage';

const HUBS = { hubs: [{ slug: 'delhi', name: 'Delhi', state: 'Delhi' }] };
const ME = { id: 'u1', name: 'Kabir', email: 'k@test.bv', homeHubSlug: 'delhi' };
const DETAIL = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Test weekend',
  status: 'draft',
  originHub: { slug: 'delhi', name: 'Delhi', state: 'Delhi' },
  durationNights: 2,
  budgetTotalInr: 30000,
  radiusKm: 300,
  startDate: null,
  endDate: null,
  organiser: { userId: 'u1', name: 'Kabir' },
  members: [
    {
      userId: 'u1',
      name: 'Kabir',
      role: 'organiser',
      status: 'active',
      submitted: false,
      joinedAt: '',
    },
  ],
  myRole: 'organiser',
  myStatus: 'active',
  legalEvents: ['inviteMembers', 'cancelTrip'],
  createdAt: '',
  updatedAt: '',
};

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

function stubFetch(overrides: Record<string, () => Response> = {}) {
  fetchMock.mockImplementation((url, init) => {
    const u = typeof url === 'string' ? url : '';
    if (u === '/api/me') return Promise.resolve(Response.json(ME));
    if (u === '/api/hubs') return Promise.resolve(Response.json(HUBS));
    if (u === '/api/trips' && init?.method === 'POST') {
      return Promise.resolve(overrides.post?.() ?? Response.json(DETAIL, { status: 201 }));
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
      { path: '/trips/new', element: <TripNewPage /> },
      { path: '/trips/:id', element: <p>Trip page</p> },
    ],
    { initialEntries: ['/trips/new'] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Trip title'), 'Test weekend');
  await user.selectOptions(screen.getByLabelText('Starting city'), 'delhi');
  await user.type(screen.getByLabelText('Nights'), '2');
  await user.type(screen.getByLabelText('Group budget (₹)'), '30000');
  await user.type(screen.getByLabelText('Search radius (km)'), '300');
}

describe('TripForm', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    stubFetch();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows "Choose between 1 and 14 nights." for 15 and sends nothing', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Trip title'), 'Test weekend');
    await user.selectOptions(screen.getByLabelText('Starting city'), 'delhi');
    await user.type(screen.getByLabelText('Nights'), '15');
    await user.type(screen.getByLabelText('Group budget (₹)'), '30000');
    await user.type(screen.getByLabelText('Search radius (km)'), '300');
    await user.click(screen.getByRole('button', { name: 'Create trip' }));
    expect(await screen.findByText('Choose between 1 and 14 nights.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/trips',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('preselects the home hub, shows the live budget line and navigates to /trips/<id>', async () => {
    const user = userEvent.setup();
    const router = renderPage();
    await waitFor(() => expect(screen.getByLabelText('Starting city')).toHaveValue('delhi'));
    await user.type(screen.getByLabelText('Trip title'), 'Test weekend');
    await user.type(screen.getByLabelText('Nights'), '2');
    expect(screen.getByText('Total for the whole group, for the whole trip')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Group budget (₹)'), '30000');
    expect(screen.getByText('₹30,000 for the group')).toBeInTheDocument();
    expect(screen.getByText('Total for the whole group, for the whole trip')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Search radius (km)'), '300');
    await user.click(screen.getByRole('button', { name: 'Create trip' }));
    expect(await screen.findByText('Trip page')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/trips/${DETAIL.id}`);
    const post = fetchMock.mock.calls.find((c) => c[0] === '/api/trips');
    expect(JSON.parse(post?.[1]?.body as string)).toEqual({
      title: 'Test weekend',
      originHubSlug: 'delhi',
      durationNights: 2,
      budgetTotalInr: 30000,
      radiusKm: 300,
    });
  });

  it('maps a server 400 field error under the input and keeps the other values', async () => {
    stubFetch({
      post: () =>
        Response.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Some fields are invalid.',
              fields: { radiusKm: 'Radius must be at least 50 km.' },
            },
          },
          { status: 400 },
        ),
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('Starting city')).toHaveValue('delhi'));
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Create trip' }));
    expect(await screen.findByText('Radius must be at least 50 km.')).toBeInTheDocument();
    expect(screen.getByLabelText('Trip title')).toHaveValue('Test weekend');
    expect(screen.getByLabelText('Group budget (₹)')).toHaveValue('30000');
    expect(screen.getByLabelText('Nights')).toHaveValue('2');
  });
});
