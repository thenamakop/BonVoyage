import { createDb } from '@bonvoyage/db';
import { user } from '@bonvoyage/db/schema/auth';
import { inArray } from 'drizzle-orm';
import { pino } from 'pino';
import { HILLS_DEMO, seedDemoTrip } from './demo-trips';

// S2-8: fresh copies of the hills demo for scripts/perf/recommend-timing.ts
// (R15). Built with the seed's own helper, so each copy reaches
// ready_for_recommendation through the services. The caller has already
// checked that `url` is a local database.

export const demoEmail = (name: string) => `${name.toLowerCase()}@demo.bonvoyage.test`;

export async function createHillsCopies(
  url: string,
  count: number,
  stamp: string,
): Promise<{ tripIds: string[]; close: () => Promise<void> }> {
  const { db, pool } = createDb(url);
  try {
    const names = HILLS_DEMO.members.map((m) => m.name);
    const rows = await db
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(inArray(user.email, names.map(demoEmail)));
    const ids = new Map(
      names.flatMap((name) => {
        const row = rows.find((r) => r.email === demoEmail(name));
        return row ? [[name, row.id] as const] : [];
      }),
    );
    if (ids.size !== names.length)
      throw new Error('Demo users are missing: run pnpm db:seed first.');
    const deps = { db, logger: pino({ level: 'silent' }), clock: () => new Date() };
    const tripIds: string[] = [];
    for (let i = 1; i <= count; i++) {
      tripIds.push(
        await seedDemoTrip(deps, HILLS_DEMO, ids, {
          title: `${HILLS_DEMO.title} (timing ${stamp}-${i})`,
        }),
      );
    }
    return { tripIds, close: () => pool.end() };
  } catch (error) {
    await pool.end();
    throw error;
  }
}
