import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { ButtonLink } from '../../components/ui/Button';
import { useMe } from '../../features/auth/api';
import { useDocumentTitle } from '../../lib/use-document-title';
import { useReveal } from '../../lib/use-reveal';
import { HeroCollage } from './HeroCollage';
import { ArrowIcon, CompassIcon, LockIcon, RoundsIcon } from './icons';

/** A one-off line handed over in router state, e.g. after account deletion (#54). */
function noticeOf(state: unknown): string | null {
  if (typeof state !== 'object' || state === null || !('notice' in state)) return null;
  return typeof state.notice === 'string' ? state.notice : null;
}

const DESTINATIONS = [
  'Chakrata',
  'Rishikesh',
  'Pushkar',
  'Almora',
  'Lansdowne',
  'Bikaner',
  'Mukteshwar',
  'Dhanaulti',
  'Vrindavan',
  'Ranthambore',
];

const STEPS = [
  {
    title: 'Start a trip',
    text: 'Pick the starting city, the nights and a group budget, then share one invite link.',
  },
  {
    title: 'Everyone answers',
    text: 'Places, activities, climate, budget and dates. Only you see your answers; the group sees totals.',
  },
  {
    title: 'Shortlist and vote',
    text: 'A ranked list of places every member can do. Everyone votes; the organiser makes the call.',
  },
  {
    title: 'Packages and a plan',
    text: 'Saver to Comfort, costed in rupees, then a day-wise plan built from checked catalogue facts.',
  },
];

const FAIRNESS = [
  {
    icon: <LockIcon />,
    title: 'Your budget stays yours',
    text: "Budget figures appear only once 3 or more people have answered, and the group's spend is rounded to ₹500.",
  },
  {
    icon: <RoundsIcon />,
    title: 'Fair across rounds',
    text: 'Ask again and the next round gives more weight to members whose wishes were met less in earlier rounds.',
  },
  {
    icon: <CompassIcon />,
    title: 'Honest when nothing fits',
    text: 'You see the closest misses and one change that would open them up, instead of a blank page.',
  },
];

const MISSES = [
  ['Bikaner', '₹6,860'],
  ['Mathura', '₹7,836'],
  ['Vrindavan', '₹8,008'],
];

const eyebrow =
  'inline-block rounded-full border-2 border-ink px-3 py-1 text-xs font-bold uppercase tracking-wider';

/** A homepage section that rises in once it scrolls into view. */
function RevealSection({
  id,
  labelledBy,
  className,
  children,
}: {
  id?: string;
  labelledBy: string;
  className: string;
  children: ReactNode;
}) {
  const ref = useReveal<HTMLElement>();
  return (
    <section ref={ref} id={id} aria-labelledby={labelledBy} className={`reveal ${className}`}>
      {children}
    </section>
  );
}

