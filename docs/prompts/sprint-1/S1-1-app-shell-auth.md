# S1-1: App shell, UI kit and sign-in

Gives the web app its look and its front door: design tokens, a small set of accessible components every later screen reuses, the header and footer, and the sign-up, sign-in and sign-out flow on top of the Better Auth server from S0-5. It also closes spike S4 by checking that a session survives on a real phone.

**Branch:** `feat/29-auth-screens` · **Time box:** 3 hours · **Depends on:** S1-8 merged · **Issue:** #29

```text
S1-1  APP SHELL, UI KIT AND SIGN-IN SCREENS
Branch: feat/29-auth-screens   Time box: 3 hours   Issue: #29

CONTEXT
Read AGENTS.md, docs/prompts/sprint-1/README.md (the Sprint 1 conventions: follow them), docs/wireframes/README.md with 01-sign-in.svg and the shared patterns, issue #29 (gh issue view 29) for its acceptance criteria, and docs/spikes for the S4 session notes. Look at apps/web as it stands: main.tsx, the Home page with the health panel, src/lib/api.ts (fetchJson, ApiError) and the Tailwind entry stylesheet.

The server side of auth exists (S0-5): Better Auth 1.7.7 at /api/auth with email and password, minPasswordLength 12, autoSignIn true, cookie prefix bonvoyage, 7-day sessions; GET /api/me returns { id, name, email, homeHubSlug } or 401 UNAUTHENTICATED. This task is web-only except for a shared schema. Do not change Better Auth's server options.

GOAL
A visitor at 360 px or on desktop can sign up, land on /trips, reload and stay signed in, sign out, and sign in again. Protected pages send a signed-out visitor to /sign-in and back to where they were afterwards. Every later screen can be built from src/components/ui without new styling decisions.

STEPS
1. Design tokens. In the Tailwind entry stylesheet (keep @import "tailwindcss"), add a @theme block:
     --color-brand-900 #0A1C26; --color-brand-700 #0D3A3D; --color-accent #F4A340; --color-accent-strong #D9832A; --color-mint #7FE3D8;
     --color-danger #B91C1C; --color-success #15803D; --color-warning #B45309;
     --font-sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif.
   Body text #111827 on white. A visible focus ring on every focusable element (2 px outline, offset 2 px, colour brand-700). Text on the accent colour is #111827, never white (contrast). Respect prefers-reduced-motion for any transition.

2. src/lib/format.ts: formatInr(amount) with Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }) (so 120000 gives ₹1,20,000), and formatDate(isoDate) giving "13 Nov 2026" (en-IN, timeZone Asia/Kolkata). Unit tests for both, including 0 and a seven-figure amount.

3. UI kit in src/components/ui/, exported from src/components/ui/index.ts. Each component is small, typed, styled with Tailwind only, and forwards the usual HTML props:
   - Button: variants primary (accent), secondary (outline), ghost, danger; full-width option; min-height 44 px; loading prop shows a Spinner, sets aria-busy and disables the button without changing its width. Also ButtonLink for react-router links that look like buttons.
   - TextField: label (always visible), hint, error; generates ids with useId; the input gets aria-invalid and aria-describedby pointing at the hint and error; the error line has an icon plus text.
   - Select: same contract as TextField for a native <select>.
   - ChipGroup: a <fieldset> with a <legend>, rendering native checkboxes styled as chips (multi-select), with the same hint and error contract on the fieldset.
   - RadioGroup: a <fieldset> of native radios, same contract.
   - Card, PageHeader (one <h1> plus an actions slot), Badge (always text; tones neutral, info, success, warning, danger), Alert (tones info, success, warning, error; error uses role="alert", the rest role="status"; icon plus text; optional action such as Retry), Spinner (role="status" with a visually hidden label), Skeleton, EmptyState (title, text, action).
   - A component test for TextField (the label is associated, the error is announced through aria-describedby) and for Button (loading disables and keeps the label for screen readers).

4. Shared schemas in packages/shared/src/api/auth.ts: MeResponse ({ id, name, email, homeHubSlug: string | null }), SignUpInput (name 1 to 80 trimmed, email, password 12 to 128) and SignInInput (email, password non-empty). Export from the shared index. The existing GET /api/me test now parses its response with MeResponse.

5. Auth client in src/lib/auth-client.ts: createAuthClient from "better-auth/react" with baseURL window.location.origin and basePath "/api/auth". Add better-auth to apps/web at exactly the version the API uses (1.7.7). Wrap the three calls the app needs (signUpEmail, signInEmail, signOut) so tests can vi.mock this one module.

6. Session state in src/features/auth/api.ts: useMe() is a TanStack Query on ["me"] calling fetchJson("/api/me", MeResponse); a 401 ApiError resolves to null (signed out) instead of an error; staleTime 60 s. Use useMe, not authClient.useSession, as the single source of truth for who is signed in.

7. src/lib/safe-next.ts: safeNext(value) returns the value only if it starts with "/" and not with "//" or "/\" (slash then backslash), and contains no scheme; otherwise "/trips". Unit tests for: "/trips/abc", "//evil.com", "https://evil.com", "/\evil.com", empty and missing.

8. Routing in src/routes.tsx with createBrowserRouter (data mode), rendered by RouterProvider in main.tsx inside the existing QueryClientProvider:
   - AppShell layout (all routes): a "Skip to content" link; a header with the product name linking to / (or /trips when signed in), a "Trips" link when signed in, and a user menu (a button with the user's name that opens a small menu with "Sign out"; keyboard operable, Escape closes it) or a "Sign in" link; <main id="content"> in a centred container with 16 px side padding; a footer with the health indicator (move the S0-2 health check here: polls /api/health every 60 s and shows "All systems normal" or "Service problem" as text plus a dot).
   - / Landing: when signed out, a short hero ("Group trips, decided together."), three plain benefit lines and buttons to sign up and sign in; when signed in, redirect to /trips.
   - /sign-up and /sign-in (redirect to /trips when already signed in).
   - RequireAuth, a layout route: while useMe loads, a centred Spinner; signed out, <Navigate> to /sign-in?next=<current path and search, encoded>; signed in, <Outlet>.
   - /trips inside RequireAuth: a placeholder page (PageHeader "Your trips" and an EmptyState). S1-2 replaces it.
   - * NotFound: "Page not found" and a link home (replaces any existing not-found page).
   - A useDocumentTitle(title) hook; every page sets "<Page> · BonVoyage".

9. Sign-up page (src/pages/Auth/SignUpPage.tsx), per wireframe 01:
   - Fields name, email, password (with a Show or Hide toggle button using aria-pressed), hint "At least 12 characters". Check with SignUpInput before sending and show field errors; focus the first invalid field.
   - Submit calls signUpEmail; the button shows loading. On success, invalidate ["me"] and navigate to safeNext(next).
   - Map Better Auth's error codes (read them from the installed package, for example the user-exists and password-length codes) to field errors: email "An account with this email already exists. Sign in instead." with a link; password for length. Anything else: an error Alert "We could not create your account. Try again." The form keeps what the user typed.
   - Below the form: "Already have an account? Sign in" (carrying next).

10. Sign-in page: email and password; the invalid-credentials code gives one Alert "Email or password is incorrect." (never say which). Success as in step 9. "New here? Create an account" carrying next.

11. Sign-out: the user menu item calls signOut, then queryClient.clear() and navigates to /. If signOut fails, show an error Alert and stay signed in.

12. Tests (web project; mock src/lib/auth-client with vi.mock and fetch with vi.stubGlobal):
   - SignUpPage: a short password shows the length message and sends nothing; a valid submit calls signUpEmail with the trimmed values and navigates to the next path; the user-exists error shows on the email field.
   - SignInPage: invalid credentials show the alert and keep the email.
   - RequireAuth: signed out redirects to /sign-in?next=%2Ftrips; signed in renders the child.
   - UserMenu: Sign out calls signOut and clears the cache.
   - Use @testing-library/react and @testing-library/user-event (add user-event at the root if it is missing).

13. Docs: docs/traceability.md gains the new test files on R1 and R10. AGENTS.md gets one line in the web section: "UI components live in apps/web/src/components/ui; use them before writing new markup."

14. Pull request "feat: app shell, UI kit and sign-in screens", body starting "Closes #29", with 360 px and desktop screenshots of landing, sign-up with an error, sign-in and the trips placeholder.

15. HAND OVER to Maulik after merge (spike S4, 10 minutes): on an Android phone in Chrome, open the production URL, sign up with a new test account, reload, close the tab, reopen it after 10 minutes, and confirm you are still signed in; then sign out and confirm /trips sends you to sign-in. Note the result, the phone model and the date in the docs/spikes S4 file in a small follow-up pull request ("docs: record spike S4 phone result", Refs #29).

VERIFICATION
Paste the real output of:
  pnpm test:unit
  pnpm vitest run --project web
  pnpm verify
Then with pnpm dev running, in a desktop browser and in device mode at 360 px:
  - sign up as a new user: you land on /trips; reload: still signed in
  - sign out, open http://localhost:5173/trips: you are sent to /sign-in?next=%2Ftrips; sign in as asha@demo.bonvoyage.test: you return to /trips
  - a 5-character password shows the length error; a duplicate email shows the email error
  - http://localhost:5173/sign-in?next=//evil.com then sign in: you land on /trips
  - keyboard only: Tab reaches every control in order with a visible focus ring; the user menu opens with Enter and closes with Escape
  - stop the API: the footer says "Service problem" within 60 s
Report: the components created, the Better Auth error codes you mapped, screenshots, deviations.

IF BLOCKED
- better-auth/react does not export createAuthClient in 1.7.7: use the client from "better-auth/client" and keep the wrapper's API the same. Never upgrade Better Auth in this task.
- The cookie is not stored in dev: check the request goes through the Vite proxy on port 5173 (not straight to 4000) and that Host and Origin are localhost:5173. Never disable Better Auth's origin check or add CORS.
- Tailwind ignores @theme: confirm the stylesheet is the one Vite imports and that @import "tailwindcss" comes first.
- React Router's data-mode API differs from this prompt in the installed version: follow its docs for that version and keep the route paths above.
- Anything here seems to need an API change other than the shared schema: stop and ask.
```
