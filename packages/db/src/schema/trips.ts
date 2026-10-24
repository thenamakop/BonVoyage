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
import { destination, hub } from './catalogue';
import { invitationStatusEnum, memberRoleEnum, memberStatusEnum, tripStatusEnum } from './enums';
import { timestamps } from './helpers';

export const userProfile = pgTable(
  'user_profile',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    homeHubId: uuid('home_hub_id').references(() => hub.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [index('user_profile_home_hub_idx').on(t.homeHubId)],
);

export const trip = pgTable(
  'trip',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    organiserId: text('organiser_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    originHubId: uuid('origin_hub_id')
      .notNull()
      .references(() => hub.id, { onDelete: 'restrict' }),
    selectedDestinationId: uuid('selected_destination_id').references(() => destination.id, {
      onDelete: 'restrict',
    }),
    durationNights: smallint('duration_nights').notNull(),
    budgetTotalInr: integer('budget_total_inr').notNull(),
    radiusKm: integer('radius_km').notNull(),
    status: tripStatusEnum('status').default('draft').notNull(),
    startDate: date('start_date'),
    endDate: date('end_date'),
    ...timestamps,
  },
  (t) => [
    index('trip_status_idx').on(t.status),
    index('trip_organiser_idx').on(t.organiserId),
    index('trip_origin_hub_idx').on(t.originHubId),
    index('trip_selected_destination_idx').on(t.selectedDestinationId),
    check('trip_title_len', sql`length(${t.title}) between 1 and 120`),
    check('trip_duration_nights', sql`${t.durationNights} between 1 and 14`),
    check('trip_budget_positive', sql`${t.budgetTotalInr} > 0`),
    check('trip_radius_positive', sql`${t.radiusKm} > 0`),
    check(
      'trip_date_order',
      sql`${t.startDate} is null or ${t.endDate} is null or ${t.startDate} <= ${t.endDate}`,
    ),
  ],
);

export const tripMember = pgTable(
  'trip_member',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trip.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: memberRoleEnum('role').notNull(),
    status: memberStatusEnum('status').default('active').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('trip_member_unique').on(t.tripId, t.userId),
    // One organiser per trip.
    uniqueIndex('trip_member_one_organiser')
      .on(t.tripId)
      .where(sql`${t.role} = 'organiser'`),
    index('trip_member_trip_idx').on(t.tripId),
    index('trip_member_user_idx').on(t.userId),
  ],
);

export const invitation = pgTable(
  'invitation',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trip.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    createdBy: text('created_by')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    status: invitationStatusEnum('status').default('active').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('invitation_trip_idx').on(t.tripId),
    index('invitation_created_by_idx').on(t.createdBy),
  ],
);

// Audit trail written by transitionTrip (S0-6); transition_id is text holding
// T1 to T18, T3b or I1 to I5.
export const tripTransition = pgTable(
  'trip_transition',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trip.id, { onDelete: 'cascade' }),
    transitionId: text('transition_id').notNull(),
    event: text('event').notNull(),
    fromStatus: tripStatusEnum('from_status'),
    toStatus: tripStatusEnum('to_status').notNull(),
    actorUserId: text('actor_user_id').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('trip_transition_trip_idx').on(t.tripId),
    index('trip_transition_actor_idx').on(t.actorUserId),
  ],
);
