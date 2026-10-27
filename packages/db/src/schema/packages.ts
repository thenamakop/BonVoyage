import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { destination } from './catalogue';
import {
  costCategoryEnum,
  decisionEnum,
  packageStatusEnum,
  provenanceEnum,
  stayTierEnum,
  transportModeEnum,
} from './enums';
import { trip } from './trips';

// Named trip_package, not package: "package" is reserved in strict-mode TS.
export const tripPackage = pgTable(
  'trip_package',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trip.id, { onDelete: 'cascade' }),
    label: text('label').notNull().default(''),
    destinationId: uuid('destination_id')
      .notNull()
      .references(() => destination.id, { onDelete: 'restrict' }),
    transportMode: transportModeEnum('transport_mode').notNull(),
    stayTier: stayTierEnum('stay_tier').notNull(),
    rooms: smallint('rooms').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    totalInr: integer('total_inr').notNull(),
    perPersonInr: integer('per_person_inr').notNull(),
    overBudget: boolean('over_budget').default(false).notNull(),
    status: packageStatusEnum('status').default('proposed').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('trip_package_trip_idx').on(t.tripId),
    index('trip_package_destination_idx').on(t.destinationId),
    check('trip_package_rooms', sql`${t.rooms} > 0`),
  ],
);

export const costItem = pgTable(
  'cost_item',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    packageId: uuid('package_id')
      .notNull()
      .references(() => tripPackage.id, { onDelete: 'cascade' }),
    category: costCategoryEnum('category').notNull(),
    label: text('label').notNull(),
    amountInr: integer('amount_inr').notNull(),
    provenance: provenanceEnum('provenance').notNull(),
    sourceRef: text('source_ref'),
  },
  (t) => [
    index('cost_item_package_idx').on(t.packageId),
    check('cost_item_amount', sql`${t.amountInr} >= 0`),
  ],
);

export const packageDecision = pgTable(
  'package_decision',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    packageId: uuid('package_id')
      .notNull()
      .references(() => tripPackage.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    decision: decisionEnum('decision').notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('package_decision_package_idx').on(t.packageId),
    index('package_decision_user_idx').on(t.userId),
    uniqueIndex('package_decision_one_per_member').on(t.packageId, t.userId),
  ],
);
