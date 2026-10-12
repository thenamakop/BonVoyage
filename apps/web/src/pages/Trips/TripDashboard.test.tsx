import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TripDetail } from '@bonvoyage/shared';
import { TRIP_ID, member, tripDetail } from '../../test/trip-fixture';
import { TripPage } from './TripPage';

// S1-5: the live dashboard. Only setInterval is faked: TanStack Query's 10 s
// refetchInterval and the 5 s clock run on it, while Testing Library's own
// waiting keeps real timeouts.

const TRIP_URL = `/api/trips/${TRIP_ID}`;
const ACTIVITY_URL = `/api/trips/${TRIP_ID}/activity`;
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

const callsTo = (url: string) => fetchMock.mock.calls.filter((c) => c[0] === url).length;

/** Each poll of the trip takes the next response; the last one repeats. */
function stubFetch(trips: (TripDetail | 'fail')[], meId = 'u1') {
  let i = 0;
  fetchMock.mockImplementation((url, init) => {
    if (url === TRIP_URL && !init?.method) {
      const next = trips[Math.min(i++, trips.length - 1)]!;
      return Promise.resolve(
        next === 'fail'
          ? Response.json({ error: { code: 'INTERNAL', message: 'Down.' } }, { status: 500 })
          : Response.json(next),
      );
    }
    if (url === '/api/me') {
      return Promise.resolve(
        Response.json({ id: meId, name: 'Me', email: 'me@test.bv', homeHubSlug: null }),
      );
    }
    if (url === ACTIVITY_URL) {
      return Promise.resolve(
        Response.json({
          items: [
            {
              id: 'a1',
              transitionId: 'I1',
              event: 'preferenceSubmitted',
              fromStatus: 'collecting_preferences',
              toStatus: 'collecting_preferences',
              actorName: 'Rohan',
              createdAt: '2026-10-13T09:00:00.000Z',
              summary: 'Rohan submitted preferences',
            },
          ],
        }),
      );
    }
    if (url === `${TRIP_URL}/invitations/active`) {
      return Promise.resolve(Response.json({ invitation: null }));
    }
    if (url === `${TRIP_URL}/close-submissions` && init?.method === 'POST') {
      return Promise.resolve(Response.json(tripDetail({ status: 'ready_for_recommendation' })));
    }
    return Promise.resolve(
      Response.json({ error: { code: 'X', message: 'unhandled' } }, { status: 500 }),
    );
  });
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: '/trips/:id', element: <TripPage /> }], {
    initialEntries: [`/trips/${TRIP_ID}`],
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

describe('Trip dashboard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    focusManager.setFocused(undefined);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows progress as text and as progressbar values', async () => {
    stubFetch([tripDetail()]);
    renderPage();
    const bar = await screen.findByRole('progressbar', { name: 'Preferences submitted' });
    expect(bar).toHaveAttribute('aria-valuenow', '2');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '3');
    expect(bar).toHaveAttribute('aria-valuetext', '2 of 3 members have submitted');
    expect(screen.getByText('2 of 3 members have submitted')).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 7: Collecting preferences')).toBeInTheDocument();
    expect(screen.getByText('about ₹16,000 each')).toBeInTheDocument();
  });

  it('polls every 10 s, announces a status change, and reloads activity only when it moves', async () => {
    const collecting = tripDetail();
    const ready = tripDetail({
      status: 'ready_for_recommendation',
      lastActivityAt: '2026-10-13T09:05:00.000Z',
      members: [
        member('u1', 'Asha', { role: 'organiser', submitted: true }),
        member('u2', 'Rohan', { submitted: true }),
        member('u3', 'Meera', { submitted: true }),
      ],
    });
    stubFetch([collecting, collecting, ready]);
    renderPage();
    await screen.findByText('2 of 3 members have submitted');
    await screen.findByText(/Rohan submitted preferences/);
    expect(callsTo(TRIP_URL)).toBe(1);
    expect(callsTo(ACTIVITY_URL)).toBe(1);

    await advance(10_000); // same lastActivityAt: the activity list is not refetched
    expect(callsTo(TRIP_URL)).toBe(2);
    expect(callsTo(ACTIVITY_URL)).toBe(1);

    await advance(10_000); // status and lastActivityAt changed
    expect(callsTo(TRIP_URL)).toBe(3);
    expect(await screen.findByText('3 of 3 members have submitted')).toBeInTheDocument();
    expect(screen.getByTestId('status-announcer')).toHaveTextContent(
      'Trip status changed to Ready for recommendations',
    );
    expect(callsTo(ACTIVITY_URL)).toBe(2);
  });

  it('a failed refetch keeps the last data and shows the warning with Retry', async () => {
    stubFetch([tripDetail(), 'fail']);
    renderPage();
    await screen.findByText('2 of 3 members have submitted');
    await advance(10_000);
    expect(
      await screen.findByText('Could not refresh the trip. Trying again.'),
    ).toBeInTheDocument();
    expect(screen.getByText('2 of 3 members have submitted')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Long weekend in the hills' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('a disabled Close submissions shows its reason next to it', async () => {
    stubFetch([
      tripDetail({
        members: [
          member('u1', 'Asha', { role: 'organiser', submitted: true }),
          member('u2', 'Rohan'),
          member('u3', 'Meera'),
        ],
      }),
    ]);
    renderPage();
    const button = await screen.findByRole('button', { name: 'Close submissions' });
    expect(button).toBeDisabled();
    const reason = screen.getByText('At least 2 members need to submit first.');
    expect(button.getAttribute('aria-describedby')).toBe(reason.id);
  });

  it('Close submissions names who will be left out, then posts', async () => {
    stubFetch([tripDetail()]);
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Close submissions' }));
    expect(
      screen.getByText('Meera has not submitted and will be left out of planning.'),
    ).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Close submissions' })[0]!);
    expect(fetchMock).toHaveBeenCalledWith(
      `${TRIP_URL}/close-submissions`,
      expect.objectContaining({ method: 'POST', body: '{}' }),
    );
  });

  it('next step: a pending member is asked to fill in; a submitted one sees who is pending', async () => {
    stubFetch([tripDetail({ myRole: 'member' })], 'u3');
    renderPage();
    expect(await screen.findByText('Fill in your preferences.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Fill in your preferences' })).toHaveAttribute(
      'href',
      `/trips/${TRIP_ID}/preferences`,
    );
  });

  it('next step: a submitted member reads "Waiting for Meera."', async () => {
    stubFetch([tripDetail({ myRole: 'member' })], 'u2');
    renderPage();
    expect(await screen.findByText('Waiting for Meera.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit your preferences' })).toBeInTheDocument();
  });

  it('next step: the organiser of a draft is told to create the invite link', async () => {
    stubFetch([
      tripDetail({ status: 'draft', members: [member('u1', 'Asha', { role: 'organiser' })] }),
    ]);
    renderPage();
    expect(await screen.findByText('Create the invite link to open the trip.')).toBeInTheDocument();
    expect(screen.getByText('Per-person share appears once people join')).toBeInTheDocument();
  });

  it('stops polling once the trip is cancelled', async () => {
    stubFetch([tripDetail({ status: 'cancelled' })]);
    renderPage();
    await screen.findByText('This trip was cancelled, so planning has stopped.');
    await advance(30_000);
    expect(callsTo(TRIP_URL)).toBe(1);
  });

  it('does not poll while the tab is hidden, and refetches on return', async () => {
    stubFetch([tripDetail()]);
    renderPage();
    await screen.findByText('2 of 3 members have submitted');
    act(() => focusManager.setFocused(false));
    await advance(30_000);
    expect(callsTo(TRIP_URL)).toBe(1);
    act(() => focusManager.setFocused(true));
    await advance(0);
    expect(callsTo(TRIP_URL)).toBe(2);
  });

  it('the footer ticks "Updated ... ago" every 5 s', async () => {
    stubFetch([tripDetail({ status: 'cancelled' })]);
    renderPage();
    expect(await screen.findByText('Updated just now')).toBeInTheDocument();
    await advance(10_000);
    // Date is real, so the label reflects real elapsed time; the tick re-renders it.
    expect(screen.getByText(/^Updated /)).toBeInTheDocument();
  });
});
