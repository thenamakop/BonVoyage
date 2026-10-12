import type { RouteObject } from 'react-router';
import { AppShell } from './components/app/AppShell';
import { RequireAdmin } from './features/auth/RequireAdmin';
import { RequireAuth } from './features/auth/RequireAuth';
import { CataloguePage } from './pages/Admin/CataloguePage';
import { JoinPage } from './pages/Join/JoinPage';
import { NotFound } from './pages/NotFound';
import { SignInPage } from './pages/Auth/SignInPage';
import { SignUpPage } from './pages/Auth/SignUpPage';
import { LandingPage } from './pages/Landing/LandingPage';
import { ProfilePage } from './pages/Profile/ProfilePage';
import { PreferencesPage } from './pages/Trips/PreferencesPage';
import { TripEditPage } from './pages/Trips/TripEditPage';
import { TripNewPage } from './pages/Trips/TripNewPage';
import { TripPage } from './pages/Trips/TripPage';
import { TripsPage } from './pages/Trips/TripsPage';

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
          { path: '/trips', element: <TripsPage /> },
          { path: '/trips/new', element: <TripNewPage /> },
          { path: '/trips/:id', element: <TripPage /> },
          { path: '/trips/:id/edit', element: <TripEditPage /> },
          { path: '/trips/:id/preferences', element: <PreferencesPage /> },
          { path: '/me', element: <ProfilePage /> },
          {
            element: <RequireAdmin />,
            children: [{ path: '/admin/catalogue', element: <CataloguePage /> }],
          },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
];
