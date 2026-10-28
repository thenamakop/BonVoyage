import { resolve } from 'node:path';
import { createDb, importCatalogue } from '@bonvoyage/db';
import { tripTransition } from '@bonvoyage/db/schema';
import {
  indiaDate,
  InvitationResponse,
  ItineraryAlternativesResponse,
  ItineraryResponse,
  PackagesResponse,
  PLANNING_STATUSES,
  RequestRecommendationsResponse,
  TripDetail,
  type TripActionName,
} from '@bonvoyage/shared';
import { asc, eq } from 'drizzle-orm';
import { pino } from 'pino';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { createAuth } from '../auth/auth';
import { HILLS_DEMO } from '../seed/demo-trips';
import { createTestUser } from '../test/helpers';

// S3-8 (R2, R8, R12, R13, R15): the whole journey over HTTP, from sign-up to a
// finalised trip, with three new users and the hills demo's preferences
// against the real catalogue. Every transition is asserted in order, and the
// dashboard's step and next action at each stage. Slow steps print their time.

const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const auth = createAuth({
  db,
  secret: 'test-secret-test-secret-test-secret',
  baseURL: { allowedHosts: ['localhost:5173', 'localhost:4000', '*.vercel.app'] },
});
const app = createApp({ db, pool, logger: pino({ level: 'silent' }), auth });
const H = { Host: 'localhost:5173', Origin: 'http://localhost:5173' };

const inDays = (n: number) => indiaDate(new Date(Date.now() + n * 86_400_000));

beforeAll(async () => {
  await importCatalogue(db, resolve(import.meta.dirname, '../../../../packages/db/catalogue'), {
    today: indiaDate(new Date()),
  });
});
afterAll(() => pool.end());

/** The dashboard's "Step n of 7" (StatusBanner): planning index + 1, finalised is 7. */
const stepOf = (status: string) =>
  status === 'finalised' ? 7 : (PLANNING_STATUSES as readonly string[]).indexOf(status) + 1;

async function dashboard(agent: request.Agent, tripId: string) {
  const res = await agent.get(`/api/trips/${tripId}`).set(H);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  const detail = TripDetail.parse(res.body);
  return {
    status: detail.status,
    step: stepOf(detail.status),
    actions: detail.availableActions.filter((a) => a.enabled).map((a) => a.action),
  };
}

/** The dashboard is at `step` and offers each of `actions`. */
async function expectDashboard(
  agent: request.Agent,
  tripId: string,
  step: number,
  actions: TripActionName[],
) {
  const view = await dashboard(agent, tripId);
  expect(view.step, view.status).toBe(step);
  expect(view.actions).toEqual(expect.arrayContaining(actions));
  return view;
}

async function timed<T>(label: string, run: () => Promise<T>): Promise<T> {
  const started = performance.now();
  const result = await run();
  process.stdout.write(
    `full journey: ${label} took ${Math.round(performance.now() - started)} ms\n`,
  );
  return result;
}

