import type { Db } from '@bonvoyage/db';
import { tripMember } from '@bonvoyage/db/schema';
import { and, eq } from 'drizzle-orm';

export async function findMember(db: Db, tripId: string, userId: string) {
  const rows = await db
    .select({ role: tripMember.role, status: tripMember.status })
    .from(tripMember)
    .where(and(eq(tripMember.tripId, tripId), eq(tripMember.userId, userId)))
    .limit(1);
  return rows[0];
}
