import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequireAuth } from './RequireAuth';
import { SignInPage } from '../../pages/Auth/SignInPage';

vi.mock('../../lib/auth-client', () => ({
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
  signOutUser: vi.fn(),
}));

function renderRoutes(initial: string, me: Response) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(me.clone())),
  );
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: '/sign-in', element: <SignInPage /> },
      {
        element: <RequireAuth />,
        children: [{ path: '/trips', element: <p>Trips page</p> }],
      },
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

const signedOut = Response.json(
  { error: { code: 'UNAUTHENTICATED', message: 'Sign in required.' } },
  { status: 401 },
);
const signedIn = Response.json(
  {
    id: 'u1',
    name: 'Asha',
    email: 'asha@demo.bonvoyage.test',
    homeHubSlug: 'gurugram',
    isAdmin: false,
  },
  { status: 200 },
);

describe('RequireAuth', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('redirects a signed-out visitor to /sign-in?next=', async () => {
    const router = renderRoutes('/trips', signedOut);
    await waitFor(() => expect(router.state.location.pathname).toBe('/sign-in'));
    expect(router.state.location.search).toBe('?next=%2Ftrips');
  });

  it('renders the child when signed in', async () => {
    renderRoutes('/trips', signedIn);
    expect(await screen.findByText('Trips page')).toBeInTheDocument();
  });
});
