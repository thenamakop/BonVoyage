import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RequireAdmin } from '../../features/auth/RequireAdmin';
import { CataloguePage } from './CataloguePage';

// S1-7: /admin/catalogue.

const me = (isAdmin: boolean) => ({
  id: 'u1',
  name: 'Asha',
  email: 'asha@test.bv',
  homeHubSlug: null,
  isAdmin,
});
const STAGES = [
  { stage: 'a', verified: 6, total: 50, dueDate: '2026-10-18' },
  { stage: 'b', verified: 0, total: 253, dueDate: '2026-10-25' },
  { stage: 'c', verified: 0, total: 21, dueDate: '2026-11-01' },
];
const STATUS = {
  tables: { hub: 6, destination: 44, poi: 21, fare_fallback: 204, cost_rule: 5 },
  stages: STAGES,
  lastUpdatedAt: '2026-10-13T06:30:00.000Z',
};
const zero = { inserted: 0, updated: 0 };
const CLEAN = {
  dryRun: true,
  issues: [{ file: 'pois.csv', line: null, severity: 'warning', message: 'few POIs' }],
  counts: {
    hub: zero,
    destination: { inserted: 0, updated: 1 },
    poi: zero,
    fare_fallback: zero,
    cost_rule: zero,
  },
  stages: STAGES,
  notInFiles: ['old-place'],
};
const INVALID = {
  error: {
    code: 'CATALOGUE_INVALID',
    message: 'The files have errors. Fix them and check again.',
    details: {
      issues: [
        {
          file: 'hubs.csv',
          line: 3,
          column: 'lat',
          severity: 'error',
          message: 'latitude out of range',
        },
        { file: 'destinations.csv', line: 1, severity: 'error', message: 'header row differs' },
      ],
    },
  },
};

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

function stubFetch({ admin = true, importReply = () => Response.json(CLEAN) } = {}) {
  fetchMock.mockImplementation((url, init) => {
    if (url === '/api/me') return Promise.resolve(Response.json(me(admin)));
    if (url === '/api/admin/catalogue/status') return Promise.resolve(Response.json(STATUS));
    if (url === '/api/admin/catalogue/import' && init?.method === 'POST') {
      return Promise.resolve(importReply());
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
      {
        element: <RequireAdmin />,
        children: [{ path: '/admin/catalogue', element: <CataloguePage /> }],
      },
    ],
    { initialEntries: ['/admin/catalogue'] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const NAMES = ['hubs.csv', 'destinations.csv', 'fares.csv', 'pois.csv', 'cost-rules.json'];
const fileFor = (name: string, text = `${name} contents`) => new File([text], name);

async function chooseAll(user: ReturnType<typeof userEvent.setup>) {
  for (const name of NAMES) await user.upload(screen.getByLabelText(name), fileFor(name));
}

describe('CataloguePage', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('a non-administrator sees "Administrators only" and nothing else', async () => {
    stubFetch({ admin: false });
    renderPage();
    expect(await screen.findByText('Administrators only')).toBeInTheDocument();
    expect(screen.queryByText('Import files')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith('/api/admin/catalogue/status', expect.anything());
  });

  it('shows the status card with counts and stage progress', async () => {
    stubFetch();
    renderPage();
    expect(
      await screen.findByText('Stage A: 6 of 50 verified, due 18 Oct 2026'),
    ).toBeInTheDocument();
    expect(screen.getByText('Stage B: 0 of 253 verified, due 25 Oct 2026')).toBeInTheDocument();
    expect(screen.getByText('204')).toBeInTheDocument();
  });

  it('Import stays disabled until a clean check of the same five files', async () => {
    stubFetch();
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Import files');
    const importButton = screen.getByRole('button', { name: 'Import' });
    expect(importButton).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Check files' })).toBeDisabled();

    await chooseAll(user);
    expect(importButton).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Check files' }));
    await waitFor(() => expect(importButton).toBeEnabled());
    const sent = JSON.parse(
      fetchMock.mock.calls.find((c) => c[0] === '/api/admin/catalogue/import')![1]!.body as string,
    ) as { dryRun: boolean; files: Record<string, string> };
    expect(sent.dryRun).toBe(true);
    expect(sent.files.costRules).toBe('cost-rules.json contents');
    expect(screen.getByText(/old-place/)).toBeInTheDocument();

    // Choosing a different file resets the clean check.
    await user.upload(screen.getByLabelText('fares.csv'), fileFor('fares.csv', 'changed'));
    expect(importButton).toBeDisabled();
  });

  it('the confirm names the host before importing', async () => {
    stubFetch();
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Import files');
    await chooseAll(user);
    await user.click(screen.getByRole('button', { name: 'Check files' }));
    await user.click(await screen.findByRole('button', { name: 'Import' }));
    expect(screen.getByText(window.location.host)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Import now' }));
    await waitFor(() => {
      const posts = fetchMock.mock.calls.filter((c) => c[0] === '/api/admin/catalogue/import');
      expect(JSON.parse(posts.at(-1)![1]!.body as string)).toMatchObject({ dryRun: false });
    });
  });

  it('a check with errors lists the issues by file with line numbers, in words', async () => {
    stubFetch({ importReply: () => Response.json(INVALID, { status: 422 }) });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Import files');
    await chooseAll(user);
    await user.click(screen.getByRole('button', { name: 'Check files' }));
    expect(
      await screen.findByText('The files have errors. Fix them and check again.'),
    ).toBeInTheDocument();
    const lat = screen.getByText(/line 3 · lat: latitude out of range/);
    expect(lat).toHaveTextContent('Error · line 3 · lat: latitude out of range');
    expect(screen.getByText(/line 1: header row differs/)).toHaveTextContent('Error');
    expect(screen.getByRole('heading', { name: 'hubs.csv' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });
});
