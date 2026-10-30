import { Link, Outlet } from 'react-router';
import { useMe } from '../../features/auth/api';
import { HealthIndicator } from './HealthIndicator';
import { NotificationBell } from './NotificationBell';
import { UserMenu } from './UserMenu';

export function AppShell() {
  const { data: me } = useMe();
  const signedIn = me !== null && me !== undefined;

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-20 focus:rounded focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      {/* relative: the notification panel spans this header on narrow screens. */}
      <header className="relative bg-brand-700 text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-2">
          <Link
            to={signedIn ? '/trips' : '/'}
            className="flex min-h-11 shrink-0 items-center text-lg font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            BonVoyage
          </Link>
          <nav className="flex min-w-0 items-center gap-1">
            {signedIn ? (
              <Link
                to="/trips"
                className="flex min-h-11 shrink-0 items-center rounded-md px-3 text-sm font-medium hover:bg-brand-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Trips
              </Link>
            ) : null}
            {me ? (
              <>
                <NotificationBell />
                <UserMenu user={me} />
              </>
            ) : (
              <Link
                to="/sign-in"
                className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium hover:bg-brand-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main id="content" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <HealthIndicator />
          <p className="text-xs text-slate-500">BonVoyage</p>
        </div>
      </footer>
    </div>
  );
}
