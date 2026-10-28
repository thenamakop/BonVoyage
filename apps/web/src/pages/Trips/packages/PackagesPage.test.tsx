import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PackagesResponse, TripDetail, TripPackageView } from '@bonvoyage/shared';
import { TRIP_ID, member, tripDetail } from '../../../test/trip-fixture';
import { PackagesPage } from './PackagesPage';

// S3-4 step 4: the packages screen (wireframe 09), as organiser and member.

const TRIP_URL = `/api/trips/${TRIP_ID}`;
const PACKAGES_URL = `${TRIP_URL}/packages`;
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

const MEMBERS = [
  member('u1', 'Asha', { role: 'organiser', submitted: true }),
  member('u2', 'Rohan', { submitted: true }),
  member('u3', 'Meera', { submitted: true }),
];

function pkg(over: Partial<TripPackageView> = {}): TripPackageView {
  return {
    id: 'pk-saver',
    label: 'Saver',
    transportMode: 'bus',
    stayTier: 'budget',
    rooms: 2,
    startDate: '2026-11-13',
    endDate: '2026-11-15',
    totalInr: 15600,
    perPersonInr: 5200,
    overBudget: false,
    overByInr: 0,
    status: 'proposed',
    lines: [
      { category: 'onward', label: 'Bus there', amountInr: 1200, provenance: 'curated' },
      { category: 'return', label: 'Bus back', amountInr: 1200, provenance: 'curated' },
      { category: 'stay', label: 'Stay', amountInr: 8000, provenance: 'curated' },
      { category: 'activities', label: 'Things to do', amountInr: 1200, provenance: 'estimated' },
      { category: 'food', label: 'Food', amountInr: 3000, provenance: 'estimated' },
      { category: 'local', label: 'Getting around', amountInr: 1000, provenance: 'estimated' },
    ],
    opinions: { works: 1, notForMe: 0, members: 3 },
    mine: null,
    ...over,
  };
}

function response(over: Partial<PackagesResponse> = {}): PackagesResponse {
  return {
    destination: { slug: 'chakrata', name: 'Chakrata', state: 'Uttarakhand' },
    n: 3,
    note: null,
    packages: [
      pkg(),
      pkg({
        id: 'pk-balanced',
        label: 'Balanced',
        stayTier: 'mid',
        totalInr: 21600,
        perPersonInr: 7200,
      }),
      pkg({
        id: 'pk-comfort',
        label: 'Comfort',
        transportMode: 'car',
        stayTier: 'premium',
        totalInr: 39966,
        perPersonInr: 13322,
        overBudget: true,
        overByInr: 24366,
      }),
    ],
    choices: [
      { transportMode: 'bus', stayTier: 'budget' },
      { transportMode: 'bus', stayTier: 'mid' },
      { transportMode: 'bus', stayTier: 'premium' },
      { transportMode: 'car', stayTier: 'mid' },
      { transportMode: 'car', stayTier: 'premium' },
    ],
    ...over,
  };
}

const proposed = (over: Partial<TripDetail> = {}) =>
  tripDetail({
    status: 'packages_proposed',
    members: MEMBERS,
    selectedDestination: { slug: 'chakrata', name: 'Chakrata', state: 'Uttarakhand' },
    availableActions: [
      { action: 'givePackageOpinion', enabled: true },
      { action: 'choosePackage', enabled: true },
      { action: 'removePackage', enabled: true },
      { action: 'changePackage', enabled: true },
    ],
    ...over,
  });

interface Stub {
  trip?: TripDetail;
  pkgs?: PackagesResponse;
}

