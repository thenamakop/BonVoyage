import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignInPage } from './SignInPage';

type SignInArgs = { email: string; password: string };
type Result = Promise<{ ok: boolean; code?: string; message?: string }>;
const signInEmail = vi.fn<(input: SignInArgs) => Result>();
vi.mock('../../lib/auth-client', () => ({
  signInEmail: (input: SignInArgs) => signInEmail(input),
  signUpEmail: vi.fn(),
  signOutUser: vi.fn(),
}));

function renderPage(initial = '/sign-in') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: '/sign-in', element: <SignInPage /> },
      { path: '/trips', element: <p>Trips page</p> },
      { path: '/join/:token', element: <p>Join page</p> },
    ],
    { initialEntries: [initial] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe('SignInPage', () => {
  beforeEach(() => {
    signInEmail.mockReset();
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          Response.json(
            { error: { code: 'UNAUTHENTICATED', message: 'Sign in required.' } },
            { status: 401 },
          ),
        ),
      ),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows one alert on invalid credentials and keeps the email', async () => {
    signInEmail.mockResolvedValue({
      ok: false,
      code: 'INVALID_EMAIL_OR_PASSWORD',
      message: 'Invalid email or password',
    });
    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'asha@demo.bonvoyage.test');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Email or password is incorrect.');
    expect(screen.getByLabelText('Email')).toHaveValue('asha@demo.bonvoyage.test');
  });

  it('navigates to next after a successful sign-in', async () => {
    signInEmail.mockResolvedValue({ ok: true });
    const router = renderPage('/sign-in?next=%2Ftrips');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'asha@demo.bonvoyage.test');
    await user.type(screen.getByLabelText('Password'), 'password-one-two');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Trips page')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/trips');
  });

  it('returns to a join link once /api/me reports the new session (S1-3)', async () => {
    let signedIn = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          signedIn
            ? Response.json({
                id: 'u1',
                name: 'Asha',
                email: 'a@test.bv',
                homeHubSlug: null,
                isAdmin: false,
              })
            : Response.json(
                { error: { code: 'UNAUTHENTICATED', message: 'Sign in required.' } },
                { status: 401 },
              ),
        ),
      ),
    );
    signInEmail.mockImplementation(() => {
      signedIn = true;
      return Promise.resolve({ ok: true });
    });
    const router = renderPage('/sign-in?next=%2Fjoin%2Fabc');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'asha@demo.bonvoyage.test');
    await user.type(screen.getByLabelText('Password'), 'password-one-two');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Join page')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/join/abc');
  });
});