describe('full journey, end to end', () => {
  it('sign-up to a finalised trip, T1 to T14 in order, with a Remove and a Swap on the day plan', async () => {
    const people = [];
    for (const m of HILLS_DEMO.members) {
      people.push({ input: m.input(inDays), ...(await createTestUser(app, `Journey ${m.name}`)) });
    }
    const [organiser, ...members] = people;
    if (!organiser || members.length !== 2) throw new Error('the journey needs three people');
    const asha = organiser.agent;

    // T1: create the trip (step 1, Draft).
    const created = await asha.post('/api/trips').set(H).send({
      title: 'Full journey',
      originHubSlug: 'gurugram',
      durationNights: HILLS_DEMO.durationNights,
      budgetTotalInr: HILLS_DEMO.budgetTotalInr,
      radiusKm: HILLS_DEMO.radiusKm,
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const tripId = TripDetail.parse(created.body).id;
    await expectDashboard(asha, tripId, 1, ['invite', 'editDetails']);

    // T2: the invite link (step 2, Collecting preferences); both members join.
    const invite = await asha.post(`/api/trips/${tripId}/invitations`).set(H).send({});
    expect(invite.status, JSON.stringify(invite.body)).toBe(201);
    const { token } = InvitationResponse.parse(invite.body);
    for (const m of members) {
      const joined = await m.agent.post(`/api/invitations/${token}/accept`).set(H).send({});
      expect(joined.status, JSON.stringify(joined.body)).toBe(200);
    }
    await expectDashboard(asha, tripId, 2, ['invite', 'editPreferences']);
    await expectDashboard(members[0]!.agent, tripId, 2, ['editPreferences', 'leaveTrip']);

    // I1, I1, then T3 on the last submission (step 3, Ready for recommendations).
    for (const p of people) {
      const res = await p.agent.put(`/api/trips/${tripId}/preferences/me`).set(H).send(p.input);
      expect(res.status, JSON.stringify(res.body)).toBe(200);
    }
    await expectDashboard(asha, tripId, 3, ['requestRecommendations']);

    // T6>T7: the shortlist (step 4, Shortlisted).
    const rec = await timed('recommend', () =>
      asha.post(`/api/trips/${tripId}/recommendations`).set(H).send({}),
    );
    expect(rec.status, JSON.stringify(rec.body)).toBe(200);
    const run = RequestRecommendationsResponse.parse(rec.body);
    expect(run.transition).toEqual({ transitionId: 'T6>T7', to: 'shortlisted' });
    await expectDashboard(asha, tripId, 4, ['viewRecommendations', 'chooseDestination']);
    const memberView = await dashboard(members[0]!.agent, tripId);
    expect(memberView.actions).not.toContain('chooseDestination');

    // T9: choose the top place; its packages are built (step 5, Packages proposed).
    const top = run.items[0]!.destination;
    const chosen = await timed('choose a destination', () =>
      asha.post(`/api/trips/${tripId}/destination`).set(H).send({ destinationSlug: top.slug }),
    );
    expect(chosen.status, JSON.stringify(chosen.body)).toBe(200);
    expect(TripDetail.parse(chosen.body).selectedDestination?.slug).toBe(top.slug);
    await expectDashboard(asha, tripId, 5, ['viewPackages', 'choosePackage']);
    await expectDashboard(members[0]!.agent, tripId, 5, ['viewPackages', 'givePackageOpinion']);

    const list = PackagesResponse.parse(
      (await asha.get(`/api/trips/${tripId}/packages`).set(H)).body,
    );
    expect(list.packages.length).toBeGreaterThanOrEqual(3);
    const saver = list.packages.find((p) => p.label === 'Saver');
    if (!saver) throw new Error('no Saver package');

    // Opinions: each member says the Saver works; each sees only their own.
    for (const m of members) {
      const res = await m.agent
        .put(`/api/trips/${tripId}/packages/${saver.id}/opinion`)
        .set(H)
        .send({ decision: 'accept' });
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(PackagesResponse.parse(res.body).packages.find((p) => p.id === saver.id)?.mine).toBe(
        'accept',
      );
    }
    const counted = PackagesResponse.parse(
      (await asha.get(`/api/trips/${tripId}/packages`).set(H)).body,
    ).packages.find((p) => p.id === saver.id);
    expect(counted).toMatchObject({ opinions: { works: 2, notForMe: 0, members: 3 }, mine: null });

    // T11: choose the Saver (step 6, Package selected).
    const selected = await asha
      .post(`/api/trips/${tripId}/packages/${saver.id}/select`)
      .set(H)
      .send({});
    expect(selected.status, JSON.stringify(selected.body)).toBe(200);
    expect(TripDetail.parse(selected.body).selectedPackage?.label).toBe('Saver');
    await expectDashboard(asha, tripId, 6, ['planDays']);

    // T12: plan the days (step 7, Itinerary proposed).
    const planned = await timed('plan the days', () =>
      asha.post(`/api/trips/${tripId}/itinerary`).set(H).send({}),
    );
    expect(planned.status, JSON.stringify(planned.body)).toBe(200);
    const plan = ItineraryResponse.parse(planned.body).itinerary!;
    expect(plan.status).toBe('proposed');
    await expectDashboard(asha, tripId, 7, [
      'viewItinerary',
      'acceptItinerary',
      'rejectItinerary',
      'modifyItinerary',
    ]);
    await expectDashboard(members[0]!.agent, tripId, 7, ['viewItinerary']);

    // I5 twice: Remove one visit, Swap another for a place that fits.
    const visits = plan.days.flatMap((d) => d.items).filter((i) => i.kind === 'activity');
    const [removed, swapped] = visits;
    if (!removed || !swapped) throw new Error('the day plan needs at least two visits');
    const afterRemove = await asha
      .patch(`/api/trips/${tripId}/itinerary/items/${removed.id}`)
      .set(H)
      .send({ action: 'remove' });
    expect(afterRemove.status, JSON.stringify(afterRemove.body)).toBe(200);
    const alternatives = ItineraryAlternativesResponse.parse(
      (await asha.get(`/api/trips/${tripId}/itinerary/items/${swapped.id}/alternatives`).set(H))
        .body,
    );
    const swapTo = alternatives.places[0];
    if (!swapTo) throw new Error('no place fits the swapped visit');
    const afterSwap = await asha
      .patch(`/api/trips/${tripId}/itinerary/items/${swapped.id}`)
      .set(H)
      .send({ action: 'replace', placeKey: swapTo.key });
    expect(afterSwap.status, JSON.stringify(afterSwap.body)).toBe(200);
    const items = ItineraryResponse.parse(afterSwap.body).itinerary!.days.flatMap((d) => d.items);
    expect(items.find((i) => i.id === removed.id)?.kind).toBe('free');
    expect(items.find((i) => i.id === swapped.id)?.place?.key).toBe(swapTo.key);
    await expectDashboard(asha, tripId, 7, ['acceptItinerary']);

    // T14: accept; the trip is finalised and planning actions are gone.
    const accepted = await asha.post(`/api/trips/${tripId}/itinerary/accept`).set(H).send({});
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(200);
    const done = await expectDashboard(asha, tripId, 7, ['viewItinerary']);
    expect(done.status).toBe('finalised');
    expect(done.actions).not.toContain('acceptItinerary');
    expect(done.actions).not.toContain('modifyItinerary');

    const transitions = await db
      .select({ id: tripTransition.transitionId })
      .from(tripTransition)
      .where(eq(tripTransition.tripId, tripId))
      .orderBy(asc(tripTransition.createdAt), asc(tripTransition.id));
    expect(transitions.map((t) => t.id)).toEqual([
      'T1',
      'T2',
      'I1',
      'I1',
      'T3',
      'T6>T7',
      'T9',
      'T11',
      'T12',
      'I5',
      'I5',
      'T14',
    ]);
  });
});
