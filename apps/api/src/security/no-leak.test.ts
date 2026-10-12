import { createDb } from '@bonvoyage/db';
import { pino } from 'pino';
import { InvitationResponse, TripDetail } from '@bonvoyage/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { createAuth } from '../auth/auth';
import { ENDPOINTS } from '../test/endpoint-inventory';
import { createTestUser, createTripAs, ensureHub } from '../test/helpers';

// S1-6 step 3 (R10, SRS 3.4): every GET endpoint, called by every kind of
// caller, is searched as raw text for anything private to another user.
// Each user carries values nothing else could produce by chance.

const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
const auth = createAuth({
  db,
  secret: 'test-secret-test-secret-test-secret',
  baseURL: { allowedHosts: ['localhost:5173', 'localhost:4000', '*.vercel.app'] },
});
const app = createApp({
  db,
  pool,
  logger: pino({ level: 'silent' }),
  auth,
  clock: () => new Date('2026-11-01T06:30:00Z'),
});
const H = { Host: 'localhost:5173', Origin: 'http://localhost:5173' };

type Agent = request.Agent;
interface Person {
  key: string;
  agent: Agent;
  userId: string;
  email: string;
  /** Private to this person: preference budgets and a past-trip name. */
  secrets: string[];
}

const prefs = (min: number, max: number) => ({
  destinationTypes: ['heritage'],
  activities: ['museums'],
  climate: 'warm',
  travelStyle: 'premium',
  budgetMinInr: min,
  budgetMaxInr: max,
  dateStart: '2026-11-13',
  dateEnd: '2026-11-16',
});

let people: Person[];
let tripId: string;
let token: string;
let outsiderTripBudget: string;

beforeAll(async () => {
  await ensureHub(db, 'test-hub');
  const make = async (key: string, name: string, min: number, max: number) => {
    const u = await createTestUser(app, name);
    await u.agent
      .post('/api/me/past-trips')
      .set(H)
      .send({ placeName: `Leaktest-${key}`, rating: 4 });
    return { key, ...u, min, max, secrets: [String(min), String(max), `Leaktest-${key}`] };
  };
  const asha = await make('Asha', 'Leak Asha', 111113, 123457);
  const rohan = await make('Rohan', 'Leak Rohan', 222227, 234571);
  const outsider = await make('Outsider', 'Leak Outsider', 333331, 345679);

  // Asha organises; Rohan joins; both submit. The outsider has a trip of their own.
  tripId = (await createTripAs(asha.agent, { budgetTotalInr: 48000, durationNights: 2 })).id;
  token = InvitationResponse.parse(
    (await asha.agent.post(`/api/trips/${tripId}/invitations`).set(H).send({})).body,
  ).token;
  await rohan.agent.post(`/api/invitations/${token}/accept`).set(H).send({});
  for (const p of [asha, rohan]) {
    await p.agent.put(`/api/trips/${tripId}/preferences/me`).set(H).send(prefs(p.min, p.max));
  }
  outsiderTripBudget = '987659';
  const other = await createTripAs(outsider.agent, { budgetTotalInr: 987659, durationNights: 2 });
  const otherToken = InvitationResponse.parse(
    (await outsider.agent.post(`/api/trips/${other.id}/invitations`).set(H).send({})).body,
  ).token;
  expect(otherToken).toBeTruthy();
  await outsider.agent
    .put(`/api/trips/${other.id}/preferences/me`)
    .set(H)
    .send(prefs(outsider.min, outsider.max));
  people = [asha, rohan, outsider];
});

afterAll(async () => {
  await pool.end();
});

const GETS = ENDPOINTS.filter((e) => e.method === 'GET');
const urlOf = (path: string) => path.replace(':id', tripId).replace(':token', token);

async function fetchAll(agent: Agent | null) {
  const out: { path: string; status: number; text: string }[] = [];
  for (const e of GETS) {
    const res = await (agent ?? request(app)).get(urlOf(e.path)).set(H);
    out.push({ path: e.path, status: res.status, text: res.text });
  }
  return out;
}

describe('no response leaks another user’s private data', () => {
  it('covers every GET endpoint in the inventory', () => {
    expect(GETS.length).toBeGreaterThanOrEqual(10);
  });

  it('anonymous callers see no budget, past trip or email anywhere', async () => {
    const all = await fetchAll(null);
    for (const { path, text } of all) {
      for (const p of people) {
        for (const secret of [...p.secrets, p.email]) {
          expect(text, `${path} leaked ${secret}`).not.toContain(secret);
        }
      }
      expect(text, `${path} leaked the outsider's trip budget`).not.toContain(outsiderTripBudget);
    }
  });

  it.each(['Asha', 'Rohan', 'Outsider'])(
    '%s sees only their own private values, and their email only on GET /api/me',
    async (key) => {
      const me = people.find((p) => p.key === key)!;
      const others = people.filter((p) => p !== me);
      const all = await fetchAll(me.agent);
      for (const { path, text } of all) {
        for (const o of others) {
          for (const secret of [...o.secrets, o.email]) {
            expect(text, `${path} as ${key} leaked ${secret}`).not.toContain(secret);
          }
        }
        if (key !== 'Outsider') {
          expect(text, `${path} as ${key} leaked another trip's budget`).not.toContain(
            outsiderTripBudget,
          );
        }
        const hasOwnEmail = text.includes(me.email);
        expect(hasOwnEmail, `${path} as ${key}: own email`).toBe(path === '/api/me');
      }
    },
  );

  it("the trip's members carry names, roles, statuses and the submitted flag only", async () => {
    const res = await people[1]!.agent.get(`/api/trips/${tripId}`).set(H);
    const detail = TripDetail.parse(res.body);
    const raw = res.body as { members: Record<string, unknown>[] };
    for (const m of raw.members) {
      expect(Object.keys(m).sort()).toEqual(
        ['joinedAt', 'name', 'role', 'status', 'submitted', 'userId'].sort(),
      );
    }
    expect(detail.members.map((m) => m.submitted)).toEqual([true, true]);
  });

  it('the invitation preview has no budgets, dates, member names or emails', async () => {
    const res = await request(app).get(`/api/invitations/${token}`).set(H);
    expect(res.status).toBe(200);
    const text = res.text;
    for (const p of people) {
      for (const secret of [...p.secrets, p.email]) expect(text).not.toContain(secret);
    }
    expect(text).not.toContain('48000');
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(text).not.toContain('Leak Rohan');
    expect(text).not.toContain('@');
    // The organiser's name is the one name it may carry.
    expect(text).toContain('Leak Asha');
  });
});
