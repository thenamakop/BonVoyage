import type { ComponentType } from 'react';
import type { RouteObject } from 'react-router';
import { AppShell } from './components/app/AppShell';
import { PageSkeleton } from './components/app/PageSkeleton';
import { RequireAdmin } from './features/auth/RequireAdmin';
import { RequireAuth } from './features/auth/RequireAuth';
import { JoinPage } from './pages/Join/JoinPage';
import { NotFound } from './pages/NotFound';
import { SignInPage } from './pages/Auth/SignInPage';
import { SignUpPage } from './pages/Auth/SignUpPage';
import { LandingPage } from './pages/Landing/LandingPage';

// #124: the public pages and the shells load with the first bundle; the trip,
// profile and admin screens load on first use (React Router's route `lazy`), so
// the start and sign-in pages do not wait for them. On a first load or a reload
// the AppShell header renders and PageSkeleton stands in for the page.
const lazyPage = (
  load: () => Promise<{ Component: ComponentType }>,
): Pick<RouteObject, 'lazy' | 'HydrateFallback'> => ({ lazy: load, HydrateFallback: PageSkeleton });

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/sign-up', element: <SignUpPage /> },
      { path: '/sign-in', element: <SignInPage /> },
      // Public: the preview is safe to show before sign-in (S1-3).
      { path: '/join/:token', element: <JoinPage /> },
      {
        element: <RequireAuth />,
        children: [
          {
            path: '/trips',
            ...lazyPage(async () => ({
              Component: (await import('./pages/Trips/TripsPage')).TripsPage,
            })),
          },
          {
            path: '/trips/new',
            ...lazyPage(async () => ({
              Component: (await import('./pages/Trips/TripNewPage')).TripNewPage,
            })),
          },
          {
            path: '/trips/:id',
            ...lazyPage(async () => ({
              Component: (await import('./pages/Trips/TripPage')).TripPage,
            })),
          },
          {
            path: '/trips/:id/edit',
            ...lazyPage(async () => ({
              Component: (await import('./pages/Trips/TripEditPage')).TripEditPage,
            })),
          },
          {
            path: '/trips/:id/preferences',
            ...lazyPage(async () => ({
              Component: (await import('./pages/Trips/PreferencesPage')).PreferencesPage,
            })),
          },
          {
            path: '/trips/:id/shortlist',
            ...lazyPage(async () => ({
              Component: (await import('./pages/Trips/shortlist/ShortlistPage')).ShortlistPage,
            })),
          },
          {
            path: '/trips/:id/packages',
            ...lazyPage(async () => ({
              Component: (await import('./pages/Trips/packages/PackagesPage')).PackagesPage,
            })),
          },
          {
            path: '/trips/:id/itinerary',
            ...lazyPage(async () => ({
              Component: (await import('./pages/Trips/itinerary/ItineraryPage')).ItineraryPage,
            })),
          },
          {
            path: '/me',
            ...lazyPage(async () => ({
              Component: (await import('./pages/Profile/ProfilePage')).ProfilePage,
            })),
          },
          {
            element: <RequireAdmin />,
            children: [
              {
                path: '/admin/catalogue',
                ...lazyPage(async () => ({
                  Component: (await import('./pages/Admin/CataloguePage')).CataloguePage,
                })),
              },
            ],
          },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
];
