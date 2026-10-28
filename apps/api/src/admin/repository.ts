import type { Db } from '@bonvoyage/db';
import { costRule, destination, fareFallback, hub, poi } from '@bonvoyage/db/schema';
import { sql } from 'drizzle-orm';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Reader = Db | Tx;

const count = sql<number>`count(*)::int`;
const verified = (column: unknown) =>
  sql<number>`(count(*) filter (where ${column} = 'verified'))::int`;

export async function tableCounts(db: Reader) {
  const [h, d, p, f, c] = await Promise.all([
    db.select({ n: count }).from(hub),
    db.select({ n: count }).from(destination),
    db.select({ n: count }).from(poi),
    db.select({ n: count }).from(fareFallback),
    db.select({ n: count }).from(costRule),
  ]);
  return {
    hub: h[0]?.n ?? 0,
    destination: d[0]?.n ?? 0,
    poi: p[0]?.n ?? 0,
    fare_fallback: f[0]?.n ?? 0,
    cost_rule: c[0]?.n ?? 0,
  };
}

/** Verified and total rows per stage, read from the database (decision 0002). */
export async function stageCounts(db: Reader) {
  // One after another: the import calls this on its transaction, which is a
  // single client, and pg refuses overlapping queries on one client (#118).
  const h = await db.select({ n: count, v: verified(hub.reviewStatus) }).from(hub);
  const d = await db
    .select({
      n: count,
      v: verified(destination.reviewStatus),
      costV: verified(destination.costReviewStatus),
    })
    .from(destination);
  const p = await db.select({ n: count, v: verified(poi.reviewStatus) }).from(poi);
  const f = await db
    .select({
      carN: sql<number>`(count(*) filter (where ${fareFallback.mode} = 'car'))::int`,
      carV: sql<number>`(count(*) filter (where ${fareFallback.mode} = 'car' and ${fareFallback.reviewStatus} = 'verified'))::int`,
      ptN: sql<number>`(count(*) filter (where ${fareFallback.mode} <> 'car'))::int`,
      ptV: sql<number>`(count(*) filter (where ${fareFallback.mode} <> 'car' and ${fareFallback.reviewStatus} = 'verified'))::int`,
    })
    .from(fareFallback);
  const c = await db.select({ n: count, v: verified(costRule.reviewStatus) }).from(costRule);
  const zero = { n: 0, v: 0, costV: 0, carN: 0, carV: 0, ptN: 0, ptV: 0 };
  const [hr, dr, pr, fr, cr] = [
    h[0] ?? zero,
    d[0] ?? zero,
    p[0] ?? zero,
    f[0] ?? zero,
    c[0] ?? zero,
  ];
  return {
    // A: hubs plus destination identity.
    a: { verified: hr.v + dr.v, total: hr.n + dr.n },
    // B1: destination costs, car rows and cost rules.
    b1: { verified: dr.costV + fr.carV + cr.v, total: dr.n + fr.carN + cr.n },
    // B2: bus and train fares.
    b2: { verified: fr.ptV, total: fr.ptN },
    // C: POIs.
    c: { verified: pr.v, total: pr.n },
  };
}

/** The newest updated_at of the two catalogue tables that keep one. */
export async function lastUpdatedAt(db: Reader): Promise<Date | null> {
  const rows = await db.execute<{ at: string | null }>(
    sql`select greatest((select max(updated_at) from hub), (select max(updated_at) from destination)) as at`,
  );
  const at = rows.rows[0]?.at ?? null;
  return at === null ? null : new Date(at);
}

/** Destination slugs in the database that the given files do not contain. */
export async function destinationsNotIn(db: Reader, slugs: string[]): Promise<string[]> {
  const rows = await db
    .select({ slug: destination.slug })
    .from(destination)
    .orderBy(destination.slug);
  const inFiles = new Set(slugs);
  return rows.map((r) => r.slug).filter((s) => !inFiles.has(s));
}
