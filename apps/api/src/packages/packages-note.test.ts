import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createDb, importCatalogue } from '@bonvoyage/db';
import { destination } from '@bonvoyage/db/schema';
import { costablePackageCount, generatePackages, packagesNote } from '@bonvoyage/engine';
import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { packageInput } from './service';

// #123: the packages note comes from costablePackageCount, which decides from
// mode availability and stay rates alone. Over the real catalogue it must
// agree with generatePackages, which costs and plans every package.

const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
afterAll(async () => {
  await pool.end();
});

const member = (i: number) => ({
  memberId: `m${i}`,
  types: [],
  activities: [i % 2 === 0 ? 'trekking' : 'museums'],
  climate: 'mild',
  likedPastTypes: [],
  budgetMinInr: 5000,
  budgetMaxInr: 40000,
  dateStart: '2026-11-13',
  dateEnd: '2026-11-16',
});

describe('costablePackageCount over the real catalogue', () => {
  it('equals generatePackages for every destination, hub, group size and stay length', async () => {
    const dir = resolve(import.meta.dirname, '../../../../packages/db/catalogue');
    await importCatalogue(db, dir, { today: '2026-11-01' });
    // Only the catalogue's own destinations: other files leave fixtures in the
    // shared test database, which would make the case count vary.
    const catalogueSlugs = readFileSync(resolve(dir, 'destinations.csv'), 'utf8')
      .trim()
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.split(',')[0] ?? '');
    const dests = await db
      .select()
      .from(destination)
      .where(and(eq(destination.active, true), inArray(destination.slug, catalogueSlugs)));
    expect(dests).toHaveLength(catalogueSlugs.length);
    const mismatches: string[] = [];
    let cases = 0;
    for (const hubSlug of ['gurugram', 'delhi']) {
      const hubRow = await db.query.hub.findFirst({ where: (h, { eq }) => eq(h.slug, hubSlug) });
      expect(hubRow, hubSlug).toBeDefined();
      for (const n of [2, 3, 8]) {
        const members = Array.from({ length: n }, (_, i) => member(i));
        for (const nights of [1, 2]) {
          const trip = {
            id: 'x',
            durationNights: nights,
            budgetTotalInr: 200000,
            originHubId: hubRow?.id ?? '',
            startDate: null,
          };
          for (const dest of dests) {
            const input = await packageInput(db, trip as never, members as never, dest);
            const built = generatePackages(input);
            const count = costablePackageCount(input);
            cases += 1;
            if (
              count !== built.packages.length ||
              packagesNote(input.destinationName, count) !== built.note
            ) {
              mismatches.push(
                `${hubSlug}/${dest.slug} n=${n} nights=${nights}: count ${count}, built ${built.packages.length}`,
              );
            }
          }
        }
      }
    }
    process.stdout.write(`packages-note property: ${cases} cases\n`);
    expect(mismatches).toEqual([]);
    expect(cases).toBe(2 * 3 * 2 * dests.length);
  });
});
