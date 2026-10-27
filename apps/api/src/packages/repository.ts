import type { Db } from '@bonvoyage/db';
import {
  costItem,
  costRule,
  fareFallback,
  packageDecision,
  poi,
  tripPackage,
} from '@bonvoyage/db/schema';
import { tripMember } from '@bonvoyage/db/schema';
import { and, eq, isNotNull } from 'drizzle-orm';
import type { Tx } from '../trips/transition-trip';

type Reader = Db | Tx;

/** The catalogue rows a PackageInput is built from (0005 c/d). */
export async function loadPackageSource(db: Reader, originHubId: string, destinationId: string) {
  const [dest, fares, rules, pois] = await Promise.all([
    db.query.destination.findFirst({ where: (d, { eq }) => eq(d.id, destinationId) }),
    db
      .select()
      .from(fareFallback)
      .where(
        and(
          eq(fareFallback.originHubId, originHubId),
          eq(fareFallback.destinationId, destinationId),
        ),
      ),
    db
      .select({ key: costRule.key, value: costRule.value, verified: costRule.reviewStatus })
      .from(costRule),
    db.select().from(poi).where(eq(poi.destinationId, destinationId)),
  ]);
  return { dest, fares, rules, pois };
}

export interface PackageRow {
  id: string;
  label: string;
  transportMode: string;
  stayTier: string;
  rooms: number;
  startDate: string;
  endDate: string;
  totalInr: number;
  perPersonInr: number;
  overBudget: boolean;
  status: string;
}

export async function listPackagesWithCounts(db: Reader, tripId: string, viewerId: string) {
  const pkgs = await db
    .select()
    .from(tripPackage)
    .where(and(eq(tripPackage.tripId, tripId), eq(tripPackage.status, 'proposed')));
  const accepted = await db
    .select()
    .from(tripPackage)
    .where(and(eq(tripPackage.tripId, tripId), eq(tripPackage.status, 'accepted')));
  const all = [...pkgs, ...accepted];
  const decisions = await db
    .select()
    .from(packageDecision)
    .innerJoin(tripPackage, eq(tripPackage.id, packageDecision.packageId))
    .where(eq(tripPackage.tripId, tripId));
  const lines = await db
    .select()
    .from(costItem)
    .innerJoin(tripPackage, eq(tripPackage.id, costItem.packageId))
    .where(eq(tripPackage.tripId, tripId));
  const members = await db
    .select({ id: tripMember.id })
    .from(tripMember)
    .where(
      and(
        eq(tripMember.tripId, tripId),
        isNotNull(tripMember.submittedAt),
        eq(tripMember.status, 'active'),
      ),
    );
  return { all, decisions, lines, memberCount: members.length, viewerId };
}

export async function findPackage(db: Reader, packageId: string, tripId: string) {
  // A malformed id gets the same 404 as a missing one, like past trips.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(packageId)) {
    return undefined;
  }
  const rows = await db
    .select()
    .from(tripPackage)
    .where(and(eq(tripPackage.id, packageId), eq(tripPackage.tripId, tripId)))
    .limit(1);
  return rows[0];
}

export async function countProposed(
  tx: Reader,
  tripId: string,
  excludeId?: string,
): Promise<number> {
  const rows = await tx
    .select({ id: tripPackage.id })
    .from(tripPackage)
    .where(and(eq(tripPackage.tripId, tripId), eq(tripPackage.status, 'proposed')));
  return excludeId ? rows.filter((r) => r.id !== excludeId).length : rows.length;
}
