import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Home } from './Home';

function renderHome() {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <Home />
    </QueryClientProvider>,
  );
}

function stubFetch(response: Response | Error) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => (response instanceof Error ? Promise.reject(response) : Promise.resolve(response))),
  );
}

describe('Home', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the database as ok', async () => {
    stubFetch(Response.json({ status: 'ok', db: 'ok' }));
    renderHome();
    expect(screen.getByRole('heading', { name: 'BonVoyage' })).toBeInTheDocument();
    expect(await screen.findByText('API ok · Database ok')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows the database as unreachable on 503 DB_UNAVAILABLE', async () => {
    stubFetch(
      Response.json(
        { error: { code: 'DB_UNAVAILABLE', message: 'The database is not reachable.' } },
        { status: 503 },
      ),
    );
    renderHome();
    expect(await screen.findByText('API ok · Database unreachable')).toBeInTheDocument();
  });

  it('shows the API as unreachable for anything else', async () => {
    stubFetch(new TypeError('Failed to fetch'));
    renderHome();
    expect(await screen.findByText('API unreachable')).toBeInTheDocument();
  });
});
