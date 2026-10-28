import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, expect, it, vi } from 'vitest';
import type { ItineraryView, TripDetail } from '@bonvoyage/shared';
import { tripDetail, TRIP_ID } from '../../../test/trip-fixture';
import { ItineraryPage } from './ItineraryPage';
import { NextStep } from '../dashboard/NextStep';

const URL = `/api/trips/${TRIP_ID}`;
const view: ItineraryView = {
  id: 'i1',
  version: 1,
  status: 'proposed',
  model: 'catalogue-planner',
  source: 'catalogue',
  generatedAt: '2026-11-13T00:00:00Z',
  summary: 'A grounded plan.',
  reasons: ['From catalogue facts.'],
  packageLabel: 'Saver',
  legs: [{ id: 'onward', mode: 'car', depart: '06:00', arrive: '10:00', plannedTimes: true }],
  days: [
    {
      day: 1,
      date: '2026-11-13',
      items: [
        {
          id: 'travel',
          day: 1,
          position: 0,
          start: '06:00',
          end: '10:00',
          kind: 'travel',
          place: null,
          legId: 'onward',
          note: 'Onward journey.',
          verified: true,
          unverifiedReason: null,
        },
        {
          id: 'poi',
          day: 1,
          position: 1,
          start: '11:00',
          end: '12:00',
          kind: 'activity',
          place: {
            key: 'chakrata/tiger',
            name: 'Tiger Falls',
            category: 'nature',
            entryFeeInr: 50,
          },
          legId: null,
          note: 'Visit Tiger Falls.',
          verified: false,
          unverifiedReason: 'Details not verified yet.',
        },
      ],
    },
  ],
};
const proposed = (over: Partial<TripDetail> = {}) =>
  tripDetail({
    status: 'itinerary_proposed',
    selectedDestination: { slug: 'chakrata', name: 'Chakrata', state: 'Uttarakhand' },
    latestItinerary: { version: 1, status: 'proposed' },
    availableActions: [
      { action: 'viewItinerary', enabled: true },
      { action: 'acceptItinerary', enabled: true },
      { action: 'rejectItinerary', enabled: true },
    ],
    ...over,
  });
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});
function setup(trip = proposed(), plan = view, dashboard = false) {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockImplementation((url) =>
    Promise.resolve(Response.json(url.endsWith('/itinerary') ? { itinerary: plan } : trip)),
  );
  const router = createMemoryRouter(
    [
      { path: '/trips/:id/itinerary', element: <ItineraryPage /> },
      {
        path: '/trips/:id',
        element: dashboard ? <NextStep trip={trip} myUserId="u1" /> : <p>Dashboard</p>,
      },
    ],
    { initialEntries: [`/trips/${TRIP_ID}${dashboard ? '' : '/itinerary'}`] },
  );
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

it('renders API dates, kinds, fees, planned legs, notes and verification badges', async () => {
  setup();
  expect(await screen.findByText('Saver package · version 1')).toBeInTheDocument();
  expect(screen.getByText('Planned from the BonVoyage catalogue')).toBeInTheDocument();
  expect(screen.getByText('Travel times are planned, not a timetable.')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /Day 1 · 13 Nov 2026/ })).toBeInTheDocument();
  expect(screen.getByText('06:00–10:00 · Travel · Onward')).toBeInTheDocument();
  expect(
    screen.getByText(/Tiger Falls · Nature · Entry ₹50 per person \(estimate\)/),
  ).toBeInTheDocument();
  expect(screen.getByText('Verified')).toBeInTheDocument();
  expect(screen.getByText('Not verified: Details not verified yet.')).toBeInTheDocument();
});

it('shows "Free entry" for a zero-fee place and keeps its note visible', async () => {
  const free: ItineraryView = {
    ...view,
    days: [
      {
        ...view.days[0]!,
        items: [
          {
            ...view.days[0]!.items[1]!,
            id: 'poi-free',
            place: {
              key: 'chakrata/park',
              name: 'Deoban Park',
              category: 'nature',
              entryFeeInr: 0,
            },
            note: 'Visit Deoban Park (nature).',
          },
        ],
      },
    ],
  };
  setup(proposed(), free);
  expect(await screen.findByText('Deoban Park · Nature · Free entry')).toBeInTheDocument();
  expect(screen.getByText('Visit Deoban Park (nature).')).toBeInTheDocument();
});
it.each(['member', 'excluded'] as const)(
  '%s can read but sees no decision or adjustment buttons',
  async (role) => {
    setup(
      proposed({
        myRole: 'member',
        myStatus: role === 'excluded' ? 'excluded' : 'active',
        availableActions: [{ action: 'viewItinerary', enabled: true }],
      }),
    );
    await screen.findByText('Saver package · version 1');
    for (const name of ['Accept this plan', 'Reject and plan again', 'Remove', 'Swap'])
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    expect(screen.getByText('Waiting for Asha to accept the plan.')).toBeInTheDocument();
  },
);
it('Remove and Swap use only the API alternatives and send JSON changes', async () => {
  setup(
    proposed({
      availableActions: [
        { action: 'viewItinerary', enabled: true },
        { action: 'modifyItinerary', enabled: true },
      ],
    }),
  );
  fetchMock.mockImplementation((url, init) => {
    if (url.endsWith('/alternatives'))
      return Promise.resolve(
        Response.json({
          places: [{ key: 'chakrata/forest', name: 'Forest', category: 'nature', entryFeeInr: 10 }],
        }),
      );
    if (init?.method === 'PATCH') return Promise.resolve(Response.json({ itinerary: view }));
    return Promise.resolve(
      Response.json(
        url.endsWith('/itinerary')
          ? { itinerary: view }
          : proposed({
              availableActions: [
                { action: 'viewItinerary', enabled: true },
                { action: 'modifyItinerary', enabled: true },
              ],
            }),
      ),
    );
  });
  await userEvent.click(await screen.findByRole('button', { name: 'Swap' }));
  await userEvent.click(
    await screen.findByRole('button', {
      name: 'Forest · Nature · Entry ₹10 per person (estimate)',
    }),
  );
  expect(fetchMock).toHaveBeenCalledWith(
    `${URL}/itinerary/items/poi`,
    expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ action: 'replace', placeKey: 'chakrata/forest' }),
      headers: { 'content-type': 'application/json' },
    }),
  );
  await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));
  expect(fetchMock).toHaveBeenCalledWith(
    `${URL}/itinerary/items/poi`,
    expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ action: 'remove' }) }),
  );
});

