import { randomBytes } from 'node:crypto';
import { importCatalogue } from '@bonvoyage/db';
import type { Db } from '@bonvoyage/db';
import {
  destination,
  fareFallback,
  hub,
  invitation,
  itinerary,
  itineraryDecision,
  itineraryItem,
  notification,
  packageDecision,
  pastTrip,
  poi,
  preference,
  recommendationItem,
  recommendationRun,
  costItem,
  costRule,
  trip,
  tripMember,
  tripPackage,
  tripTransition,
  userProfile,
} from '@bonvoyage/db/schema';
import { account, session, user, verification } from '@bonvoyage/db/schema/auth';
import { distanceCache, providerUsage } from '@bonvoyage/db/schema';
import { indiaDate, type PreferenceInput } from '@bonvoyage/shared';
import { and, eq, sql } from 'drizzle-orm';
import { pino } from 'pino';
import type { Auth } from '../auth/auth';
import { saveMyPreference } from '../preferences/service';
import { transitionTrip } from '../trips/transition-trip';
import { DEMO_SCENARIOS, seedDemoTrip } from './demo-trips';
import { clearRebuildNotifications, deleteDemoTrips } from './fresh-demos';

// S0-5 step 6: demo seed. Every step is idempotent so the seed can run again
// without duplicating anything. Prints row counts, never the password.

const DEMO_USERS = [
  { name: 'Asha', role: 'organiser' },
  { name: 'Rohan', role: 'member' },
  { name: 'Meera', role: 'member' },
  { name: 'Kabir', role: 'member' },
] as const;

const TRIP_TITLE = 'Long weekend in the hills';
const TODAY = () => new Date().toISOString().slice(0, 10);

const demoEmail = (name: string) => `${name.toLowerCase()}@demo.bonvoyage.test`;

export interface SeedOptions {
  db: Db;
  auth: Auth;
  catalogueDir: string;
  password: string;
  /** S3-8: delete every demo-organised trip first, so each is built fresh. */
  freshDemos?: boolean;
  /** Where progress lines go; defaults to stdout (the seed is a CLI step). */
  log?: (line: string) => void;
}

const stdout = (line: string) => {
  process.stdout.write(`${line}\n`);
};

async function tableCounts(db: Db): Promise<Record<string, number>> {
  const tables = {
    user,
    session,
    account,
    verification,
    user_profile: userProfile,
    hub,
    destination,
    poi,
    fare_fallback: fareFallback,
    cost_rule: costRule,
    distance_cache: distanceCache,
    provider_usage: providerUsage,
    trip,
    trip_member: tripMember,
    invitation,
    trip_transition: tripTransition,
    preference,
    past_trip: pastTrip,
    recommendation_run: recommendationRun,
    recommendation_item: recommendationItem,
    trip_package: tripPackage,
    cost_item: costItem,
    package_decision: packageDecision,
    itinerary,
    itinerary_item: itineraryItem,
    itinerary_decision: itineraryDecision,
    notification,
  } as const;
  const counts: Record<string, number> = {};
  for (const [name, table] of Object.entries(tables)) {
    const rows = await db.select({ n: sql<number>`count(*)::int` }).from(table);
    counts[name] = rows[0]?.n ?? 0;
  }
  return counts;
}

