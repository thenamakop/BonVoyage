import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserMenu } from './UserMenu';

type Result = Promise<{ ok: boolean; code?: string; message?: string }>;
const signOutUser = vi.fn<() => Result>();
vi.mock('../../lib/auth-client', () => ({
  signOutUser: () => signOutUser(),
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
}));

const asha = {
  id: 'u1',
  name: 'Asha',
  email: 'asha@demo.bonvoyage.test',
  homeHubSlug: null,
  isAdmin: false,
};

function renderMenu() {
  const queryClient = new QueryClient();
  queryClient.setQueryData(['me'], asha);
  const router = createMemoryRouter(
    [
      { path: '/', element: <UserMenu user={asha} /> },
      { path: '/trips', element: <p>Trips page</p> },
    ],
    { initialEntries: ['/'] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { queryClient };
}

describe('UserMenu', () => {
  beforeEach(() => {
    signOutUser.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens, calls signOut and clears the cache', async () => {
    signOutUser.mockResolvedValue({ ok: true });
    const { queryClient } = renderMenu();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Asha/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(signOutUser).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData(['me'])).toBeUndefined();
  });

  it('closes on Escape', async () => {
    renderMenu();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Asha/ }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('shows an error and stays signed in when signOut fails', async () => {
    signOutUser.mockResolvedValue({ ok: false, code: 'UNKNOWN', message: 'nope' });
    const { queryClient } = renderMenu();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Asha/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(queryClient.getQueryData(['me'])).toEqual(asha);
  });
});
