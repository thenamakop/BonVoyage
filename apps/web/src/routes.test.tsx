import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, type RouteObject } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PageSkeleton } from './components/app/PageSkeleton';
import { routes } from './routes';
import { TRIP_ID, tripDetail } from './test/trip-fixture';

// #124: the trip, profile and admin screens load lazily. Each lazy route, opened
// directly as on a deep link or a reload, still reaches its page through the
// real route table, behind RequireAuth (and RequireAdmin for the catalogue).

const ME = { id: 'u1', name: 'Asha', email: 'asha@test.bv', homeHubSlug: null, isAdmin: true };
const json = (body: unknown, status = 200) => Promise.resolve(Response.json(body, { status }));
const notFound = () => json({ error: { code: 'NOT_FOUND', message: 'Not found.' } }, 404);

const BODIES: Record<string, unknown> = {
  '/api/me': ME,
  '/api/me/trips': { trips: [] },
  '/api/me/profile': { homeHubSlug: null, pastTrips: [] },
  '/api/hubs': { hubs: [] },
  '/api/destinations': { destinations: [] },
  [`/api/trips/${TRIP_ID}`]: tripDetail(),
  [`/api/trips/${TRIP_ID}/recommendations/latest`]: { run: null, items: [] },
  [`/api/trips/${TRIP_ID}/packages`]: {
    destination: { slug: 'chakrata', name: 'Chakrata', state: 'Uttarakhand' },
    n: 3,
    note: null,
    packages: [],
    choices: [],
  },
  [`/api/trips/${TRIP_ID}/itinerary`]: { itinerary: null },
};

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const LAZY_PATHS = [
  '/trips',
  '/trips/new',
  '/trips/:id',
  '/trips/:id/edit',
  '/trips/:id/preferences',
  '/trips/:id/shortlist',
  '/trips/:id/packages',
  '/trips/:id/itinerary',
  '/me',
  '/admin/catalogue',
];
const EAGER_PATHS = ['/', '/sign-up', '/sign-in', '/join/:token', '*'];

function flatten(list: RouteObject[]): RouteObject[] {
  return list.flatMap((r) => [r, ...flatten(r.children ?? [])]);
}

describe('route table (#124)', () => {
  const byPath = new Map(flatten(routes).map((r) => [r.path, r]));

  it('loads the trip, profile and admin screens lazily, with the page skeleton meanwhile', () => {
    for (const path of LAZY_PATHS) {
      const route = byPath.get(path);
      expect(typeof route?.lazy, path).toBe('function');
      expect(route?.element, path).toBeUndefined();
      expect(route?.HydrateFallback, path).toBe(PageSkeleton);
    }
  });

  it('keeps the start, sign-in, sign-up, join and not-found pages in the first bundle', () => {
    for (const path of EAGER_PATHS) {
      const route = byPath.get(path);
      expect(route?.element, path).toBeDefined();
      expect(route?.lazy, path).toBeUndefined();
    }
  });
});

describe('lazy routes (#124)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        const body = BODIES[url.split('?')[0] ?? url];
        return body === undefined ? notFound() : json(body);
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ['/trips', 'Your trips'],
    ['/trips/new', 'New trip'],
    [`/trips/${TRIP_ID}`, 'Long weekend in the hills'],
    [`/trips/${TRIP_ID}/edit`, 'Edit Long weekend in the hills'],
    [`/trips/${TRIP_ID}/preferences`, 'Your preferences'],
    [`/trips/${TRIP_ID}/shortlist`, 'Shortlist'],
    [`/trips/${TRIP_ID}/packages`, 'Packages for Chakrata'],
    ['/me', 'Your profile'],
    ['/admin/catalogue', 'Catalogue'],
  ])('%s loads its page: "%s"', async (path, heading) => {
    renderAt(path);
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
  });

  it('the day plan page loads (no plan yet: no heading, its empty line)', async () => {
    renderAt(`/trips/${TRIP_ID}/itinerary`);
    expect(await screen.findByText('No day plan yet.', { exact: false })).toBeInTheDocument();
  });

  it('a signed-out deep link to a lazy page still goes to sign-in', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in.' } }, 401)),
    );
    renderAt(`/trips/${TRIP_ID}/packages`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
  });

  it('a signed-in non-administrator still gets the admin guard, not the catalogue', async () => {
    BODIES['/api/me'] = { ...ME, isAdmin: false };
    try {
      renderAt('/admin/catalogue');
      expect(await screen.findByText('Administrators only')).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { level: 1, name: 'Catalogue' }),
      ).not.toBeInTheDocument();
    } finally {
      BODIES['/api/me'] = ME;
    }
  });
});
