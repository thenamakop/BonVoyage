import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TripsPage } from './TripsPage';

const TRIPS = {
  trips: [
    {
      id: 't1',
      title: 'Long weekend in the hills',
      status: 'draft',
      originHub: { slug: 'gurugram', name: 'Gurugram', state: 'Haryana' },
      durationNights: 2,
      budgetTotalInr: 30000,
      memberCount: 3,
      myRole: 'organiser',
      updatedAt: '',
    },
    {
      id: 't2',
      title: 'Beach run',
      status: 'collecting_preferences',
      originHub: { slug: 'delhi', name: 'Delhi', state: 'Delhi' },
      durationNights: 3,
      budgetTotalInr: 45000,
      memberCount: 4,
      myRole: 'member',
      updatedAt: '',
    },
  ],
};

function stubFetch(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(Response.json(body, { status }))),
  );
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: '/trips', element: <TripsPage /> }], {
    initialEntries: ['/trips'],
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('TripsPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the empty state when there are no trips', async () => {
    stubFetch({ trips: [] });
    renderPage();
    expect(await screen.findByText('No trips yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create a trip' })).toBeInTheDocument();
  });

  it('lists trips with status labels and the organiser tag', async () => {
    stubFetch(TRIPS);
    renderPage();
    expect(await screen.findByText('Long weekend in the hills')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('Collecting preferences')).toBeInTheDocument();
    expect(screen.getByText('Organiser')).toBeInTheDocument();
    expect(screen.getByText(/₹30,000 for the group/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Beach run/ })).toHaveAttribute('href', '/trips/t2');
  });

  it('separates planning from every past and finalised status', async () => {
    stubFetch({
      trips: [
        ...TRIPS.trips,
        ...['finalised', 'in_progress', 'completed', 'cancelled'].map((status) => ({
          ...TRIPS.trips[0],
          id: status,
          title: status,
          status,
        })),
      ],
    });
    renderPage();
    const planning = await screen.findByRole('region', { name: 'Planning' });
    expect(within(planning).getByText('Long weekend in the hills')).toBeInTheDocument();
    const history = screen.getByRole('region', { name: 'Past and finalised trips' });
    for (const status of ['finalised', 'in_progress', 'completed', 'cancelled']) {
      expect(within(history).getByRole('link', { name: new RegExp(status) })).toHaveAttribute(
        'href',
        `/trips/${status}`,
      );
    }
  });

  it('shows an empty state for history independently of planning', async () => {
    stubFetch(TRIPS);
    renderPage();
    expect(await screen.findByText('No past or finalised trips yet.')).toBeInTheDocument();
  });

  it('shows an error alert with Retry when loading fails', async () => {
    stubFetch({ error: { code: 'INTERNAL', message: 'x' } }, 500);
    renderPage();
    expect(await screen.findByText('Your trips could not be loaded.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
