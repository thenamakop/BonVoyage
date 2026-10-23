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

function renderMenu(user = asha) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(['me'], user);
  const router = createMemoryRouter(
    [
      { path: '/', element: <UserMenu user={user} /> },
      { path: '/trips', element: <p>Trips page</p> },
      { path: '/me', element: <p>Profile page</p> },
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

  it('shows Catalogue only to administrators (S1-7)', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: /Asha/ }));
    expect(screen.queryByRole('menuitem', { name: 'Catalogue' })).not.toBeInTheDocument();
  });

  it('administrators see Catalogue, linking to /admin/catalogue', async () => {
    const user = userEvent.setup();
    renderMenu({ ...asha, isAdmin: true });
    await user.click(screen.getByRole('button', { name: /Asha/ }));
    expect(screen.getByRole('menuitem', { name: 'Catalogue' })).toHaveAttribute(
      'href',
      '/admin/catalogue',
    );
  });

  it('opens with Enter and restores button focus on Escape from a menu item', async () => {
    renderMenu();
    const user = userEvent.setup();
    const button = screen.getByRole('button', { name: /Asha/ });
    await user.tab();
    expect(button).toHaveFocus();
    expect(button).toHaveClass(
      'focus-visible:outline-white',
      'focus-visible:outline-2',
      'focus-visible:outline-offset-2',
    );
    await user.keyboard('{Enter}');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.tab();
    expect(screen.getByRole('menuitem', { name: 'Your profile' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it('keeps navigation behaviour when choosing a profile link by keyboard', async () => {
    renderMenu();
    const user = userEvent.setup();
    await user.tab();
    await user.keyboard('{Enter}');
    await user.tab();
    await user.keyboard('{Enter}');
    expect(await screen.findByText('Profile page')).toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('shows an error and stays signed in when signOut fails', async () => {
    signOutUser.mockResolvedValue({ ok: false, code: 'UNKNOWN', message: 'nope' });
    const { queryClient } = renderMenu();
    const user = userEvent.setup();
    await user.tab();
    await user.keyboard('{Enter}');
    await user.tab();
    await user.tab();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(queryClient.getQueryData(['me'])).toEqual(asha);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Asha/ })).toHaveFocus();
  });
});