function stubFetch({ trip = proposed(), pkgs = response() }: Stub = {}) {
  const calls: { url: string; method?: string; body?: unknown }[] = [];
  fetchMock.mockImplementation((url, init) => {
    calls.push({
      url,
      method: init?.method,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    if (url === TRIP_URL && !init?.method) return Promise.resolve(Response.json(trip));
    if (url === PACKAGES_URL && !init?.method) return Promise.resolve(Response.json(pkgs));
    if (url.endsWith('/opinion')) return Promise.resolve(Response.json(pkgs));
    if (url.endsWith('/select') || url.endsWith('/remove')) {
      return Promise.resolve(Response.json(trip));
    }
    if (init?.method === 'PATCH') return Promise.resolve(Response.json(pkgs));
    return Promise.resolve(
      Response.json({ error: { code: 'X', message: 'unhandled' } }, { status: 500 }),
    );
  });
  return calls;
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: '/trips/:id/packages', element: <PackagesPage /> },
      { path: '/trips/:id/shortlist', element: <p>Shortlist page</p> },
      { path: '/trips/:id', element: <p>Dashboard page</p> },
    ],
    { initialEntries: [`/trips/${TRIP_ID}/packages`] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('PackagesPage', () => {
  it('renders the three packages with lines and provenance badges', async () => {
    stubFetch();
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Packages for Chakrata' })).toBeTruthy();
    expect(screen.getByText(/From Gurugram · 2 nights · 3 people/)).toBeTruthy();
    for (const label of ['Saver', 'Balanced', 'Comfort']) {
      const card = screen.getByRole('article', { name: `${label} package` });
      expect(within(card).getByRole('heading', { name: label })).toBeTruthy();
    }
    const saver = screen.getByRole('article', { name: 'Saver package' });
    expect(within(saver).getByText('Bus · Budget stay · 2 rooms')).toBeTruthy();
    expect(within(saver).getByText('₹15,600 for the group')).toBeTruthy();
    expect(within(saver).getByText('about ₹5,200 each')).toBeTruthy();
    expect(within(saver).getByText('estimate')).toBeTruthy();
    expect(within(saver).getByText('1 of 3 say it works')).toBeTruthy();
    // Collapsible cost lines with provenance badges.
    await userEvent.click(within(saver).getByText('What it costs'));
    expect(within(saver).getByText('Bus there')).toBeTruthy();
    expect(within(saver).getAllByText('Curated').length).toBe(3);
    expect(within(saver).getAllByText('Estimate').length).toBe(3);
    expect(within(saver).getByText('₹8,000')).toBeTruthy();
  });

  it('shows the over-budget figure from the API', async () => {
    stubFetch();
    renderPage();
    const comfort = await screen.findByRole('article', { name: 'Comfort package' });
    expect(within(comfort).getByText('₹24,366 over the group budget')).toBeTruthy();
  });

  it('with no amount from the API (D1, #116), says over budget in words only', async () => {
    const base = response();
    stubFetch({
      pkgs: {
        ...base,
        n: 2,
        packages: base.packages.map((p) => ({ ...p, overByInr: null })),
      },
    });
    renderPage();
    const comfort = await screen.findByRole('article', { name: 'Comfort package' });
    expect(within(comfort).getByText('Over the group budget')).toBeTruthy();
    expect(within(comfort).queryByText(/₹[\d,]+ over the group budget/)).toBeNull();
    const saver = screen.getByRole('article', { name: 'Saver package' });
    expect(within(saver).queryByText(/over the group budget/i)).toBeNull();
  });

  it('opinion buttons call the API and show the pressed state', async () => {
    const calls = stubFetch({
      pkgs: response({ packages: [pkg({ mine: 'accept' })] }),
    });
    renderPage();
    const card = (await screen.findAllByRole('article'))[0]!;
    const works = within(card).getByRole('button', { name: 'Works for me' });
    await userEvent.click(works);
    expect(
      calls.find((c) => c.url === `${PACKAGES_URL}/pk-saver/opinion` && c.method === 'PUT'),
    ).toMatchObject({ body: { decision: 'accept' } });
    expect(works.getAttribute('aria-pressed')).toBe('true');
    expect(works.getAttribute('data-state')).toBe('on');
    expect(within(card).getByText('You said it works.')).toBeTruthy();
  });

  it('a member sees no organiser actions', async () => {
    stubFetch({
      trip: proposed({
        myRole: 'member',
        availableActions: [{ action: 'givePackageOpinion', enabled: true }],
      }),
    });
    renderPage();
    await screen.findByRole('heading', { name: 'Packages for Chakrata' });
    expect(screen.queryByRole('button', { name: 'Choose this package' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Change' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Works for me' }).length).toBe(3);
  });

  it('the Choose confirm flow calls select', async () => {
    const calls = stubFetch();
    renderPage();
    const saver = await screen.findByRole('article', { name: 'Saver package' });
    await userEvent.click(within(saver).getByRole('button', { name: 'Choose this package' }));
    expect(
      within(saver).getByText('Choose the Saver package? Everyone moves on to the day plan.'),
    ).toBeTruthy();
    await userEvent.click(within(saver).getByRole('button', { name: 'Choose Saver' }));
    expect(calls.find((c) => c.url === `${PACKAGES_URL}/pk-saver/select`)).toMatchObject({
      method: 'POST',
    });
  });

  it('the Remove confirm flow calls remove', async () => {
    const calls = stubFetch();
    renderPage();
    const saver = await screen.findByRole('article', { name: 'Saver package' });
    await userEvent.click(within(saver).getByRole('button', { name: 'Remove' }));
    expect(within(saver).getByText('Remove the Saver package?')).toBeTruthy();
    await userEvent.click(within(saver).getByRole('button', { name: 'Remove Saver' }));
    expect(calls.find((c) => c.url === `${PACKAGES_URL}/pk-saver/remove`)).toMatchObject({
      method: 'POST',
    });
  });

  it('removing the last package warns about the shortlist and navigates there (T10)', async () => {
    const single = response({ packages: [pkg()] });
    const shortlisted = proposed({ status: 'shortlisted' });
    const calls: { url: string; method?: string }[] = [];
    fetchMock.mockImplementation((url, init) => {
      calls.push({ url, method: init?.method });
      if (url === TRIP_URL && !init?.method) return Promise.resolve(Response.json(proposed()));
      if (url === PACKAGES_URL && !init?.method) return Promise.resolve(Response.json(single));
      if (url.endsWith('/remove')) return Promise.resolve(Response.json(shortlisted));
      return Promise.resolve(
        Response.json({ error: { code: 'X', message: 'x' } }, { status: 500 }),
      );
    });
    renderPage();
    const saver = await screen.findByRole('article', { name: 'Saver package' });
    await userEvent.click(within(saver).getByRole('button', { name: 'Remove' }));
    expect(
      within(saver).getByText(
        'This is the last package. Removing it sends the trip back to the shortlist.',
      ),
    ).toBeTruthy();
    await userEvent.click(within(saver).getByRole('button', { name: 'Remove Saver' }));
    expect(await screen.findByText('Shortlist page')).toBeTruthy();
  });

  it('Change limits the selects to costed pairs and PATCHes the choice', async () => {
    const calls = stubFetch();
    renderPage();
    const saver = await screen.findByRole('article', { name: 'Saver package' });
    await userEvent.click(within(saver).getByRole('button', { name: 'Change' }));
    expect(
      within(saver).getByText(/Saving clears everyone.s opinion on this package\./),
    ).toBeTruthy();
    await userEvent.selectOptions(within(saver).getByLabelText('Transport mode'), 'car');
    // Car is only costed for mid and premium in the fixture's choices.
    const tier = within(saver).getByLabelText<HTMLSelectElement>('Stay tier');
    expect([...tier.options].map((o) => o.value)).toEqual(['mid', 'premium']);
    await userEvent.selectOptions(tier, 'premium');
    await userEvent.click(within(saver).getByRole('button', { name: 'Save changes' }));
    expect(
      calls.find((c) => c.url === PACKAGES_URL + '/pk-saver' && c.method === 'PATCH'),
    ).toMatchObject({ body: { transportMode: 'car', stayTier: 'premium' } });
  });

  it('a 422 on Change shows the API message', async () => {
    fetchMock.mockImplementation((url, init) => {
      if (url === TRIP_URL && !init?.method) return Promise.resolve(Response.json(proposed()));
      if (url === PACKAGES_URL && !init?.method) {
        return Promise.resolve(Response.json(response()));
      }
      if (init?.method === 'PATCH') {
        return Promise.resolve(
          Response.json(
            {
              error: {
                code: 'PACKAGE_CHOICE_UNAVAILABLE',
                message: 'That combination is not costed for this package.',
              },
            },
            { status: 422 },
          ),
        );
      }
      return Promise.resolve(
        Response.json({ error: { code: 'X', message: 'x' } }, { status: 500 }),
      );
    });
    renderPage();
    const saver = await screen.findByRole('article', { name: 'Saver package' });
    await userEvent.click(within(saver).getByRole('button', { name: 'Change' }));
    await userEvent.click(within(saver).getByRole('button', { name: 'Save changes' }));
    expect(
      await within(saver).findByText('That combination is not costed for this package.'),
    ).toBeTruthy();
  });

  it('the chosen package is marked and shows no actions', async () => {
    stubFetch({
      trip: proposed({
        status: 'package_selected',
        selectedPackage: { id: 'pk-saver', label: 'Saver', totalInr: 15600, perPersonInr: 5200 },
        availableActions: [],
      }),
      pkgs: response({ packages: [pkg({ status: 'accepted' })] }),
    });
    renderPage();
    const saver = await screen.findByRole('article', { name: 'Saver package' });
    expect(within(saver).getByText('Chosen')).toBeTruthy();
    expect(within(saver).queryByRole('button', { name: 'Works for me' })).toBeNull();
    expect(within(saver).queryByRole('button', { name: 'Choose this package' })).toBeNull();
  });

  it('never shows a member name', async () => {
    stubFetch();
    renderPage();
    await screen.findByRole('heading', { name: 'Packages for Chakrata' });
    for (const name of ['Asha', 'Rohan', 'Meera']) {
      expect(screen.queryByText(name)).toBeNull();
    }
  });
});
