import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LatestRecommendationResponse, RunVotes, TripDetail } from '@bonvoyage/shared';
import {
  diagnosticRun,
  item,
  latest,
  nearMiss,
  profileReady,
  profileTwoMembers,
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
  reopen?: Response;
  review?: Response;
}

function stubFetch({ trip, response, patch, choose, reopen, review }: Stub) {
  fetchMock.mockImplementation((url, init) => {
    if (url === TRIP_URL && !init?.method) return Promise.resolve(Response.json(trip));
    if (url === TRIP_URL && init?.method === 'PATCH') {
      return Promise.resolve(patch ?? Response.json(trip));
    }
    if (url === `${TRIP_URL}/budget-review` && init?.method === 'POST') {
      return Promise.resolve(
        review ??
          Response.json(
            { requestedAt: '2026-11-09T04:00:00Z', canRequestAgainAt: '2026-11-10T04:00:00Z' },
            { status: 201 },
          ),
      );
    }
    if (url === `${TRIP_URL}/recommendations/latest`) {
      return Promise.resolve(Response.json(response));
    }
    if (url === `${TRIP_URL}/destination` && init?.method === 'POST') {
      return Promise.resolve(choose ?? Response.json(trip));
    }
    if (url === `${TRIP_URL}/reopen-shortlist` && init?.method === 'POST') {
      return Promise.resolve(
        reopen ?? Response.json({ ...trip, status: 'ready_for_recommendation' }),
      );
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
  return queryClient;
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
    // The button is gone, so focus lands on the first newly shown card.
    expect(screen.getByRole('heading', { name: '6. Place 6' })).toHaveFocus();
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

describe('ask again (T21)', () => {
  const ASK =
    'Ask again? Members can change their answers, and you can ask for new recommendations.';

  it('a member has no Ask again button', async () => {
    stubFetch({
      trip: shortlisted({ myRole: 'member' }),
      response: latest(run(), [item(1), item(2), item(3)]),
    });
    renderPage();
    await screen.findByRole('heading', { name: '1. Place 1' });
    expect(screen.queryByRole('button', { name: 'Ask again' })).not.toBeInTheDocument();
  });

  it('the organiser confirms by keyboard, posts an empty body and goes to the dashboard', async () => {
    stubFetch({ trip: shortlisted(), response: latest(run(), [item(1), item(2), item(3)]) });
    const user = userEvent.setup();
    renderPage();
    const button = await screen.findByRole('button', { name: 'Ask again' });
    // Keep this shortlist closes the confirm without a request.
    await user.click(button);
    expect(screen.getByText(ASK)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep this shortlist' }));
    expect(screen.queryByText(ASK)).not.toBeInTheDocument();

    screen.getByRole('button', { name: 'Ask again' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByText(ASK)).toBeInTheDocument();
    screen.getByRole('button', { name: 'Ask again' }).focus();
    await user.keyboard('{Enter}');
    expect(fetchMock).toHaveBeenCalledWith(
      `${TRIP_URL}/reopen-shortlist`,
      expect.objectContaining({ method: 'POST', body: '{}' }),
    );
    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
  });

  it('a refused ask shows the server message', async () => {
    stubFetch({
      trip: shortlisted(),
      response: latest(run(), [item(1), item(2), item(3)]),
      reopen: Response.json(
        {
          error: {
            code: 'ILLEGAL_TRANSITION',
            message:
              'The event "shortlistReopened" is not allowed while the trip is packages_proposed.',
          },
        },
        { status: 409 },
      ),
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Ask again' }));
    await user.click(screen.getByRole('button', { name: 'Ask again' }));
    expect(
      await screen.findByText(
        'The event "shortlistReopened" is not allowed while the trip is packages_proposed.',
      ),
    ).toBeInTheDocument();
  });
});

describe('after ask again (T21, S5-2b-2)', () => {
  const EARLIER =
    'Earlier shortlist. Asha asked for new recommendations; this list is kept for reference.';
  const reopened = (over: Partial<TripDetail> = {}) =>
    tripDetail({
      status: 'ready_for_recommendation',
      members: MEMBERS,
      latestRecommendation: summaryOf(run()),
      ...over,
    });

  it.each([
    ['the organiser', {}],
    ['a member', { myRole: 'member' as const }],
  ])('%s sees the earlier shortlist labelled, with no Choose or Ask again', async (_who, over) => {
    stubFetch({ trip: reopened(over), response: latest(run(), [item(1), item(2), item(3)]) });
    renderPage();
    expect(await screen.findByText(EARLIER)).toBeInTheDocument();
    expect(cards()).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Choose' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ask again' })).not.toBeInTheDocument();
  });

  it('hides Choose even if the trip still offered it', async () => {
    const trip = reopened();
    stubFetch({
      trip: { ...trip, availableActions: [{ action: 'chooseDestination', enabled: true }] },
      response: latest(run(), [item(1)]),
    });
    renderPage();
    expect(await screen.findByText(EARLIER)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Choose' })).not.toBeInTheDocument();
  });

  it('a current shortlist has no label', async () => {
    stubFetch({ trip: shortlisted(), response: latest(run(), [item(1)]) });
    renderPage();
    await screen.findByRole('heading', { name: '1. Place 1' });
    expect(screen.queryByText(/Earlier shortlist/)).not.toBeInTheDocument();
  });
});

describe('fairness across rounds (R17, R7)', () => {
  const NOTE =
    'This round gives more weight to members whose wishes were met less in earlier rounds.';

  it('says so, with no names or numbers, when the run favours members less served', async () => {
    stubFetch({
      trip: shortlisted({ myRole: 'member' }),
      response: latest(run({ round: 2, favoursLessServed: true }), [item(1), item(2), item(3)]),
    });
    renderPage();
    expect(await screen.findByText(NOTE)).toBeInTheDocument();
  });

  it('says nothing on an unweighted run', async () => {
    stubFetch({
      trip: shortlisted(),
      response: latest(run({ round: 2 }), [item(1), item(2), item(3)]),
    });
    renderPage();
    await screen.findByRole('heading', { name: '1. Place 1' });
    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
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

  it('2 members, a member-set cap: a budget miss is named with no amount (D1, #116)', async () => {
    const f5 = (slug: string, name: string) =>
      nearMiss(slug, name, {
        failures: [
          { id: 'F5', limit: null, actual: 52000, relaxation: null, relative: null, unit: 'inr' },
        ],
      });
    const misses = [f5('mathura', 'Mathura'), f5('vrindavan', 'Vrindavan')];
    const r = diagnosticRun({
      memberCount: 2,
      bindingConstraint: 'F5',
      groupProfile: profileTwoMembers(),
      diagnostic: {
        feasible: ['place-1'],
        nearMisses: misses,
        alternatives: misses,
        suggestions: [
          {
            constraint: 'F5',
            newGroupCapInr: 52000,
            capSource: 'members',
            newPerPersonMaxInr: 26000,
            unlocks: ['mathura', 'vrindavan'],
          },
        ],
        incomplete: [],
      },
    });
    stubFetch({ trip: collecting(r), response: latest(r, [item(1)]) });
    renderPage();
    expect(await screen.findByText('Mathura: over the group budget')).toBeInTheDocument();
    expect(screen.getByText('Vrindavan: over the group budget')).toBeInTheDocument();
    expect(screen.queryByText(/about ₹[\d,]+ over the group budget/)).not.toBeInTheDocument();
    // B: the per-person ask comes from destination costs only, so it stays.
    expect(
      screen.getByText('Members need to raise their maximum to ₹26,000 per person', {
        exact: false,
      }),
    ).toBeInTheDocument();
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
    // The same PATCH again would change nothing.
    expect(screen.getByRole('button', { name: 'Widen the radius to 500 km' })).toBeDisabled();
  });

  it('a new run starts without the previous run’s "Saved" line', async () => {
    const r = diagnosticRun();
    stubFetch({ trip: collecting(r), response: latest(r, [item(1)]) });
    const user = userEvent.setup();
    const queryClient = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Widen the radius to 500 km' }));
    await screen.findByText('Saved. Now mark the trip ready again and get recommendations.');

    const round2 = diagnosticRun({
      id: 'run-2',
      round: 2,
      diagnostic: {
        ...diagnosticRun().diagnostic!,
        suggestions: [{ constraint: 'F1', newRadiusKm: 600, unlocks: ['alwar'] }],
      },
    });
    // A new run arrives (as after Mark ready again and Get recommendations).
    await act(async () => {
      queryClient.setQueryData(['trip', TRIP_ID, 'recommendation'], latest(round2));
      await Promise.resolve();
    });
    expect(await screen.findByText('Round 2')).toBeInTheDocument();
    expect(
      screen.queryByText('Saved. Now mark the trip ready again and get recommendations.'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Widen the radius to 600 km' })).toBeEnabled();
  });

  it('shows the weak-match alert above the destinations that fit', async () => {
    const r = diagnosticRun({ weakMatch: true });
    stubFetch({ trip: collecting(r), response: latest(r, [item(1)]) });
    renderPage();
    expect(
      await screen.findByText(
        'These are the closest options; none match the types the group asked for well.',
      ),
    ).toBeInTheDocument();
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

// R18 (S5-4 part 2): votes on the shortlist cards. The stub below plays the API's
// part for one caller: a PUT or DELETE changes what the next GET sends.
describe('voting (R18)', () => {
  const SLUGS = ['place-1', 'place-2', 'place-3'];
  const ITEMS = [item(1), item(2), item(3)];
  const closed = Response.json(
    { error: { code: 'ILLEGAL_TRANSITION', message: 'Voting has closed.' } },
    { status: 409 },
  );

  /** Others' votes per slug, plus the caller's own; counts follow, as the API's would. */
  function stubVoting({
    trip = shortlisted(),
    r = run(),
    others = {},
    mine,
    eligible = 3,
    waiting = false,
    refuse,
    gate,
  }: {
    trip?: TripDetail;
    r?: ReturnType<typeof run>;
    others?: Record<string, number>;
    mine?: string;
    eligible?: number;
    waiting?: boolean;
    refuse?: Response;
    gate?: Promise<void>;
  } = {}) {
    let own = mine;
    const view = (): RunVotes => {
      const counts = Object.fromEntries(
        SLUGS.map((s) => [s, (others[s] ?? 0) + (own === s ? 1 : 0)]),
      );
      const voted = Object.values(counts).reduce((a, b) => a + b, 0);
      return {
        ...(waiting ? {} : { counts }),
        voted,
        eligible,
        ...(own ? { mine: own } : {}),
      };
    };
    stubFetch({ trip, response: latest(r, ITEMS) });
    // The base stub answers the trip, choose and destinations calls.
    const base = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (url, init) => {
      if (url === `${TRIP_URL}/vote`) {
        await gate;
        if (refuse) return refuse.clone();
        if (init?.method === 'PUT') {
          const sent = typeof init.body === 'string' ? init.body : '{}';
          own = (JSON.parse(sent) as { destinationSlug: string }).destinationSlug;
        } else {
          own = undefined;
        }
        return Response.json(view());
      }
      if (url === `${TRIP_URL}/recommendations/latest`) {
        return Response.json({ ...latest(r, ITEMS), votes: view() });
      }
      return base ? base(url, init) : Response.error();
    });
  }

  const voteButtons = () =>
    screen.queryAllByRole('button', { name: /^(Vote for this|Your vote)$/ });
  const cardOf = (n: number) => within(cards()[n - 1]!);
  const votePuts = () =>
    fetchMock.mock.calls.filter(([url, init]) => url === `${TRIP_URL}/vote` && init?.method);

  it('casts a vote: PUT, then Your vote, 1 of 3 voted and 1 vote', async () => {
    stubVoting();
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText('0 of 3 voted')).toBeInTheDocument();
    expect(cardOf(2).getByText('No votes')).toBeInTheDocument();
    await user.click(cardOf(2).getByRole('button', { name: 'Vote for this' }));
    expect(fetchMock).toHaveBeenCalledWith(
      `${TRIP_URL}/vote`,
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ destinationSlug: 'place-2' }),
      }),
    );
    const mine = await cardOf(2).findByRole('button', { name: 'Your vote' });
    expect(mine).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('1 of 3 voted')).toBeInTheDocument();
    expect(cardOf(2).getByText('1 vote')).toBeInTheDocument();
    expect(cardOf(1).getByRole('button', { name: 'Vote for this' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('changes a vote: pressing another card PUTs it and moves Your vote', async () => {
    stubVoting({ mine: 'place-1' });
    const user = userEvent.setup();
    renderPage();
    await screen.findAllByRole('article');
    expect(await cardOf(1).findByRole('button', { name: 'Your vote' })).toBeInTheDocument();
    await user.click(cardOf(3).getByRole('button', { name: 'Vote for this' }));
    expect(await cardOf(3).findByRole('button', { name: 'Your vote' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(cardOf(1).getByRole('button', { name: 'Vote for this' })).toBeInTheDocument();
    expect(cardOf(1).getByText('No votes')).toBeInTheDocument();
    expect(cardOf(3).getByText('1 vote')).toBeInTheDocument();
    expect(screen.getByText('1 of 3 voted')).toBeInTheDocument();
    expect(votePuts()).toHaveLength(1);
  });

  it('withdraws a vote: pressing your own vote sends DELETE', async () => {
    stubVoting({ mine: 'place-2' });
    const user = userEvent.setup();
    renderPage();
    await screen.findAllByRole('article');
    await user.click(await cardOf(2).findByRole('button', { name: 'Your vote' }));
    expect(fetchMock).toHaveBeenCalledWith(
      `${TRIP_URL}/vote`,
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(await screen.findByText('0 of 3 voted')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Your vote' })).not.toBeInTheDocument();
    expect(voteButtons()).toHaveLength(3);
  });

  it('shows each count as text: No votes, 1 vote, 2 votes', async () => {
    stubVoting({ others: { 'place-1': 2, 'place-2': 1 } });
    renderPage();
    expect(await screen.findByText('3 of 3 voted')).toBeInTheDocument();
    expect(cardOf(1).getByText('2 votes')).toBeInTheDocument();
    expect(cardOf(2).getByText('1 vote')).toBeInTheDocument();
    expect(cardOf(3).getByText('No votes')).toBeInTheDocument();
  });

  it('a 2-member trip waiting for the second vote shows 1 of 2 voted and no counts', async () => {
    stubVoting({ eligible: 2, waiting: true, mine: 'place-1' });
    renderPage();
    expect(await screen.findByText('1 of 2 voted')).toBeInTheDocument();
    expect(screen.queryByText(/^(No votes|\d+ votes?)$/)).not.toBeInTheDocument();
    // The caller still sees, and can change, their own vote.
    expect(cardOf(1).getByRole('button', { name: 'Your vote' })).toBeInTheDocument();
  });

  it('a 2-member trip shows its counts once both have voted', async () => {
    stubVoting({ eligible: 2, mine: 'place-1', others: { 'place-2': 1 } });
    renderPage();
    expect(await screen.findByText('2 of 2 voted')).toBeInTheDocument();
    expect(cardOf(1).getByText('1 vote')).toBeInTheDocument();
    expect(cardOf(2).getByText('1 vote')).toBeInTheDocument();
    expect(cardOf(3).getByText('No votes')).toBeInTheDocument();
  });

  it('disables every vote button while a request is pending', async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    stubVoting({ gate });
    const user = userEvent.setup();
    renderPage();
    await user.click((await screen.findAllByRole('button', { name: 'Vote for this' }))[0]!);
    await waitFor(() => expect(voteButtons().every((b) => b.hasAttribute('disabled'))).toBe(true));
    expect(voteButtons()).toHaveLength(3);
    release();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Your vote' })).toBeEnabled());
    expect(votePuts()).toHaveLength(1);
  });

  it('a vote button is at least 44 px high (min-h-11)', async () => {
    stubVoting();
    renderPage();
    const [first] = await screen.findAllByRole('button', { name: 'Vote for this' });
    expect(first).toHaveClass('min-h-11');
  });

  it('shows a 409 as sent: Voting has closed.', async () => {
    stubVoting({ refuse: closed });
    const user = userEvent.setup();
    renderPage();
    await user.click((await screen.findAllByRole('button', { name: 'Vote for this' }))[0]!);
    expect(await screen.findByText('Voting has closed.')).toBeInTheDocument();
  });

  it('shows a 400 for a destination outside the run with the field message', async () => {
    stubVoting({
      refuse: Response.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Some fields are invalid.',
            fields: { destinationSlug: 'Choose a destination from the shortlist.' },
          },
        },
        { status: 400 },
      ),
    });
    const user = userEvent.setup();
    renderPage();
    await user.click((await screen.findAllByRole('button', { name: 'Vote for this' }))[0]!);
    expect(await screen.findByText('Choose a destination from the shortlist.')).toBeInTheDocument();
  });

  it('after T9 (packages proposed) shows the counts read-only, with no vote buttons', async () => {
    stubVoting({
      trip: shortlisted({ status: 'packages_proposed' }),
      others: { 'place-1': 2, 'place-2': 1 },
    });
    renderPage();
    expect(await screen.findByText('3 of 3 voted')).toBeInTheDocument();
    expect(cardOf(1).getByText('2 votes')).toBeInTheDocument();
    expect(voteButtons()).toHaveLength(0);
  });

  it('the earlier run kept after T21 shows no votes and no buttons', async () => {
    stubVoting({
      trip: tripDetail({
        status: 'ready_for_recommendation',
        members: MEMBERS,
        latestRecommendation: summaryOf(run()),
      }),
      others: { 'place-1': 2 },
    });
    renderPage();
    expect(await screen.findByText(/Earlier shortlist/)).toBeInTheDocument();
    expect(screen.queryByText(/voted/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^(No votes|\d+ votes?)$/)).not.toBeInTheDocument();
    expect(voteButtons()).toHaveLength(0);
  });

  it('a diagnostic run has no vote buttons and no vote line', async () => {
    const r = diagnosticRun();
    stubFetch({
      trip: collecting(r),
      response: { ...latest(r, [item(1)]), votes: { voted: 0, eligible: 3 } },
    });
    renderPage();
    await screen.findByRole('heading', { name: 'Only 1 destination fits' });
    expect(screen.queryByText(/voted/)).not.toBeInTheDocument();
    expect(voteButtons()).toHaveLength(0);
  });

  it('a removed member sees the counts but no buttons', async () => {
    stubVoting({ trip: shortlisted({ myStatus: 'excluded' }), others: { 'place-1': 1 } });
    renderPage();
    expect(await screen.findByText('1 of 3 voted')).toBeInTheDocument();
    expect(voteButtons()).toHaveLength(0);
  });

  it('a member votes without a Choose button', async () => {
    stubVoting({ trip: shortlisted({ myRole: 'member' }) });
    renderPage();
    expect(await screen.findAllByRole('button', { name: 'Vote for this' })).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Choose' })).not.toBeInTheDocument();
  });

  it('the organiser sees Vote and Choose, and can choose a destination with 0 votes', async () => {
    stubVoting({ others: { 'place-1': 2 } });
    const user = userEvent.setup();
    renderPage();
    await screen.findAllByRole('article');
    const third = cardOf(3);
    expect(await third.findByText('No votes')).toBeInTheDocument();
    expect(third.getByRole('button', { name: 'Vote for this' })).toBeInTheDocument();
    await user.click(third.getByRole('button', { name: 'Choose' }));
    await user.click(third.getByRole('button', { name: 'Choose Place 3' }));
    expect(fetchMock).toHaveBeenCalledWith(
      `${TRIP_URL}/destination`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ destinationSlug: 'place-3' }),
      }),
    );
    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
  });

  it('reloads the shortlist when the tab regains focus, without polling', async () => {
    stubVoting();
    renderPage();
    await screen.findByText('0 of 3 voted');
    const loads = () =>
      fetchMock.mock.calls.filter(([url]) => url === `${TRIP_URL}/recommendations/latest`).length;
    expect(loads()).toBe(1);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
    });
    await waitFor(() => expect(loads()).toBe(2));
  });

  it('never pairs a member name with a vote', async () => {
    stubVoting({ mine: 'place-1', others: { 'place-2': 2 } });
    renderPage();
    await screen.findByText('3 of 3 voted');
    const text = document.body.textContent ?? '';
    for (const name of ['Rohan', 'Meera']) expect(text).not.toContain(name);
  });
});

// #163 (option A): a diagnostic suggestion that needs both caps to move gives
// the organiser two actions — raise the trip budget, ask members to review
// theirs — and members the reason plus a link to their own preferences.
describe('a raisesBoth suggestion (both caps must move)', () => {
  const bothRun = (memberCount = 3) =>
    diagnosticRun({
      bindingConstraint: 'F5',
      groupProfile: memberCount === 2 ? profileTwoMembers() : profileReady(),
      diagnostic: {
        feasible: ['place-1'],
        nearMisses: [nearMiss('alwar', 'Alwar'), nearMiss('vrindavan', 'Vrindavan')],
        alternatives: [nearMiss('alwar', 'Alwar')],
        suggestions: [
          memberCount === 2
            ? { constraint: 'F5', raisesBoth: true }
            : {
                constraint: 'F5',
                raisesBoth: true,
                newGroupCapInr: 54000,
                capSource: 'trip',
                unlocks: ['alwar', 'vrindavan'],
              },
        ],
        incomplete: [],
      },
    });
  const bothTrip = (over: Partial<TripDetail> = {}, memberCount = 3) =>
    collecting(bothRun(memberCount), over);

  it('organiser, trip cap: the raise button, the together line and the ask button', async () => {
    stubFetch({ trip: bothTrip(), response: latest(bothRun()) });
    const user = userEvent.setup();
    renderPage();
    const raise = await screen.findByRole('button', { name: 'Raise the group budget to ₹54,000' });
    expect(
      screen.getByRole('button', { name: 'Ask members to review their budgets' }),
    ).toBeEnabled();
    expect(
      screen.getByText("Together with members' budgets, this adds Alwar and Vrindavan."),
    ).toBeInTheDocument();
    expect(screen.getByText("Members' own maximums also limit this group.")).toBeInTheDocument();
    expect(screen.queryByText(/This adds /)).not.toBeInTheDocument();
    await user.click(raise);
    expect(fetchMock).toHaveBeenCalledWith(
      TRIP_URL,
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ budgetTotalInr: 54000 }) }),
    );
    expect(
      await screen.findByText('Saved. Now mark the trip ready again and get recommendations.'),
    ).toBeInTheDocument();
  });

  it('organiser, member cap with 3+ members: the per-person target line stays', async () => {
    const r = diagnosticRun({
      bindingConstraint: 'F5',
      diagnostic: {
        ...diagnosticRun().diagnostic!,
        suggestions: [
          {
            constraint: 'F5',
            raisesBoth: true,
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
      await screen.findByRole('button', { name: 'Raise the group budget to ₹54,000' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Members need to raise their maximum to ₹18,000 per person'),
    ).toBeInTheDocument();
  });

  it('organiser, 2-member stripped shape: the line and its button only', async () => {
    stubFetch({ trip: bothTrip({}, 2), response: latest(bothRun(2)) });
    renderPage();
    expect(
      await screen.findByText("Members' own maximums also limit this group."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Ask members to review their budgets' }),
    ).toBeEnabled();
    expect(
      screen.queryByRole('button', { name: /Raise the group budget/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/adds /)).not.toBeInTheDocument();
    // No figure anywhere near the suggestion.
    expect(screen.queryByText(/₹/)).not.toBeInTheDocument();
  });

  it('the ask button: 201 shows the again line and disables, 429 and 409 show the sentence', async () => {
    stubFetch({ trip: bothTrip(), response: latest(bothRun()) });
    const user = userEvent.setup();
    renderPage();
    const ask = await screen.findByRole('button', { name: 'Ask members to review their budgets' });
    await user.click(ask);
    expect(fetchMock).toHaveBeenCalledWith(
      `${TRIP_URL}/budget-review`,
      expect.objectContaining({ method: 'POST' }),
    );
    expect(await screen.findByText(/^Asked\. You can ask again after /)).toBeInTheDocument();
    expect(ask).toBeDisabled();
  });

  it('a 429 shows the server’s sentence, a 409 its message', async () => {
    stubFetch({
      trip: bothTrip(),
      response: latest(bothRun()),
      review: Response.json(
        {
          error: {
            code: 'TOO_MANY_REQUESTS',
            message: 'You can ask everyone to review their budget again after 10 Nov, 9:30 am',
          },
        },
        { status: 429 },
      ),
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(
      await screen.findByRole('button', { name: 'Ask members to review their budgets' }),
    );
    expect(
      await screen.findByText(
        'You can ask everyone to review their budget again after 10 Nov, 9:30 am',
      ),
    ).toBeInTheDocument();
  });

  it('a 409 shows the server’s message', async () => {
    stubFetch({
      trip: bothTrip(),
      response: latest(bothRun()),
      review: Response.json(
        {
          error: {
            code: 'ILLEGAL_TRANSITION',
            message: 'Members can no longer review their budgets.',
          },
        },
        { status: 409 },
      ),
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(
      await screen.findByRole('button', { name: 'Ask members to review their budgets' }),
    );
    expect(
      await screen.findByText('Members can no longer review their budgets.'),
    ).toBeInTheDocument();
  });

  it('after a reload, canRequestBudgetReviewAt disables the button with the same line', async () => {
    stubFetch({
      trip: bothTrip({ canRequestBudgetReviewAt: '2026-11-10T04:00:00.000Z' }),
      response: latest(bothRun()),
    });
    renderPage();
    const ask = await screen.findByRole('button', { name: 'Ask members to review their budgets' });
    expect(ask).toBeDisabled();
    expect(await screen.findByText(/^Asked\. You can ask again after /)).toBeInTheDocument();
  });

  it('a member sees the reason line and Edit your preferences, never the buttons', async () => {
    stubFetch({
      trip: collecting(bothRun(), { myRole: 'member' }),
      response: latest(bothRun()),
    });
    renderPage();
    expect(
      await screen.findByText("Members' own maximums also limit this group."),
    ).toBeInTheDocument();
    // The suggestion text itself still names the raise; the buttons stay the organiser's.
    expect(
      screen.getByText(
        'Raise the group budget to ₹54,000 and ask members to review their budgets',
        {
          exact: false,
        },
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Raise the group budget/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Ask members to review their budgets' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit your preferences' })).toHaveAttribute(
      'href',
      `/trips/${TRIP_ID}/preferences`,
    );
    // No member name sits next to any budget wording, and nobody's maximum shows.
    const text = document.body.textContent ?? '';
    for (const name of ['Rohan', 'Meera']) {
      const near = text.indexOf(name);
      if (near >= 0) expect(text.slice(Math.max(0, near - 80), near + 80)).not.toMatch(/₹|budget/i);
    }
  });
});