export async function runSeed({
  db,
  auth,
  catalogueDir,
  password,
  freshDemos = false,
  log = stdout,
}: SeedOptions): Promise<void> {
  const today = TODAY();

  // a) catalogue
  const counts = await importCatalogue(db, catalogueDir, { today });
  const imported = Object.entries(counts.inserted)
    .map(([t, n]) => `${t} +${n}`)
    .join(', ');
  log(`catalogue: ${imported}`);

  // a2) S3-8: --fresh-demos removes the used demo trips; the steps below
  // rebuild them exactly as a first seed does.
  if (freshDemos) {
    const deleted = await deleteDemoTrips(db);
    log(`\nFresh demos: deleted ${deleted.length} demo trip${deleted.length === 1 ? '' : 's'}:`);
    for (const t of deleted) log(`  ${t.title} (was ${t.status})`);
  }

  // b) demo users
  const userIds = new Map<string, string>();
  for (const { name } of DEMO_USERS) {
    const email = demoEmail(name);
    const existing = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);
    if (existing[0]) {
      userIds.set(name, existing[0].id);
      continue;
    }
    const result = await auth.api.signUpEmail({
      body: { email, password, name: `${name} (demo)` },
      headers: { host: 'localhost:4000', origin: 'http://localhost:4000' },
    });
    const id = (result as { user?: { id: string } }).user?.id;
    if (!id) throw new Error(`signUpEmail failed for ${email}`);
    userIds.set(name, id);
  }

  // c) user_profile with home hub gurugram
  const gurugram = (
    await db.select({ id: hub.id }).from(hub).where(eq(hub.slug, 'gurugram')).limit(1)
  )[0];
  if (!gurugram) throw new Error('gurugram hub missing after catalogue import');
  for (const { name } of DEMO_USERS) {
    await db
      .insert(userProfile)
      .values({ userId: userIds.get(name)!, homeHubId: gurugram.id })
      .onConflictDoNothing({ target: userProfile.userId });
  }

  // d) the demo trip
  const asha = userIds.get('Asha')!;
  let tripId = (
    await db
      .select({ id: trip.id })
      .from(trip)
      .where(and(eq(trip.organiserId, asha), eq(trip.title, TRIP_TITLE)))
      .limit(1)
  )[0]?.id;
  if (!tripId) {
    tripId = (
      await db
        .insert(trip)
        .values({
          title: TRIP_TITLE,
          organiserId: asha,
          originHubId: gurugram.id,
          durationNights: 2,
          budgetTotalInr: 48000,
          radiusKm: 450,
        })
        .returning({ id: trip.id })
    )[0]!.id;
    // T1 createTrip: audit row from null to draft.
    await db.insert(tripTransition).values({
      tripId,
      transitionId: 'T1',
      event: 'createTrip',
      fromStatus: null,
      toStatus: 'draft',
      actorUserId: asha,
    });
  }

  // e) members: Asha (organiser), Rohan and Meera. Kabir stays outside.
  for (const { name, role } of DEMO_USERS.filter((u) => u.name !== 'Kabir')) {
    await db
      .insert(tripMember)
      .values({ tripId, userId: userIds.get(name)!, role })
      .onConflictDoNothing({ target: [tripMember.tripId, tripMember.userId] });
  }

  // S1-6: the seed follows the state machine like the app does. T2 opens the
  // trip once; a re-seed sees it already open and skips.
  const deps = { db, logger: pino({ level: 'silent' }), clock: () => new Date() };
  const [demo] = await db.select({ status: trip.status }).from(trip).where(eq(trip.id, tripId));
  if (demo!.status === 'draft') {
    await transitionTrip(deps, { tripId, event: 'inviteMembers', actorUserId: asha });
  }

  // f) Asha and Rohan submit through the same preference service the API
  // uses, so each submission writes an I1 row; Meera stays pending. Dates are
  // relative to today so the server's "from today" check always passes.
  const inDays = (n: number) => indiaDate(new Date(Date.now() + n * 86_400_000));
  const prefs: { name: string; input: PreferenceInput }[] = [
    {
      name: 'Asha',
      input: {
        destinationTypes: ['mountain', 'adventure'],
        activities: ['trekking', 'rafting', 'camping'],
        climate: 'cold',
        travelStyle: 'budget',
        budgetMinInr: 12000,
        budgetMaxInr: 18000,
        dateStart: inDays(31),
        dateEnd: inDays(34),
      },
    },
    {
      name: 'Rohan',
      input: {
        destinationTypes: ['spiritual', 'mountain'],
        activities: ['yoga_wellness', 'temples', 'trekking'],
        climate: 'mild',
        travelStyle: 'comfort',
        budgetMinInr: 10000,
        budgetMaxInr: 16000,
        dateStart: inDays(30),
        dateEnd: inDays(33),
      },
    },
  ];
  for (const { name, input } of prefs) {
    const userId = userIds.get(name)!;
    const [m] = await db
      .select({ submittedAt: tripMember.submittedAt })
      .from(tripMember)
      .where(and(eq(tripMember.tripId, tripId), eq(tripMember.userId, userId)))
      .limit(1);
    if (m?.submittedAt === null) await saveMyPreference(deps, tripId, userId, input);
  }

  // g) one active invitation
  const hasInvite = (
    await db
      .select({ id: invitation.id })
      .from(invitation)
      .where(and(eq(invitation.tripId, tripId), eq(invitation.status, 'active')))
      .limit(1)
  )[0];
  if (!hasInvite) {
    await db.insert(invitation).values({
      tripId,
      token: randomBytes(24).toString('base64url'),
      createdBy: asha,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
  }

  // h) one past_trip for Asha: rishikesh, rating 5
  const rishikesh = (
    await db
      .select({ id: destination.id })
      .from(destination)
      .where(eq(destination.slug, 'rishikesh'))
      .limit(1)
  )[0];
  const hasPast = (
    await db
      .select({ id: pastTrip.id })
      .from(pastTrip)
      .where(
        and(
          eq(pastTrip.userId, asha),
          rishikesh
            ? eq(pastTrip.destinationId, rishikesh.id)
            : eq(pastTrip.placeName, 'Rishikesh'),
        ),
      )
      .limit(1)
  )[0];
  if (!hasPast) {
    await db.insert(pastTrip).values({
      userId: asha,
      destinationId: rishikesh?.id ?? null,
      placeName: rishikesh ? null : 'Rishikesh',
      rating: 5,
    });
  }

  // i) S2-8: the three Sprint 2 demo trips, through the services only.
  const scenarioTripIds: string[] = [];
  for (const scenario of DEMO_SCENARIOS) {
    scenarioTripIds.push(await seedDemoTrip(deps, scenario, userIds));
  }

  // j) --fresh-demos only: the rebuild's joins do not count as news. Kabir is in no trip.
  if (freshDemos) {
    const cleared = await clearRebuildNotifications(
      db,
      DEMO_USERS.filter((u) => u.name !== 'Kabir').map((u) => userIds.get(u.name)!),
      [tripId, ...scenarioTripIds],
    );
    log(
      `\nFresh demos: cleared ${cleared} notification${cleared === 1 ? '' : 's'} from the rebuild.`,
    );
  }

  const rows = await tableCounts(db);
  log('\nRow counts:');
  for (const [table, n] of Object.entries(rows)) log(`  ${table}: ${n}`);
  const trips = await db
    .select({ title: trip.title, status: trip.status })
    .from(trip)
    .where(eq(trip.organiserId, asha))
    .orderBy(trip.createdAt);
  log(freshDemos ? '\nDemo trips created:' : '\nDemo trips:');
  for (const t of trips) log(`  ${t.title}: ${t.status}`);
  log('\nDemo sign-ins (password is never printed):');
  for (const { name } of DEMO_USERS) log(`  ${demoEmail(name)}`);
}