function Marquee() {
  const list = (hidden: boolean) => (
    <ul
      aria-hidden={hidden || undefined}
      aria-label={hidden ? undefined : 'Some of the destinations'}
      className="flex shrink-0 items-center"
    >
      {DESTINATIONS.map((name, i) => (
        <li key={name} className="flex items-center">
          <span className="px-6 font-display text-[34px] font-extrabold tracking-tight text-cream">
            {name}
          </span>
          <span aria-hidden="true" className={`text-2xl ${i % 2 ? 'text-mint' : 'text-accent'}`}>
            ✺
          </span>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="overflow-hidden border-y-[2.5px] border-ink bg-brand-700 py-4">
      <div className="animate-marquee flex w-max">
        {list(false)}
        {list(true)}
      </div>
    </div>
  );
}

export function LandingPage() {
  useDocumentTitle('Welcome');
  const me = useMe();
  const location = useLocation();
  const navigate = useNavigate();
  // Read once, then drop it from the history entry: router state survives a
  // reload, and the notice must show only once.
  const [notice] = useState(() => noticeOf(location.state));
  useEffect(() => {
    if (noticeOf(location.state)) void navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  if (me.data) return <Navigate to="/trips" replace />;

  return (
    <>
      <section aria-labelledby="hero-heading" className="overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-12 lg:grid-cols-2 lg:py-20">
          <div>
            {notice ? (
              <div className="mb-6 max-w-md">
                <Alert tone="success">{notice}</Alert>
              </div>
            ) : null}
            <p className="animate-rise inline-block rounded-full border-2 border-ink bg-mint px-3 py-1 text-sm font-bold">
              For groups who can never agree on where to go
            </p>
            <h1
              id="hero-heading"
              className="animate-rise mt-6 text-5xl leading-[1.05] [animation-delay:0.1s] sm:text-6xl"
            >
              Group trips,{' '}
              <span className="animate-pop inline-block -rotate-2 rounded-2xl border-[2.5px] border-ink bg-accent px-3 shadow-sticker-chip">
                decided
              </span>{' '}
              together.
            </h1>
            <p className="animate-rise mt-6 max-w-xl text-lg text-muted [animation-delay:0.2s]">
              Everyone answers one short form in private. BonVoyage ranks the places the whole group
              can actually do, then builds costed packages and a day-wise plan, all in rupees.
            </p>
            <div className="animate-rise mt-8 flex flex-col gap-4 [animation-delay:0.3s] sm:flex-row">
              <ButtonLink to="/sign-up">
                Plan a group trip
                <ArrowIcon />
              </ButtonLink>
              <ButtonLink to="/sign-in" variant="secondary">
                Sign in
              </ButtonLink>
            </div>
            <p className="animate-rise mt-5 text-sm text-muted [animation-delay:0.4s]">
              Up to 8 people a trip. Starting from Gurugram, Delhi, Noida, Faridabad, Jaipur or
              Chandigarh.
            </p>
          </div>
          <HeroCollage />
        </div>
      </section>

      <Marquee />

      <RevealSection id="how" labelledBy="how-heading" className="mx-auto max-w-6xl px-4 py-16">
        <p className={`${eyebrow} bg-accent`}>How it works</p>
        <h2 id="how-heading" className="mt-4 max-w-2xl text-4xl">
          From group chat chaos to a booked plan in four steps.
        </h2>
        <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="rounded-3xl border-[2.5px] border-ink bg-white p-6 shadow-sticker transition-[translate,rotate] duration-200 motion-safe:hover:-translate-y-1 motion-safe:hover:-rotate-1"
            >
              <span
                aria-hidden="true"
                className={`flex h-12 w-12 items-center justify-center rounded-xl border-2 border-ink font-display text-lg font-extrabold ${
                  i % 2 ? 'bg-mint' : 'bg-accent'
                }`}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-4 font-display text-xl font-extrabold tracking-tight">
                {step.title}
              </h3>
              <p className="mt-2 text-sm text-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </RevealSection>

      <RevealSection
        id="fair"
        labelledBy="fair-heading"
        className="border-y-[2.5px] border-ink bg-ink text-white"
      >
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-mint">Why it is fair</p>
            <h2 id="fair-heading" className="mt-4 text-4xl">
              Nobody gets steamrolled. Not even the quiet one.
            </h2>
            <ul className="mt-8 space-y-6">
              {FAIRNESS.map((row) => (
                <li key={row.title} className="flex gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-mint text-mint">
                    {row.icon}
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-extrabold tracking-tight">
                      {row.title}
                    </h3>
                    <p className="mt-1 text-sm text-white/80">{row.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="rotate-[-1.5deg] rounded-3xl border-[2.5px] border-ink bg-cream p-6 text-ink shadow-sticker-accent">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Tight budget</p>
            <p className="mt-1 font-display text-2xl font-extrabold tracking-tight">
              No destination fits yet
            </p>
            <p className="mt-4 text-sm font-semibold">Closest misses</p>
            <ul className="mt-2 space-y-2 text-sm">
              {MISSES.map(([place, over]) => (
                <li
                  key={place}
                  className="flex justify-between rounded-xl border-2 border-ink bg-white px-3 py-2"
                >
                  <span>{place}</span>
                  <span className="font-semibold">{over} over</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 rounded-2xl border-[2.5px] border-ink bg-accent px-4 py-3 text-sm font-bold shadow-sticker-chip">
              Raise the group budget to ₹15,500
            </p>
            <p className="mt-3 text-sm text-muted">
              This adds Bikaner, Mathura, Pushkar, Rishikesh and Vrindavan.
            </p>
          </div>
        </div>
      </RevealSection>

      <RevealSection labelledBy="cta-heading" className="border-b-[2.5px] border-ink bg-accent">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 id="cta-heading" className="text-4xl text-ink">
              Your group chat has argued long enough.
            </h2>
            <p className="mt-2 text-lg text-ink">
              Start a trip, send the link, and let the shortlist do the arguing.
            </p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Link
              to="/sign-up"
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border-[2.5px] border-ink bg-ink px-5 text-sm font-bold text-cream shadow-sticker-button transition-[translate,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-sticker-lift active:translate-x-0.5 active:translate-y-0.5 active:shadow-sticker-press"
            >
              Create an account
            </Link>
            <ButtonLink to="/sign-in" variant="secondary">
              Sign in
            </ButtonLink>
          </div>
        </div>
      </RevealSection>
    </>
  );
}