it('an adjustment error shows the API message and keeps the plan', async () => {
  const trip = proposed({ availableActions: [{ action: 'modifyItinerary', enabled: true }] });
  setup(trip);
  fetchMock.mockImplementation((url, init) =>
    Promise.resolve(
      init?.method === 'PATCH'
        ? Response.json(
            {
              error: { code: 'PLACE_DOES_NOT_FIT', message: 'That place does not fit this visit.' },
            },
            { status: 422 },
          )
        : Response.json(url.endsWith('/itinerary') ? { itinerary: view } : trip),
    ),
  );
  await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('That place does not fit this visit.');
  expect(screen.getByText('Saver package · version 1')).toBeInTheDocument();
});

it('shows model provenance', async () => {
  setup(proposed(), { ...view, source: 'model', model: 'fixture' });
  expect(await screen.findByText('Written with fixture from catalogue facts')).toBeInTheDocument();
});
it.each(['accept', 'reject'] as const)(
  '%s confirms then sends JSON and returns to dashboard',
  async (decision) => {
    setup();
    await userEvent.click(
      await screen.findByRole('button', {
        name: decision === 'accept' ? 'Accept this plan' : 'Reject and plan again',
      }),
    );
    expect(
      screen.getByText(
        decision === 'accept'
          ? 'Accept this plan? The trip is finalised.'
          : 'Reject this plan? You can plan the days again.',
      ),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: decision === 'accept' ? 'Accept plan' : 'Reject plan' }),
    );
    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      `${URL}/itinerary/${decision}`,
      expect.objectContaining({
        method: 'POST',
        body: '{}',
        headers: { 'content-type': 'application/json' },
      }),
    );
  },
);
it('planning shows a spinner/status until completion and opens the plan', async () => {
  setup(
    proposed({
      status: 'package_selected',
      selectedPackage: { id: 'p1', label: 'Saver', totalInr: 15600, perPersonInr: 5200 },
      availableActions: [{ action: 'planDays', enabled: true }],
    }),
    view,
    true,
  );
  let finish: (response: Response) => void = () => {};
  fetchMock.mockImplementation((url, init) =>
    init?.method === 'POST'
      ? new Promise<Response>((resolve) => {
          finish = resolve;
        })
      : Promise.resolve(
          Response.json(url.endsWith('/itinerary') ? { itinerary: view } : proposed()),
        ),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Plan the days' }));
  expect(screen.getByText('Planning the days. This can take up to 30 seconds.')).toHaveAttribute(
    'role',
    'status',
  );
  act(() => {
    finish(Response.json({ itinerary: view }));
  });
  expect(await screen.findByText('Saver package · version 1')).toBeInTheDocument();
});
it.each([409, 500])('planning displays the API error at status %s', async (status) => {
  setup(
    proposed({
      status: 'package_selected',
      selectedPackage: { id: 'p1', label: 'Saver', totalInr: 15600, perPersonInr: 5200 },
      availableActions: [{ action: 'planDays', enabled: true }],
    }),
    view,
    true,
  );
  const message =
    status === 409
      ? 'The package changed while planning. Try again.'
      : 'We could not plan these days. Try again.';
  fetchMock.mockResolvedValue(
    Response.json(
      { error: { code: status === 409 ? 'ITINERARY_STALE' : 'INTERNAL', message } },
      { status },
    ),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Plan the days' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(message);
});
it('finalised dashboard shows API figures, dates, step and plan link without plan action', async () => {
  setup(
    proposed({
      status: 'finalised',
      startDate: null,
      endDate: null,
      selectedPackage: { id: 'p1', label: 'Saver', totalInr: 15600, perPersonInr: 5200 },
      availableActions: [{ action: 'viewItinerary', enabled: true }],
    }),
    { ...view, days: [...view.days, { day: 3, date: '2026-11-15', items: [] }] },
    true,
  );
  expect(
    await screen.findByText(
      /Trip finalised: Chakrata, 13 Nov 2026 – 15 Nov 2026, Saver package, ₹15,600 for the group, about ₹5,200 each \(estimate\)/,
    ),
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'See the day plan' })).toHaveAttribute(
    'href',
    `/trips/${TRIP_ID}/itinerary`,
  );
  expect(screen.queryByRole('button', { name: 'Plan the days' })).not.toBeInTheDocument();
});
