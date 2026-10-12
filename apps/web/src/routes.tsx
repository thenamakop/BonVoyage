import type { RouteObject } from 'react-router';
import { AppShell } from './components/app/AppShell';
import { RequireAuth } from './features/auth/RequireAuth';
import { NotFound } from './pages/NotFound';
import { SignInPage } from './pages/Auth/SignInPage';
import { SignUpPage } from './pages/Auth/SignUpPage';
import { LandingPage } from './pages/Landing/LandingPage';
import { TripsPage } from './pages/Trips/TripsPage';

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/sign-up', element: <SignUpPage /> },
      { path: '/sign-in', element: <SignInPage /> },
      {
        element: <RequireAuth />,
        children: [{ path: '/trips', element: <TripsPage /> }],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
];
