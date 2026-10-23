import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { AppShell } from './AppShell';

function renderShell(signedIn: boolean) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { enabled: false } } });
  queryClient.setQueryData(
    ['me'],
    signedIn
      ? {
          id: 'u1',
          name: 'Asha',
          email: 'asha@example.test',
          homeHubSlug: null,
          isAdmin: false,
        }
      : null,
  );
  queryClient.setQueryData(['health'], { status: 'ok', db: 'ok' });
  const router = createMemoryRouter([{ path: '/', element: <AppShell /> }]);
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('AppShell header focus', () => {
  it.each([true, false])(
    'uses white keyboard outlines for header controls (signed in: %s)',
    async (signedIn) => {
      renderShell(signedIn);
      const user = userEvent.setup();
      await user.tab();
      expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveFocus();
      const controls = [
        screen.getByRole('link', { name: 'BonVoyage' }),
        screen.getByRole('link', { name: signedIn ? 'Trips' : 'Sign in' }),
        ...(signedIn ? [screen.getByRole('button', { name: /Asha/ })] : []),
      ];
      for (const control of controls) {
        await user.tab();
        expect(control).toHaveFocus();
        expect(control).toHaveClass(
          'focus-visible:outline-white',
          'focus-visible:outline-2',
          'focus-visible:outline-offset-2',
        );
      }
    },
  );
});
