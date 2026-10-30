import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationItem, NotificationsResponse } from '@bonvoyage/shared';
import { NotificationBell } from './NotificationBell';

// S5-3: the bell: the unread count as text, the panel newest first with links to
// the trips, "Mark all as read", the keyboard, and when it refetches.

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

const note = (id: string, over: Partial<NotificationItem> = {}): NotificationItem => ({
  id,
  type: 'shortlist_ready',
  tripId: `trip-${id}`,
  tripTitle: `Trip ${id}`,
  message: 'A shortlist of destinations is ready',
  createdAt: '2026-11-02T06:30:00.000Z',
  readAt: null,
  ...over,
});

/** The server: GET answers from `state`; marking read changes it, as the API does. */
function stubServer(initial: NotificationItem[]) {
  let items = initial;
  const body = (): NotificationsResponse => ({
    items,
    unreadCount: items.filter((n) => n.readAt === null).length,
  });
  fetchMock.mockImplementation((url, init) => {
    if (url === '/api/notifications') return Promise.resolve(Response.json(body()));
    if (url === '/api/notifications/read-all' && init?.method === 'POST') {
      items = items.map((n) => ({ ...n, readAt: '2026-11-02T07:00:00.000Z' }));
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    const one = /^\/api\/notifications\/([^/]+)\/read$/.exec(url);
    if (one && init?.method === 'POST') {
      items = items.map((n) =>
        n.id === one[1] ? { ...n, readAt: '2026-11-02T07:00:00.000Z' } : n,
      );
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    return Promise.resolve(
      Response.json({ error: { code: 'X', message: 'unhandled' } }, { status: 500 }),
    );
  });
}

function renderBell() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: '/', element: <NotificationBell /> },
      { path: '/trips/:id', element: <p>A trip page</p> },
    ],
    { initialEntries: ['/'] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const bell = (name: RegExp | string) => screen.findByRole('button', { name });
const gets = () =>
  fetchMock.mock.calls.filter(([url, init]) => url === '/api/notifications' && !init?.method);

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('the bell', () => {
  it('shows the unread count as text and names it for a screen reader', async () => {
    stubServer([note('a'), note('b'), note('c', { readAt: '2026-11-02T07:00:00.000Z' })]);
    renderBell();
    const button = await bell('Notifications, 2 unread');
    expect(button).toHaveTextContent('2');
    expect(button).toHaveClass('min-h-11', 'min-w-11');
  });

  it('with nothing unread there is no number, and the name says so', async () => {
    stubServer([]);
    renderBell();
    const button = await bell('Notifications, none unread');
    expect(button).toHaveTextContent('');
  });

  it('caps a long count at 99+, keeping the true number in its name', async () => {
    stubServer(Array.from({ length: 120 }, (_, i) => note(String(i))));
    renderBell();
    expect(await bell('Notifications, 120 unread')).toHaveTextContent('99+');
  });

  it('opens a panel in the order the API sends: new ones marked in words, each a link to its trip', async () => {
    stubServer([
      note('a', { tripTitle: 'Hills', message: 'Asha chose a package' }),
      note('b', { tripTitle: 'Coast', readAt: '2026-11-02T07:00:00.000Z' }),
    ]);
    const user = userEvent.setup();
    renderBell();
    await user.click(await bell('Notifications, 1 unread'));
    const panel = screen.getByRole('region', { name: 'Notifications' });
    const links = within(panel).getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/trips/trip-a', '/trips/trip-b']);
    expect(links[0]).toHaveTextContent('Hills');
    expect(links[0]).toHaveTextContent('Asha chose a package');
    expect(links[0]).toHaveTextContent('New');
    expect(links[0]).toHaveTextContent('2 Nov, 12:00 pm');
    expect(links[1]).not.toHaveTextContent('New');
  });

  it('says so when there is nothing, with no Mark all as read', async () => {
    stubServer([]);
    const user = userEvent.setup();
    renderBell();
    await user.click(await bell('Notifications, none unread'));
    expect(screen.getByText('Nothing yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark all as read' })).not.toBeInTheDocument();
  });

  it('Mark all as read clears the count and the New marks', async () => {
    stubServer([note('a'), note('b')]);
    const user = userEvent.setup();
    renderBell();
    await user.click(await bell('Notifications, 2 unread'));
    await user.click(screen.getByRole('button', { name: 'Mark all as read' }));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notifications/read-all',
      expect.objectContaining({ method: 'POST', body: '{}' }),
    );
    await bell('Notifications, none unread');
    expect(screen.queryByText('New')).not.toBeInTheDocument();
  });

  it('following a link marks that one read, closes the panel and goes to the trip', async () => {
    stubServer([note('a'), note('b')]);
    const user = userEvent.setup();
    const router = renderBell();
    await user.click(await bell('Notifications, 2 unread'));
    await user.click(within(screen.getByRole('region')).getAllByRole('link')[0]!);
    expect(await screen.findByText('A trip page')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/trips/trip-a');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notifications/a/read',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('a read notification is not marked again', async () => {
    stubServer([note('a', { readAt: '2026-11-02T07:00:00.000Z' })]);
    const user = userEvent.setup();
    renderBell();
    await user.click(await bell('Notifications, none unread'));
    await user.click(within(screen.getByRole('region')).getByRole('link'));
    await screen.findByText('A trip page');
    expect(fetchMock).not.toHaveBeenCalledWith('/api/notifications/a/read', expect.anything());
  });

  it('works by keyboard: Enter opens, Tab reaches the panel, Escape returns to the bell', async () => {
    stubServer([note('a')]);
    const user = userEvent.setup();
    renderBell();
    const button = await bell('Notifications, 1 unread');
    button.focus();
    await user.keyboard('{Enter}');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Mark all as read' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('link')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('a click outside closes the panel', async () => {
    stubServer([note('a')]);
    const user = userEvent.setup();
    renderBell();
    await user.click(await bell('Notifications, 1 unread'));
    await user.click(document.body);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('a failed load offers Retry instead of hiding the bell', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(Response.json({ error: { code: 'X', message: 'down' } }, { status: 500 })),
    );
    const user = userEvent.setup();
    renderBell();
    const button = await bell('Notifications, none unread');
    await vi.waitFor(() => expect(gets()).toHaveLength(1));
    await user.click(button);
    expect(await screen.findByText('Your notifications could not be loaded.')).toBeInTheDocument();
    stubServer([note('a')]);
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await bell('Notifications, 1 unread')).toBeInTheDocument();
  });
});

describe('when the bell refetches', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => {
    vi.useRealTimers();
    focusManager.setFocused(undefined);
  });

  it('every 60 s while visible, not while hidden, and again on focus', async () => {
    stubServer([note('a')]);
    renderBell();
    await bell('Notifications, 1 unread');
    expect(gets()).toHaveLength(1);

    await act(() => vi.advanceTimersByTimeAsync(59_000));
    expect(gets()).toHaveLength(1);
    await act(() => vi.advanceTimersByTimeAsync(2_000));
    expect(gets()).toHaveLength(2);

    act(() => focusManager.setFocused(false));
    await act(() => vi.advanceTimersByTimeAsync(180_000));
    expect(gets()).toHaveLength(2);

    await act(async () => {
      focusManager.setFocused(true);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(gets()).toHaveLength(3);
  });
});
