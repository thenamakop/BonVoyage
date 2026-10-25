import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LatestRecommendationResponse, TripDetail } from '@bonvoyage/shared';
import {
  diagnosticRun,
  item,
  latest,
  profileReady,
  run,
  summaryOf,
} from '../../../test/recommendation-fixture';
import { TRIP_ID, member, tripDetail } from '../../../test/trip-fixture';
import { ShortlistPage } from './ShortlistPage';

// S2-7 step 3 and 5: the shortlist (wireframe 07) and the diagnostic
// (wireframe 08), as organiser and as member.

const TRIP_URL = `/api/trips/${TRIP_ID}`;
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

const MEMBERS = [
  member('u1', 'Asha', { role: 'organiser', submitted: true }),
  member('u2', 'Rohan', { submitted: true }),
  member('u3', 'Meera', { submitted: true }),
];

interface Stub {
  trip: TripDetail;
  response: LatestRecommendationResponse;
  patch?: Response;
  choose?: Response;
}

function stubFetch({ trip, response, patch, choose }: Stub) {
  fetchMock.mockImplementation((url, init) => {
    if (url === TRIP_URL && !init?.method) return Promise.resolve(Response.json(trip));
    if (url === TRIP_URL && init?.method === 'PATCH') {
      return Promise.resolve(patch ?? Response.json(trip));
    }
    if (url === `${TRIP_URL}/recommendations/latest`) {
      return Promise.resolve(Response.json(response));
    }
    if (url === `${TRIP_URL}/destination` && init?.method === 'POST') {
      return Promise.resolve(choose ?? Response.json(trip));
    }
    if (url === '/api/destinations') {
      return Promise.resolve(
        Response.json({
          destinations: [{ slug: 'auli', name: 'Auli', state: 'Uttarakhand' }],
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
  const router = createMemoryRouter(
    [
      { path: '/trips/:id/shortlist', element: <ShortlistPage /> },
      { path: '/trips/:id', element: <p>Dashboard page</p> },
    ],
    { initialEntries: [`/trips/${TRIP_ID}/shortlist`] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const shortlisted = (over: Partial<TripDetail> = {}, r = run()) =>
  tripDetail({
    status: 'shortlisted',
    members: MEMBERS,
    latestRecommendation: summaryOf(r),
    ...over,
  });
const collecting = (r: ReturnType<typeof run>, over: Partial<TripDetail> = {}) =>
  tripDetail({ members: MEMBERS, latestRecommendation: summaryOf(r), ...over });
const cards = () => screen.getAllByRole('article');

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('shortlist view', () => {
  it('says so when there is no run yet', async () => {
    stubFetch({ trip: tripDetail({ members: MEMBERS }), response: latest(null) });
    renderPage();
    expect(await screen.findByText('No recommendations yet.')).toBeInTheDocument();
  });

  it('shows the first 5 ranked cards, then all of them', async () => {
    const items = [1, 2, 3, 4, 5, 6, 7].map((rank) => item(rank));
    stubFetch({ trip: shortlisted(), response: latest(run({ feasibleCount: 7 }), items) });
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole('heading', { name: '1. Place 1' })).toBeInTheDocument();
    expect(cards()).toHaveLength(5);
    await user.click(screen.getByRole('button', { name: 'Show all 7' }));
    expect(cards()).toHaveLength(7);
    expect(screen.queryByRole('button', { name: /Show all/ })).not.toBeInTheDocument();
  });

  it('words each card from the API: distance, cost, group, climate, shared and For you', async () => {
    stubFetch({
      trip: shortlisted(),
      response: latest(run(), [item(1, { distanceProvenance: 'curated' })]),
    });
    renderPage();
    const card = within(await screen.findByRole('article'));
    expect(card.getByText('Uttarakhand')).toBeInTheDocument();
    expect(card.getByText('250 km, curated road distance')).toBeInTheDocument();
    expect(
      card.getByText('₹27,000 for the group, about ₹9,000 each, estimate, cheapest by train'),
    ).toBeInTheDocument();
    expect(card.getByText('Everyone rates this at least 6 out of 10')).toBeInTheDocument();
    expect(card.getByText('Climate suits 2 of 3')).toBeInTheDocument();
    expect(card.getByText('Shared: mountain (3), rafting (2)')).toBeInTheDocument();
    expect(
      card.getByText('For you: 7.5 out of 10. Matches mountain, trekking. Misses rafting.'),
    ).toBeInTheDocument();
    // Never the raw figures.
    expect(screen.queryByText(/0\.4|0\.49/)).not.toBeInTheDocument();
  });

  it('leaves out the score sentence below 3 members and For you for anyone not in the run', async () => {
    const twoMembers = item(1, {
      group: { ...item(1).group, memberCount: 2, lowestScore10: null, highestScore10: null },
      mine: null,
    });
    stubFetch({
      trip: shortlisted({ myStatus: 'excluded', myRole: 'member' }),
      response: latest(run({ memberCount: 2 }), [twoMembers]),
    });
    renderPage();
    const card = within(await screen.findByRole('article'));
    expect(card.getByText('Climate suits 2 of 2')).toBeInTheDocument();
    expect(card.queryByText(/out of 10/)).not.toBeInTheDocument();
    expect(card.queryByText(/For you/)).not.toBeInTheDocument();
    expect(card.queryByRole('button', { name: 'Choose' })).not.toBeInTheDocument();
  });

  it('shows the weak-match alert and the round number', async () => {
    stubFetch({
      trip: shortlisted(),
      response: latest(run({ weakMatch: true, round: 2 }), [item(1), item(2), item(3)]),
    });
    renderPage();
    expect(
      await screen.findByText(
        'These are the closest options; none match the types the group asked for well.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Round 2')).toBeInTheDocument();
  });

  it('lists destinations not considered, by name, falling back to the slug', async () => {
    stubFetch({
      trip: shortlisted(),
      response: latest(run({ incomplete: ['auli', 'unnamed-place'] }), [item(1)]),
    });
    renderPage();
    expect(await screen.findByText('Not considered (2)')).toBeInTheDocument();
    expect(await screen.findByText('Auli')).toBeInTheDocument();
    expect(screen.getByText('unnamed-place')).toBeInTheDocument();
  });

  it('a member has no Choose button', async () => {
    stubFetch({
      trip: shortlisted({ myRole: 'member' }),
      response: latest(run(), [item(1), item(2), item(3)]),
    });
    renderPage();
    await screen.findByRole('heading', { name: '1. Place 1' });
    expect(screen.queryByRole('button', { name: 'Choose' })).not.toBeInTheDocument();
  });

  it('the organiser confirms the choice inline, posts the slug and goes to the dashboard', async () => {
    stubFetch({ trip: shortlisted(), response: latest(run(), [item(1), item(2), item(3)]) });
    const user = userEvent.setup();
    renderPage();
    const first = within((await screen.findAllByRole('article'))[0]!);
    await user.click(first.getByRole('button', { name: 'Choose' }));
    expect(first.getByText('Choose Place 1? The group moves on to packages.')).toBeInTheDocument();
    await user.click(first.getByRole('button', { name: 'Choose Place 1' }));
    expect(fetchMock).toHaveBeenCalledWith(
      `${TRIP_URL}/destination`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ destinationSlug: 'place-1' }),
      }),
    );
    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
  });

  it('a refused choice shows the server message as sent', async () => {
    stubFetch({
      trip: shortlisted(),
      response: latest(run(), [item(1)]),
      choose: Response.json(
        {
          error: {
            code: 'DESTINATION_NOT_IN_SHORTLIST',
            message: 'Choose a destination from the shortlist.',
          },
        },
        { status: 422 },
      ),
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Choose' }));
    await user.click(screen.getByRole('button', { name: 'Choose Place 1' }));
    expect(await screen.findByText('Choose a destination from the shortlist.')).toBeInTheDocument();
  });
});

describe('diagnostic view', () => {
  it('states the fit, the binding limit, the closest misses and the destinations that fit', async () => {
    const r = diagnosticRun();
    stubFetch({ trip: collecting(r), response: latest(r, [item(1)]) });
    renderPage();
    expect(
      await screen.findByRole('heading', { name: 'Only 1 destination fits' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Most places are just beyond your search radius.')).toBeInTheDocument();
    expect(screen.getByText('Alwar: 40 km beyond the radius')).toBeInTheDocument();
    expect(screen.getByText('Vrindavan: 40 km beyond the radius')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '1. Place 1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Choose' })).not.toBeInTheDocument();
  });

  it('the organiser’s suggestion PATCHes the radius, then offers Mark ready again', async () => {
    const r = diagnosticRun();
    stubFetch({ trip: collecting(r), response: latest(r, [item(1)]) });
    const user = userEvent.setup();
    renderPage();
    const button = await screen.findByRole('button', { name: 'Widen the radius to 500 km' });
    expect(screen.getByText('This adds Alwar and Vrindavan.')).toBeInTheDocument();
    await user.click(button);
    expect(fetchMock).toHaveBeenCalledWith(
      TRIP_URL,
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ radiusKm: 500 }) }),
    );
    expect(
      await screen.findByText('Saved. Now mark the trip ready again and get recommendations.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark ready again' })).toBeInTheDocument();
  });

  it('PATCHes nights and a trip budget with the exact fields', async () => {
    const r = diagnosticRun({
      bindingConstraint: 'F5',
      diagnostic: {
        ...diagnosticRun().diagnostic!,
        suggestions: [
          { constraint: 'F2', newNights: 3, unlocks: ['alwar'] },
          { constraint: 'F5', newGroupCapInr: 54000, capSource: 'trip', unlocks: ['vrindavan'] },
        ],
      },
    });
    stubFetch({ trip: collecting(r), response: latest(r, [item(1)]) });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Make the trip 3 nights' }));
    await user.click(screen.getByRole('button', { name: 'Raise the group budget to ₹54,000' }));
    const bodies = fetchMock.mock.calls
      .filter(([, init]) => init?.method === 'PATCH')
      .map(([, init]) => init?.body);
    expect(bodies).toEqual([
      JSON.stringify({ durationNights: 3 }),
      JSON.stringify({ budgetTotalInr: 54000 }),
    ]);
  });

  it('a 400 shows the server’s field message', async () => {
    const r = diagnosticRun({
      diagnostic: {
        ...diagnosticRun().diagnostic!,
        suggestions: [{ constraint: 'F1', newRadiusKm: 1600, unlocks: ['alwar'] }],
      },
    });
    stubFetch({
      trip: collecting(r),
      response: latest(r, [item(1)]),
      patch: Response.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Some fields are invalid.',
            fields: { radiusKm: 'Radius can be at most 1,500 km.' },
          },
        },
        { status: 400 },
      ),
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Widen the radius to 1600 km' }));
    expect(await screen.findByText('Radius can be at most 1,500 km.')).toBeInTheDocument();
  });

  it('members see the suggestions as text and a link to their preferences', async () => {
    const r = diagnosticRun();
    stubFetch({ trip: collecting(r, { myRole: 'member' }), response: latest(r, [item(1)]) });
    renderPage();
    expect(
      await screen.findByText('Widen the radius to 500 km', { exact: false }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Widen the radius/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit your preferences' })).toHaveAttribute(
      'href',
      `/trips/${TRIP_ID}/preferences`,
    );
  });

  it('members’ maxima and season shifts are text even for the organiser', async () => {
    const r = diagnosticRun({
      bindingConstraint: 'F5',
      diagnostic: {
        ...diagnosticRun().diagnostic!,
        suggestions: [
          { constraint: 'F4', shiftMonths: 1, unlocks: ['alwar'] },
          {
            constraint: 'F5',
            newGroupCapInr: 54000,
            capSource: 'members',
            newPerPersonMaxInr: 18000,
            unlocks: ['vrindavan'],
          },
        ],
      },
    });
    stubFetch({ trip: collecting(r), response: latest(r) });
    renderPage();
    expect(
      await screen.findByText('Shift the dates by 1 month', { exact: false }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Members need to raise their maximum to ₹18,000 per person', {
        exact: false,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Shift|Members need/ })).not.toBeInTheDocument();
  });

  it('with no binding constraint, says several limits are missed and suggests nothing', async () => {
    const r = diagnosticRun({ bindingConstraint: null, feasibleCount: 0 });
    stubFetch({ trip: collecting(r), response: latest(r) });
    renderPage();
    expect(await screen.findByText('Most places miss more than one limit.')).toBeInTheDocument();
    expect(screen.queryByText('Try one of these changes:')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Widen/ })).not.toBeInTheDocument();
  });

  it('a date clash (F3) uses the run’s conflicts and asks members to check their dates', async () => {
    const r = diagnosticRun({
      feasibleCount: 0,
      bindingConstraint: 'F3',
      diagnostic: {
        feasible: [],
        nearMisses: [],
        alternatives: [],
        suggestions: [],
        incomplete: [],
      },
      groupProfile: profileReady({
        commonWindow: null,
        windowFits: false,
        conflicts: [{ code: 'NO_COMMON_WINDOW', blocking: true }],
      }),
    });
    stubFetch({ trip: collecting(r), response: latest(r) });
    renderPage();
    expect(await screen.findByText('The dates members gave do not overlap.')).toBeInTheDocument();
    expect(screen.getByText('Ask members to check their dates')).toBeInTheDocument();
  });
});
