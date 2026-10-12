import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { trip } from './trips';

export const notification = pgTable(
  'notification',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    tripId: uuid('trip_id').references(() => trip.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    payload: jsonb('payload')
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
  },
  (t) => [
    index('notification_user_read_idx').on(t.userId, t.readAt),
    index('notification_trip_idx').on(t.tripId),
  ],
);
