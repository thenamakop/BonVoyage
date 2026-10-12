import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignUpPage } from './SignUpPage';

type SignUpArgs = { name: string; email: string; password: string };
type Result = Promise<{ ok: boolean; code?: string; message?: string }>;
const signUpEmail = vi.fn<(input: SignUpArgs) => Result>();
vi.mock('../../lib/auth-client', () => ({
  signUpEmail: (input: SignUpArgs) => signUpEmail(input),
  signInEmail: vi.fn(),
  signOutUser: vi.fn(),
}));

function renderPage(initial = '/sign-up?next=%2Ftrips') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: '/sign-up', element: <SignUpPage /> },
      { path: '/trips', element: <p>Trips page</p> },
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

function stubMeSignedOut() {
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
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Name'), 'Asha');
  await user.type(screen.getByLabelText('Email'), 'asha@demo.bonvoyage.test');
  await user.type(screen.getByLabelText('Password'), 'password-one-two');
}

describe('SignUpPage', () => {
  beforeEach(() => {
    signUpEmail.mockReset();
    stubMeSignedOut();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects a short password without sending anything', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Name'), 'Asha');
    await user.type(screen.getByLabelText('Email'), 'asha@demo.bonvoyage.test');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Create an account' }));
    expect(screen.getByText('At least 12 characters.')).toBeInTheDocument();
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it('submits trimmed values and navigates to next', async () => {
    signUpEmail.mockResolvedValue({ ok: true });
    const router = renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Name'), '  Asha  ');
    await user.type(screen.getByLabelText('Email'), 'asha@demo.bonvoyage.test');
    await user.type(screen.getByLabelText('Password'), 'password-one-two');
    await user.click(screen.getByRole('button', { name: 'Create an account' }));
    expect(await screen.findByText('Trips page')).toBeInTheDocument();
    expect(signUpEmail).toHaveBeenCalledWith({
      name: 'Asha',
      email: 'asha@demo.bonvoyage.test',
      password: 'password-one-two',
    });
    expect(router.state.location.pathname).toBe('/trips');
  });

  it('shows the user-exists error on the email field', async () => {
    signUpEmail.mockResolvedValue({
      ok: false,
      code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
      message: 'User already exists. Use another email.',
    });
    renderPage('/sign-up');
    const user = userEvent.setup();
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Create an account' }));
    expect(
      await screen.findByText(/An account with this email already exists/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sign in instead/ })).toBeInTheDocument();
  });
});
