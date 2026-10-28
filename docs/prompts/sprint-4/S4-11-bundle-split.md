# S4-11: Split the web bundle

`pnpm build` warns that the web bundle (596 kB) is above Vite's 500 kB chunk limit. Every screen is imported eagerly in `apps/web/src/routes.tsx`. Lazy-loading the trip and admin screens removes the warning and speeds up the first load of the start page.

**Branch:** `perf/124-split-bundle` · **Time box:** 45 minutes · **Depends on:** S4-5 merged · **Issue:** #124 · **Tests:** web only · **Cut:** first

```text
S4-11  SPLIT THE WEB BUNDLE (LAZY-LOAD THE TRIP AND ADMIN SCREENS)
Branch: perf/124-split-bundle (from fresh master)   Time box: 45 minutes
Issue: the "Web: split the 596 kB bundle" issue. Follow the Sprint 4 conventions (Q1 to Q10).

CONTEXT
Read apps/web/src/routes.tsx (every page imported at the top), apps/web/vite.config.ts,
apps/web/src/components/app/AppShell.tsx, src/components/ui (a Skeleton or loading component to
reuse) and the React Router version in apps/web/package.json (use its documented lazy route API,
route.lazy or React.lazy with Suspense, whichever the installed version supports; no new
dependency).

GOAL
pnpm build prints no chunk-size warning; the start, sign-in and sign-up pages load without the
trip screens; every route still works, including deep links and a reload on a trip page.

STEPS
1. Record pnpm --filter @bonvoyage/web build output (chunk sizes) before.
2. Lazy-load: the trip pages (TripPage, TripNewPage, TripEditPage, PreferencesPage, ShortlistPage,
   PackagesPage, ItineraryPage), ProfilePage and the admin CataloguePage. Keep LandingPage,
   SignInPage, SignUpPage, JoinPage, NotFound and the shells eager. Show the existing skeleton
   while a chunk loads; no layout jump at 360 px.
3. Only if a chunk is still over 500 kB: a manualChunks entry for the largest vendor in
   vite.config.ts, named and justified in the PR. Never raise chunkSizeWarningLimit.
4. Tests: the routes test (or a new one) renders each lazy route through the router and finds
   its heading; existing page tests unchanged.
5. With pnpm dev, open /, /trips, a trip, its packages and its day plan, reload each, and report
   any console error.
6. PR "perf: lazy-load the trip and admin screens", body "Closes #124" with the before and
   after chunk table.

VERIFICATION
Paste: the build output before and after; pnpm vitest run --project web ; the manual route check;
pnpm format:check; pnpm lint; pnpm typecheck; the CI result (and that the Vercel preview loads).

IF BLOCKED
A lazy route breaks auth redirects (RequireAuth) or the admin guard: stop and describe the case.
```
