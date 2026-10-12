import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { poi } from './catalogue';
import { decisionEnum, itineraryItemKindEnum, itineraryStatusEnum } from './enums';
import { tripPackage } from './packages';

export const itinerary = pgTable(
  'itinerary',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    packageId: uuid('package_id')
      .notNull()
      .references(() => tripPackage.id, { onDelete: 'cascade' }),
    version: smallint('version').notNull(),
    status: itineraryStatusEnum('status').default('proposed').notNull(),
    model: text('model'),
    generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('itinerary_package_version').on(t.packageId, t.version),
    index('itinerary_package_idx').on(t.packageId),
    check('itinerary_version', sql`${t.version} >= 1`),
  ],
);

export const itineraryItem = pgTable(
  'itinerary_item',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    itineraryId: uuid('itinerary_id')
      .notNull()
      .references(() => itinerary.id, { onDelete: 'cascade' }),
    dayNumber: smallint('day_number').notNull(),
    position: smallint('position').notNull(),
    startTime: time('start_time'),
    endTime: time('end_time'),
    kind: itineraryItemKindEnum('kind').notNull(),
    poiId: uuid('poi_id').references(() => poi.id, { onDelete: 'set null' }),
    note: text('note'),
    verified: boolean('verified').default(false).notNull(),
  },
  (t) => [
    uniqueIndex('itinerary_item_slot').on(t.itineraryId, t.dayNumber, t.position),
    index('itinerary_item_itinerary_idx').on(t.itineraryId),
    index('itinerary_item_poi_idx').on(t.poiId),
    check('itinerary_item_day', sql`${t.dayNumber} >= 1`),
  ],
);

export const itineraryDecision = pgTable(
  'itinerary_decision',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    itineraryId: uuid('itinerary_id')
      .notNull()
      .references(() => itinerary.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    decision: decisionEnum('decision').notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('itinerary_decision_itinerary_idx').on(t.itineraryId),
    index('itinerary_decision_user_idx').on(t.userId),
  ],
);
