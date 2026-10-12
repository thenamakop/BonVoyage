import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TripDetail } from '@bonvoyage/shared';
import { TRIP_ID, member, tripDetail } from '../../test/trip-fixture';
import { PreferencesPage } from './PreferencesPage';

// S1-4: the preference form (wireframe 05).

const detail = (overrides: Partial<TripDetail> = {}) =>
  tripDetail({
    myRole: 'member',
    members: [
      member('u1', 'Asha', { role: 'organiser' }),
      member('u2', 'Rohan'),
      member('u3', 'Meera'),
    ],
    ...overrides,
  });

const SAVED = {
  destinationTypes: ['mountain'],
  activities: ['trekking'],
  climate: 'mild',
  travelStyle: 'comfort',
  budgetMinInr: 8000,
  budgetMaxInr: 12000,
  dateStart: '2099-11-13',
  dateEnd: '2099-11-16',
  updatedAt: '2026-10-12T00:00:00.000Z',
};

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

function stubFetch({
  trip = detail(),
  mine = { preference: null, submittedAt: null },
  put = () =>
    Response.json({
      preference: SAVED,
      submittedAt: '2026-10-12T00:00:00.000Z',
      transition: { transitionId: 'I1', kind: 'internal', to: 'collecting_preferences' },
    }),
}: {
  trip?: ReturnType<typeof detail>;
  mine?: Record<string, unknown>;
  put?: () => Response;
} = {}) {
  fetchMock.mockImplementation((url, init) => {
    if (url === `/api/trips/${TRIP_ID}`) return Promise.resolve(Response.json(trip));
    if (url === `/api/trips/${TRIP_ID}/preferences/me`) {
      return Promise.resolve(init?.method === 'PUT' ? put() : Response.json(mine));
    }
    return Promise.resolve(
      Response.json({ error: { code: 'X', message: 'unhandled' } }, { status: 500 }),
    );
  });
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [{ path: '/trips/:id/preferences', element: <PreferencesPage /> }],
    { initialEntries: [`/trips/${TRIP_ID}/preferences`] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const puts = () => fetchMock.mock.calls.filter((c) => c[1]?.method === 'PUT');

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('checkbox', { name: 'Mountain' }));
  await user.click(screen.getByRole('checkbox', { name: 'Trekking' }));
  await user.click(screen.getByRole('radio', { name: /^Mild/ }));
  await user.click(screen.getByRole('radio', { name: /^Comfort/ }));
  await user.type(screen.getByLabelText('Budget min (₹ per person)'), '8000');
  await user.type(screen.getByLabelText('Budget max (₹ per person)'), '12000');
  await user.type(screen.getByLabelText('Available from'), '2099-11-13');
  await user.type(screen.getByLabelText('Available to'), '2099-11-16');
}

describe('PreferencesPage', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows the per-person helper and the group context line', async () => {
    stubFetch();
    renderPage();
    expect(
      await screen.findByText('Per person, for the whole trip: travel, stay, food and activities.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('The group budget is ₹48,000, about ₹16,000 each for 3 members.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('The days you could travel. The trip needs 2 nights.'),
    ).toBeInTheDocument();
  });

  it('no destination type: "Pick at least one kind of place." and nothing is sent', async () => {
    stubFetch();
    const user = userEvent.setup();
    renderPage();
    await fillValid(user);
    await user.click(screen.getByRole('checkbox', { name: 'Mountain' })); // untick it again
    await user.click(screen.getByRole('button', { name: 'Submit preferences' }));
    expect(await screen.findByText('Pick at least one kind of place.')).toBeInTheDocument();
    expect(puts()).toHaveLength(0);
  });

  it('max below min: the message sits on the maximum field and nothing is sent', async () => {
    stubFetch();
    const user = userEvent.setup();
    renderPage();
    await fillValid(user);
    const max = screen.getByLabelText('Budget max (₹ per person)');
    await user.clear(max);
    await user.type(max, '6000');
    await user.click(screen.getByRole('button', { name: 'Submit preferences' }));
    const message = await screen.findByText('Maximum must be at least the minimum.');
    expect(max).toHaveAttribute('aria-invalid', 'true');
    expect(max.getAttribute('aria-describedby')).toContain(message.id);
    expect(max).toHaveValue('6000');
    expect(puts()).toHaveLength(0);
  });

  it('a T3 response shows the ready message', async () => {
    stubFetch({
      put: () =>
        Response.json({
          preference: SAVED,
          submittedAt: '2026-10-12T00:00:00.000Z',
          transition: { transitionId: 'T3', kind: 'external', to: 'ready_for_recommendation' },
        }),
    });
    const user = userEvent.setup();
    renderPage();
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Submit preferences' }));
    expect(
      await screen.findByText(
        'Saved. Everyone has submitted, so the trip is ready for recommendations.',
      ),
    ).toBeInTheDocument();
    const body = JSON.parse(puts()[0]?.[1]?.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({ budgetMinInr: 8000, budgetMaxInr: 12000, climate: 'mild' });
  });

  it('a server field error lands on its input and keeps the values', async () => {
    stubFetch({
      put: () =>
        Response.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Some fields are invalid.',
              fields: { dateEnd: 'Your dates must cover at least 2 nights for this trip.' },
            },
          },
          { status: 400 },
        ),
    });
    const user = userEvent.setup();
    renderPage();
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Submit preferences' }));
    expect(
      await screen.findByText('Your dates must cover at least 2 nights for this trip.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Budget min (₹ per person)')).toHaveValue('8000');
  });

  it('draft: the info alert instead of the form', async () => {
    stubFetch({ trip: detail({ status: 'draft' }) });
    renderPage();
    expect(
      await screen.findByText('Preferences open once the organiser creates the invite link.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit preferences' })).not.toBeInTheDocument();
  });

  it('locked: the warning and the saved answers in a disabled fieldset', async () => {
    stubFetch({
      trip: detail({ status: 'shortlisted' }),
      mine: { preference: SAVED, submittedAt: '2026-10-12T00:00:00.000Z' },
    });
    renderPage();
    expect(
      await screen.findByText('Preferences are locked because the shortlist has been made.'),
    ).toBeInTheDocument();
    const max = screen.getByLabelText('Budget max (₹ per person)');
    expect(max).toHaveValue('12000');
    expect(max).toBeDisabled();
    expect(max.closest('fieldset')).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Submit|Save changes/ })).not.toBeInTheDocument();
  });
});
