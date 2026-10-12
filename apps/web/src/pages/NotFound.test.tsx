import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../routes';

describe('NotFound', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders for an unknown path', async () => {
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
    const router = createMemoryRouter(routes, { initialEntries: ['/nowhere'] });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/');
  });
});
