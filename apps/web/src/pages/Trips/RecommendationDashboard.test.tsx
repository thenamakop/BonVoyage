import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  GroupProfileResponse,
  LatestRecommendationResponse,
  TripDetail,
} from '@bonvoyage/shared';
import {
  diagnosticRun,
  item,
  latest,
  profileReady,
  profileTwoMembers,
  run,
  summaryOf,
} from '../../test/recommendation-fixture';
import { TRIP_ID, member, tripDetail } from '../../test/trip-fixture';
import { TripPage } from './TripPage';

// S2-7 step 2: the group profile, Get recommendations, Mark ready again and
// the next-step lines on the dashboard.

const TRIP_URL = `/api/trips/${TRIP_ID}`;
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

const ALL_SUBMITTED = [
  member('u1', 'Asha', { role: 'organiser', submitted: true }),
  member('u2', 'Rohan', { submitted: true }),
  member('u3', 'Meera', { submitted: true }),
];

interface Stub {
  trip: TripDetail;
  meId?: string;
  profile?: GroupProfileResponse;
  latest?: LatestRecommendationResponse;
  request?: Response;
}

function stubFetch({ trip, meId = 'u1', profile = profileReady(), latest: run, request }: Stub) {
  fetchMock.mockImplementation((url, init) => {
    if (url === TRIP_URL && !init?.method) return Promise.resolve(Response.json(trip));
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
    if (url === `${TRIP_URL}/activity`) return Promise.resolve(Response.json({ items: [] }));
    if (url === `${TRIP_URL}/invitations/active`) {
      return Promise.resolve(Response.json({ invitation: null }));
    }
    if (url === `${TRIP_URL}/group-profile`) return Promise.resolve(Response.json(profile));
    if (url === `${TRIP_URL}/recommendations/latest` && run) {
      return Promise.resolve(Response.json(run));
    }
    if (url === `${TRIP_URL}/recommendations` && init?.method === 'POST' && request) {
      return Promise.resolve(request);
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
      { path: '/trips/:id/shortlist', element: <p>Shortlist page</p> },
    ],
    { initialEntries: [`/trips/${TRIP_ID}`] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const profileCard = async () =>
  (await screen.findByRole('heading', { name: 'Group profile' })).closest('section')!;

describe('dashboard: group profile', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows the window, rounded budgets with the note, and shared interests as counts', async () => {
    stubFetch({ trip: tripDetail() });
    renderPage();
    const card = within(await profileCard());
    expect(await card.findByText('13 to 15 Nov, 3 days')).toBeInTheDocument();
    expect(card.getByText('₹12,000 to ₹16,000 per person')).toBeInTheDocument();
    expect(card.getByText('₹48,000 for the group', { exact: false })).toBeInTheDocument();
    expect(card.getByText('Rounded to ₹500 so nobody’s exact limit shows.')).toBeInTheDocument();
    expect(card.getByText('Mountain: 3 of 3')).toBeInTheDocument();
    expect(card.getByText('Trekking: 2 of 3')).toBeInTheDocument();
    expect(card.getByText('Mild: 2 of 3')).toBeInTheDocument();
    expect(card.getByText('and 2 more interests')).toBeInTheDocument();
    // Values chosen by one member never arrive, and no member's name is shown.
    for (const name of ['Asha', 'Rohan', 'Meera']) {
      expect(card.queryByText(name, { exact: false })).not.toBeInTheDocument();
    }
  });

  it('warns about a short window and disjoint budgets', async () => {
    stubFetch({
      trip: tripDetail(),
      profile: profileReady({
        commonWindow: { start: '2026-11-13', end: '2026-11-14', days: 2 },
        windowFits: false,
        budgetBand: { minInr: 14000, maxInr: 10000, overlaps: false },
        perPersonCapInr: 10000,
        conflicts: [
          { code: 'WINDOW_TOO_SHORT', blocking: true },
          { code: 'BUDGET_BANDS_DISJOINT', blocking: false },
        ],
      }),
    });
    renderPage();
    const card = within(await profileCard());
    expect(
      await card.findByText('The dates members gave overlap for 2 days; this trip needs 3.'),
    ).toBeInTheDocument();
    expect(
      card.getByText('Budgets do not overlap; plans use the lowest maximum, ₹10,000 per person.'),
    ).toBeInTheDocument();
  });

  // D1, #116: two contributors see only whether budgets overlap.
  it('2 members: says the budgets overlap, why no figures, and leaves the group cap out', async () => {
    stubFetch({ trip: tripDetail(), profile: profileTwoMembers() });
    renderPage();
    const card = within(await profileCard());
    expect(await card.findByText('Budgets overlap')).toBeInTheDocument();
    expect(
      card.getByText('Budget figures appear once 3 or more people have answered.'),
    ).toBeInTheDocument();
    expect(card.queryByText('The group can spend')).not.toBeInTheDocument();
    expect(
      card.queryByText('Rounded to ₹500 so nobody’s exact limit shows.'),
    ).not.toBeInTheDocument();
    expect(card.queryByText(/₹/)).not.toBeInTheDocument();
  });

  it('2 members with disjoint budgets: a warning in words, still no figures', async () => {
    stubFetch({
      trip: tripDetail(),
      profile: profileTwoMembers({
        budgetBand: { minInr: null, maxInr: null, overlaps: false },
        conflicts: [{ code: 'BUDGET_BANDS_DISJOINT', blocking: false }],
      }),
    });
    renderPage();
    const card = within(await profileCard());
    expect(await card.findByText('Budgets do not overlap')).toBeInTheDocument();
    expect(
      card.getByText('Budget figures appear once 3 or more people have answered.'),
    ).toBeInTheDocument();
    expect(card.queryByText(/₹/)).not.toBeInTheDocument();
  });

  it('2 members and a trip-set cap: the public group budget stays', async () => {
    stubFetch({ trip: tripDetail(), profile: profileTwoMembers({ groupCapInr: 30000 }) });
    renderPage();
    const card = within(await profileCard());
    expect(await card.findByText('Budgets overlap')).toBeInTheDocument();
    expect(card.getByText('₹30,000 for the group', { exact: false })).toBeInTheDocument();
  });

  it('waits for two submissions before showing a profile', async () => {
    stubFetch({ trip: tripDetail(), profile: { ready: false, memberCount: 1 } });
    renderPage();
    const card = within(await profileCard());
    expect(
      await card.findByText('The group profile appears once 2 members have submitted.'),
    ).toBeInTheDocument();
  });
});

describe('dashboard: recommendations', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const ready = () => tripDetail({ status: 'ready_for_recommendation', members: ALL_SUBMITTED });

  it('Get recommendations announces the wait and goes to the shortlist on success', async () => {
    let resolve: (r: Response) => void = () => {};
    stubFetch({ trip: ready() });
    const base = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url, init) =>
      url === `${TRIP_URL}/recommendations` && init?.method === 'POST'
        ? new Promise<Response>((r) => (resolve = r))
        : base(url, init),
    );
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText('Get recommendations when you are ready.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Get recommendations' }));
    expect(
      await screen.findByText('Finding destinations, this takes a few seconds'),
    ).toBeInTheDocument();
    const r = run();
    resolve(
      Response.json({
        run: r,
        items: [item(1), item(2), item(3)],
        transition: { transitionId: 'T6>T7', to: 'shortlisted' },
      }),
    );
    expect(await screen.findByText('Shortlist page')).toBeInTheDocument();
  });

  it('a 409 shows the server message as sent', async () => {
    stubFetch({
      trip: ready(),
      request: Response.json(
        {
          error: {
            code: 'RECOMMENDATION_STALE',
            message: 'Preferences changed while recommending. Try again.',
          },
        },
        { status: 409 },
      ),
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Get recommendations' }));
    expect(
      await screen.findByText('Preferences changed while recommending. Try again.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Shortlist page')).not.toBeInTheDocument();
  });

  it('a member waits for the organiser and has no Get recommendations button', async () => {
    stubFetch({
      trip: tripDetail({ status: 'ready_for_recommendation', myRole: 'member' }),
      meId: 'u2',
    });
    renderPage();
    expect(await screen.findByText('Waiting for Asha to get recommendations.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Get recommendations' })).not.toBeInTheDocument();
  });

  it('shortlisted: the organiser is asked to choose, with a link to the shortlist', async () => {
    const r = run();
    stubFetch({ trip: tripDetail({ status: 'shortlisted', latestRecommendation: summaryOf(r) }) });
    renderPage();
    expect(await screen.findByText('Choose a destination from the shortlist.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See the shortlist' })).toHaveAttribute(
      'href',
      `/trips/${TRIP_ID}/shortlist`,
    );
  });

  it('shortlisted, as a member', async () => {
    const r = run();
    stubFetch({
      trip: tripDetail({
        status: 'shortlisted',
        myRole: 'member',
        latestRecommendation: summaryOf(r),
      }),
      meId: 'u2',
    });
    renderPage();
    expect(
      await screen.findByText('Waiting for Asha to choose a destination.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See the shortlist' })).toBeInTheDocument();
  });

  it('after a diagnostic: what the last round found, a link to why, and Mark ready again', async () => {
    const r = diagnosticRun();
    stubFetch({
      trip: tripDetail({ members: ALL_SUBMITTED, latestRecommendation: summaryOf(r) }),
      latest: latest(r, [item(1)]),
    });
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText('The last round found only 1 destination.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See why' })).toHaveAttribute(
      'href',
      `/trips/${TRIP_ID}/shortlist`,
    );
    expect(screen.queryByRole('button', { name: 'Close submissions' })).not.toBeInTheDocument();
    // Nobody is pending, so the confirm offers "Not now" rather than "Keep waiting".
    await user.click(screen.getByRole('button', { name: 'Mark ready again' }));
    expect(screen.getByText('Everyone active has submitted.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Keep waiting' })).not.toBeInTheDocument();
  });

  it('after a date clash (F3), the dashboard says so from the run’s binding constraint', async () => {
    const r = diagnosticRun({ feasibleCount: 0, bindingConstraint: 'F3', diagnostic: null });
    stubFetch({
      trip: tripDetail({ members: ALL_SUBMITTED, latestRecommendation: summaryOf(r) }),
      latest: latest(r),
    });
    renderPage();
    expect(await screen.findByText('The last round found a date clash.')).toBeInTheDocument();
  });

  it('packages proposed: the chosen destination on the callout and in the parameters', async () => {
    stubFetch({
      trip: tripDetail({
        status: 'packages_proposed',
        latestRecommendation: summaryOf(run()),
        selectedDestination: { slug: 'rishikesh', name: 'Rishikesh', state: 'Uttarakhand' },
      }),
    });
    renderPage();
    expect(
      await screen.findByText('Compare the packages and say which work for you.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See the packages' })).toBeInTheDocument();
    expect(screen.getByText('Rishikesh, Uttarakhand')).toBeInTheDocument();
    expect(
      screen.getByText('Costed packages are ready for the group to compare.'),
    ).toBeInTheDocument();
  });
});
