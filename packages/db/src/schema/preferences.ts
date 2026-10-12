import { sql } from 'drizzle-orm';
import {
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
import { climatePreferenceEnum, travelStyleEnum } from './enums';
import { timestamps } from './helpers';
import { tripMember } from './trips';

export const preference = pgTable(
  'preference',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripMemberId: uuid('trip_member_id')
      .notNull()
      .references(() => tripMember.id, { onDelete: 'cascade' }),
    destinationTypes: text('destination_types').array().notNull(),
    activities: text('activities').array().notNull(),
    climate: climatePreferenceEnum('climate').notNull(),
    travelStyle: travelStyleEnum('travel_style').notNull(),
    budgetMinInr: integer('budget_min_inr').notNull(),
    budgetMaxInr: integer('budget_max_inr').notNull(),
    dateStart: date('date_start').notNull(),
    dateEnd: date('date_end').notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('preference_member_unique').on(t.tripMemberId),
    check('preference_budget_min', sql`${t.budgetMinInr} >= 0`),
    check('preference_budget_order', sql`${t.budgetMinInr} <= ${t.budgetMaxInr}`),
    check('preference_date_order', sql`${t.dateStart} <= ${t.dateEnd}`),
  ],
);

export const pastTrip = pgTable(
  'past_trip',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    destinationId: uuid('destination_id').references(() => destination.id, {
      onDelete: 'set null',
    }),
    placeName: text('place_name').notNull(),
    visitedOn: date('visited_on'),
    rating: smallint('rating').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('past_trip_user_idx').on(t.userId),
    index('past_trip_destination_idx').on(t.destinationId),
    check('past_trip_rating', sql`${t.rating} between 1 and 5`),
  ],
);
