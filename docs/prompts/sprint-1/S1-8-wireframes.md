# S1-8: Wireframes, and commit these prompts

Draws every screen of the product as plain SVG wireframes, so each later prompt builds against a picture instead of a guess, and commits the Sprint 1 prompt files so agents can read the conventions from the repo. It changes no code, which is why it goes first.

**Branch:** `docs/36-wireframes` · **Time box:** 1.5 hours · **Depends on:** nothing · **Issue:** #36 · **Before pasting:** unzip the Sprint 1 prompts into `docs/prompts/sprint-1/` in your checkout (on this branch), so the folder holds `README.md` and the nine `S1-*.md` files

```text
S1-8  WIREFRAMES, AND COMMIT THE SPRINT 1 PROMPTS
Branch: docs/36-wireframes   Time box: 1.5 hours   Issue: #36

CONTEXT
Read AGENTS.md, docs/prompts/sprint-1/README.md (the Sprint 1 conventions; rule 9 is the UI rules), docs/baseline/BonVoyage_SRS_v1.1.md (sections 3.1.1, 3.3 and 3.5), docs/specs/scoring.md (the shortlist output and the empty-shortlist diagnostic), docs/decisions/0001 and 0003, and look at the diagrams in docs/design. docs/design is the frozen design baseline (tag design-baseline-v1): read it, never edit it.

Sprint 0 is merged: the schema, Better Auth, the trip state machine, the catalogue and the deploy. Sprint 1 builds the screens for signing in, trips, invitations, preferences and the dashboard; Sprints 2 to 4 build the shortlist, packages and itinerary. Issue #36 asks for the SRS 3.1.1 screens at 360 px and on desktop. These wireframes are the reference every later UI prompt points to, so content and states matter more than looks.

Fidelity: low to mid. Greyscale boxes, real labels, realistic sample data, one accent colour for the primary action. No photos, no icon sets, no brand artwork. Sample data comes from the demo seed: trip "Long weekend in the hills", origin Gurugram, 2 nights, group budget ₹48,000, radius 450 km, members Asha (organiser), Rohan and Meera; destinations such as Rishikesh, Mussoorie and Nainital.

GOAL
docs/wireframes/ holds hand-written SVG wireframes for every screen below at 360 x 780 (mobile), plus desktop versions at 1280 x 800 of the three data-heavy screens, and a README that maps each one to its route, sprint, requirements and states. docs/prompts/sprint-1/ is committed unchanged. Nothing outside docs/ changes.

STEPS
1. Commit the prompts first. docs/prompts/sprint-1/ already holds README.md and S1-1 to S1-9 (Maulik placed them). Confirm the ten files exist. If pnpm format:check complains about them, run prettier --write on that folder only: whitespace changes are fine, word changes are not. Commit as "docs: add Sprint 1 build prompts".

2. Read SRS 3.1.1 and write down its screen names. Map each onto the list in step 3 in the README table (step 6). If the SRS names a screen that is not in step 3, add a wireframe for it and tell me in the report.

3. Screens (file, route, sprint that builds it, what it must show):
   01-sign-in.svg        /sign-in and /sign-up   S1-1   Product name, short tagline, email, password (sign-up adds name and the hint "At least 12 characters"), primary button, link to the other form, an error alert slot above the form. Annotate the sign-up differences.
   02-trips.svg          /trips                  S1-2   Page header "Your trips" with a "New trip" button; trip cards with title, origin hub, nights, a status badge in words ("Collecting preferences"), member count and an "Organiser" tag; an inset showing the empty state ("No trips yet" plus the create button).
   03-trip-new.svg       /trips/new              S1-2   Title, origin hub select, nights (1 to 14), group budget in rupees with the helper "Total for the whole group", search radius in km with a helper, Create button; one field shown in its error state (red border plus message text plus icon, never colour alone).
   04-join.svg           /join/:token            S1-3   Trip title, "Asha invited you", "3 of 8 members", what joining shares ("Your answers are visible only to you; the group sees totals"), Join button. Insets: signed-out ("Sign in to join", returns here after sign-in) and expired or closed link.
   05-preferences.svg    /trips/:id/preferences  S1-4   Destination type chips, activity chips, climate (cold, mild, warm, any), travel style (budget, comfort, premium), budget minimum and maximum in rupees per person for the whole trip, available dates (from, to), Submit. A note "You can change this until the shortlist is made". The budget maximum shown with its error "Maximum must be at least the minimum".
   06-dashboard.svg      /trips/:id              S1-5   Status banner with a plain explanation ("Waiting for preferences: 2 of 3 submitted"), trip parameters (origin, nights, group budget plus "about ₹16,000 each", radius), a progress bar with the same words as text, roster chips with "Submitted" or "Waiting" in words, a next-step callout, organiser actions (Copy invite link, Close submissions with the reason it is disabled when fewer than 2 have submitted, Cancel trip), and "Updated 5 seconds ago".
   07-shortlist.svg      /trips/:id/shortlist    S2     Ranked destination cards: rank, name, road distance with its source ("curated road distance"), estimated cost as group total plus per person with the word "estimate", the group-fit explanation in words ("Everyone rates this at least 6 out of 10"), two or three reasons, and the organiser's "Choose" button.
   08-shortlist-empty.svg  same route              S2     The empty-shortlist diagnostic: "Only 1 destination fits", the binding constraint in plain words (for example the budget overlap between members), and two or three suggested changes as buttons (widen radius, raise budget, change dates).
   09-packages.svg       /trips/:id/packages     S3     Two or three packages: transport mode, stay tier, rooms, dates, a cost breakdown (onward, return, stay, food, activities, local) where each line shows its provenance (curated, estimated), group total plus per person, an over-budget warning in words, Accept / Modify / Reject per member and the tally.
   10-itinerary.svg      /trips/:id/itinerary    S4     Day tabs; a timeline of items with time, kind (travel, stay, activity, meal, free), place and duration; travel legs shown as their own items; a tag per item for "From the catalogue" versus "Suggested"; a day summary; Accept and Request changes.
   Desktop (1280 x 800): 06-dashboard-desktop.svg, 09-packages-desktop.svg, 10-itinerary-desktop.svg, using two or three columns where it helps.
   Every screen except 01 and 04 has the app header (product name left, user menu right). Show one loading state (skeleton rows) and one error state (alert with Retry) somewhere, and say where in the README.

4. SVG rules:
   - Plain hand-written SVG with width, height and a matching viewBox; a <title> and a <desc> on each; no <image>, no external references, no scripts; each file under 40 KB. You may generate them with a throwaway script, but do not commit the script.
   - Font: font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"; sizes 12 to 20 px at mobile width, never smaller than 12.
   - Colours: greys #FFFFFF, #F3F4F6, #D1D5DB, #6B7280, #111827; header #0D3A3D with white text; primary buttons #F4A340 with #111827 text; error #B91C1C. Annotations are numbered magenta (#C026D3) circles so nobody mistakes them for UI.
   - Layout: 16 px side margins at 360 px; every tap target drawn at least 44 px tall; nothing wider than the frame (no horizontal scroll).
   - Words: British English (organiser, cancelled), sentence case, money as ₹48,000 with Indian grouping (₹1,20,000), escape & as &amp;.

5. Look at every file in a browser at 100 per cent zoom: no clipped or overlapping text, and the annotation numbers match the README.

6. docs/wireframes/README.md:
   - Purpose and fidelity (what these are and are not), and that docs/design remains the UML baseline.
   - A table: file, route, built in (S1-1, S2...), requirements (R ids from docs/traceability.md), states shown, SRS 3.1.1 screen name.
   - Each screen embedded with ![name](file.svg) followed by its numbered notes (one line per annotation).
   - "Shared patterns": app header, status badge words for all 11 trip statuses (from TRIP_STATUSES), money display (group total, per person, "estimate"), loading, empty and error states, the form error pattern, 44 px targets, 360 px.
   - Open questions, if any.

7. docs/traceability.md: add docs/wireframes/README.md to the design or notes column of every requirement a wireframe covers; if the table has no such column, add one line under the table: "Wireframes: docs/wireframes/README.md".

8. Pull request: title "docs: wireframes for the BonVoyage screens"; the body starts with "Closes #36" and contains the README table.

VERIFICATION
Paste the real output of:
  ls docs/wireframes docs/prompts/sprint-1          13 SVG files plus README.md; README.md plus 9 prompt files
  a short Node check (run with node -e or a temporary file you delete) that prints, for each SVG, its size in bytes and ok or FAIL for: has <title>, has viewBox, no <image, under 40960 bytes
  pnpm format:check
  pnpm verify
  git diff --stat master                         only docs/ paths
Report: the files created, the SRS 3.1.1 mapping, any screen added beyond step 3, and open questions.

IF BLOCKED
- SRS 3.1.1 lists screens that differ from step 3: draw the SRS ones as well and tell me which.
- Text does not fit at 360 px: shorten the sample text. Never go below 12 px.
- Prettier wants to change the prompt files beyond whitespace: stop and tell me.
- Short on time: commit the mobile screens 01 to 06 first (Sprint 1 needs them), then the rest; list what is missing in the report and open an issue "Wireframes: remaining screens" on the Sprint 2 milestone.
- Never edit docs/design, AGENTS.md or any code.
```
