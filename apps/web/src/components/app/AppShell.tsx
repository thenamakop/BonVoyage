import { Link, Outlet, useLocation } from 'react-router';
import { useMe } from '../../features/auth/api';
import { HealthIndicator } from './HealthIndicator';
import { NotificationBell } from './NotificationBell';
import { UserMenu } from './UserMenu';

const headerLink =
  'flex min-h-11 shrink-0 items-center rounded-xl px-3 text-sm font-semibold hover:bg-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

/** The mark: an accent stop with an ink rim and a dotted route that ends in a dot. */
function LogoMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 34 34" className="h-[34px] w-[34px] shrink-0">
      <circle cx="17" cy="17" r="15.5" className="fill-accent stroke-ink" strokeWidth="2.5" />
      <path
        d="M8 23c3-9 9-3 12-8s3-6 5-7"
        fill="none"
        className="animate-march stroke-ink"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeDasharray="0.1 3.9"
      />
      <circle cx="25" cy="8" r="2.6" className="fill-ink" />
    </svg>
  );
}

export function AppShell() {
  const { data: me } = useMe();
  const signedIn = me !== null && me !== undefined;
  // The homepage runs edge to edge; every other page sits in the reading column.
  const fullWidth = useLocation().pathname === '/';

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-20 focus:rounded focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      {/* relative: the notification panel spans this header on narrow screens. */}
      <header className="relative border-b-[2.5px] border-ink bg-brand-700 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2">
          <Link
            to={signedIn ? '/trips' : '/'}
            className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl pr-2 font-display text-xl font-extrabold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <LogoMark />
            BonVoyage
          </Link>
          <nav className="flex min-w-0 items-center gap-1">
            {signedIn ? (
              <Link to="/trips" className={headerLink}>
                Trips
              </Link>
            ) : null}
            {me ? (
              <>
                <NotificationBell />
                <UserMenu user={me} />
              </>
            ) : (
              <Link to="/sign-in" className={headerLink}>
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main
        id="content"
        className={fullWidth ? 'w-full flex-1' : 'mx-auto w-full max-w-5xl flex-1 px-4 py-8'}
      >
        <Outlet />
      </main>
      <footer className="border-t-[2.5px] border-ink bg-white px-4 py-4">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <HealthIndicator />
          <p className="text-xs text-muted">
            <span className="font-display text-sm font-extrabold tracking-tight text-ink">
              BonVoyage
            </span>{' '}
            · A software engineering project at BML Munjal University
          </p>
        </div>
      </footer>
    </div>
  );
}
