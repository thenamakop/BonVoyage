import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LandingPage } from '../Landing/LandingPage';
import { ProfilePage } from './ProfilePage';

// S1-4: the /me profile page.

const ME = { id: 'u4', name: 'Kabir', email: 'kabir@test.bv', homeHubSlug: null, isAdmin: false };
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

function stubFetch(profile: Record<string, unknown>, deleteReply?: () => Response) {
  // After a successful DELETE the old session cookie gets 401 on /api/me and
  // /api/me/profile, as on the server; a still-mounted page may refetch either.
  let deleted = false;
  const unauthenticated = () =>
    Response.json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in.' } }, { status: 401 });
  fetchMock.mockImplementation((url, init) => {
    if (url === '/api/me') {
      return Promise.resolve(deleted ? unauthenticated() : Response.json(ME));
    }
    if (url === '/api/me/profile' && init?.method === 'DELETE') {
      const reply = deleteReply ? deleteReply() : Response.json({ deleted: true });
      deleted = reply.ok;
      return Promise.resolve(reply);
    }
    if (url === '/api/me/profile') {
      return Promise.resolve(deleted ? unauthenticated() : Response.json(profile));
    }
    if (url === '/api/hubs') {
      return Promise.resolve(
        Response.json({ hubs: [{ slug: 'delhi', name: 'Delhi', state: 'Delhi' }] }),
      );
    }
    if (url === '/api/destinations') {
      return Promise.resolve(
        Response.json({
          destinations: [{ slug: 'rishikesh', name: 'Rishikesh', state: 'Uttarakhand' }],
        }),
      );
    }
    if (url === '/api/me/past-trips' && init?.method === 'POST') {
      return Promise.resolve(
        Response.json(
          { id: 'p9', destination: null, placeName: 'Chopta', visitedOn: null, rating: 4 },
          { status: 201 },
        ),
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
      { path: '/me', element: <ProfilePage /> },
      { path: '/', element: <LandingPage /> },
      { path: '/trips', element: <p>trips page</p> },
    ],
    { initialEntries: ['/me'] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { queryClient, router };
}

const PROFILE = { homeHubSlug: null, pastTrips: [] };
const PW_LABEL = 'Password';
const EMAIL_LABEL = /Type .+ to confirm/;

describe('ProfilePage', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lists past trips with the rating in words', async () => {
    stubFetch({
      homeHubSlug: 'delhi',
      pastTrips: [
        {
          id: 'p1',
          destination: { slug: 'rishikesh', name: 'Rishikesh' },
          placeName: null,
          visitedOn: '2025-03-10',
          rating: 4,
        },
      ],
    });
    renderPage();
    expect(await screen.findByText('Rishikesh', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText(/Rated 4 out of 5/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Rishikesh' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Home city')).toHaveValue('delhi');
  });

  it('"Somewhere else" reveals the place name field, which is then sent', async () => {
    stubFetch({ homeHubSlug: null, pastTrips: [] });
    const user = userEvent.setup();
    renderPage();
    const destination = await screen.findByLabelText('Destination');
    await screen.findByRole('option', { name: 'Rishikesh, Uttarakhand' });
    expect(screen.queryByLabelText('Place name')).not.toBeInTheDocument();
    await user.selectOptions(destination, 'Somewhere else');
    const place = screen.getByLabelText('Place name');
    await user.type(place, 'Chopta');
    await user.click(screen.getByRole('radio', { name: '4 out of 5' }));
    await user.click(screen.getByRole('button', { name: 'Add past trip' }));
    const post = fetchMock.mock.calls.find((c) => c[0] === '/api/me/past-trips');
    expect(JSON.parse(post?.[1]?.body as string)).toEqual({ placeName: 'Chopta', rating: 4 });
  });

  it('asks for a destination when nothing is chosen', async () => {
    stubFetch({ homeHubSlug: null, pastTrips: [] });
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText('Destination');
    await user.click(screen.getByRole('radio', { name: '3 out of 5' }));
    await user.click(screen.getByRole('button', { name: 'Add past trip' }));
    expect(
      await screen.findByText('Choose a destination, or pick "Somewhere else" and name the place.'),
    ).toBeInTheDocument();
  });
});

// #54 / S3-5: the Delete account section.
describe('ProfilePage delete account', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps Delete my account disabled until both fields are filled', async () => {
    stubFetch(PROFILE);
    const user = userEvent.setup();
    renderPage();
    const button = await screen.findByRole('button', { name: 'Delete my account' });
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText(PW_LABEL), 'pw-123456789');
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText(EMAIL_LABEL), ME.email);
    expect(button).toBeEnabled();
  });

  it('sends DELETE /api/me/profile, signs out in the client and goes home with the goodbye line', async () => {
    stubFetch(PROFILE);
    const user = userEvent.setup();
    const { queryClient, router } = renderPage();
    await user.type(await screen.findByLabelText(PW_LABEL), 'pw-123456789');
    await user.type(screen.getByLabelText(EMAIL_LABEL), ME.email);
    await user.click(screen.getByRole('button', { name: 'Delete my account' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Your account has been deleted.');
    expect(router.state.location.pathname).toBe('/');
    expect(screen.getByRole('heading', { name: 'Group trips, decided together.' })).toBeVisible();
    // No cached user survives: `me` was cleared and the refetch says signed out;
    // a profile refetch from the unmounting page gets 401 and holds no data.
    await waitFor(() => {
      expect(queryClient.getQueryData(['me'])).toBeNull();
      expect(queryClient.getQueryData(['me', 'profile'])).toBeUndefined();
    });
    expect(screen.queryByText('trips page')).not.toBeInTheDocument();
    const call = fetchMock.mock.calls.find(
      (c) => c[0] === '/api/me/profile' && c[1]?.method === 'DELETE',
    );
    expect(JSON.parse(call?.[1]?.body as string)).toEqual({
      password: 'pw-123456789',
      confirmEmail: ME.email,
    });
  });

  it('422 ACCOUNT_HAS_ACTIVE_TRIPS lists each blocking trip as a link', async () => {
    stubFetch(PROFILE, () =>
      Response.json(
        {
          error: {
            code: 'ACCOUNT_HAS_ACTIVE_TRIPS',
            message: 'Cancel or finish these trips first.',
            details: {
              trips: [
                { id: 't1', title: 'Hills', status: 'collecting_preferences' },
                { id: 't2', title: 'Beach', status: 'in_progress' },
              ],
            },
          },
        },
        { status: 422 },
      ),
    );
    const user = userEvent.setup();
    const { router } = renderPage();
    await user.type(await screen.findByLabelText(PW_LABEL), 'pw-123456789');
    await user.type(screen.getByLabelText(EMAIL_LABEL), ME.email);
    await user.click(screen.getByRole('button', { name: 'Delete my account' }));
    expect(await screen.findByText('Cancel or finish these trips first.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/me');
    expect(screen.getByRole('link', { name: 'Hills' })).toHaveAttribute('href', '/trips/t1');
    expect(screen.getByRole('link', { name: 'Beach' })).toHaveAttribute('href', '/trips/t2');
  });

  it('400 field errors land next to the password and email fields', async () => {
    stubFetch(PROFILE, () =>
      Response.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Some fields are invalid.',
            fields: {
              password: 'Password is incorrect.',
              confirmEmail: 'Type your email to confirm.',
            },
          },
        },
        { status: 400 },
      ),
    );
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText(PW_LABEL), 'pw-123456789');
    await user.type(screen.getByLabelText(EMAIL_LABEL), 'someone-else@test.bv');
    await user.click(screen.getByRole('button', { name: 'Delete my account' }));
    expect(await screen.findByText('Password is incorrect.')).toBeInTheDocument();
    expect(await screen.findByText('Type your email to confirm.')).toBeInTheDocument();
  });

  it('is reachable by keyboard: tab order lands on the fields and the button', async () => {
    stubFetch(PROFILE);
    const user = userEvent.setup();
    renderPage();
    const password = await screen.findByLabelText(PW_LABEL);
    const email = screen.getByLabelText(EMAIL_LABEL);
    const button = screen.getByRole('button', { name: 'Delete my account' });
    password.focus();
    await user.keyboard('pw-123456789');
    await user.tab();
    expect(email).toHaveFocus();
    await user.keyboard(ME.email);
    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard('[Space]');
    expect(
      fetchMock.mock.calls.some((c) => c[0] === '/api/me/profile' && c[1]?.method === 'DELETE'),
    ).toBe(true);
  });
});
