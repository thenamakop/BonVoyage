import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { destination } from './catalogue';
import { provenanceEnum, recommendationKindEnum } from './enums';
import { trip } from './trips';

export const recommendationRun = pgTable(
  'recommendation_run',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trip.id, { onDelete: 'cascade' }),
    round: smallint('round').default(1).notNull(),
    kind: recommendationKindEnum('kind').notNull(),
    // Stored per run; never defaults in code (GFS rule 3).
    alpha: doublePrecision('alpha').notNull(),
    beta: doublePrecision('beta').notNull(),
    gamma: doublePrecision('gamma').notNull(),
    // R17 (decision E1, migration 0004): the fairness lambda the run was ranked
    // with. Runs from before R17 read 0 (unweighted); new runs always write it.
    lambda: doublePrecision('lambda').default(0).notNull(),
    feasibleCount: integer('feasible_count').notNull(),
    bindingConstraint: text('binding_constraint'),
    diagnostic: jsonb('diagnostic'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('recommendation_run_trip_idx').on(t.tripId)],
);

export const recommendationItem = pgTable(
  'recommendation_item',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id')
      .notNull()
      .references(() => recommendationRun.id, { onDelete: 'cascade' }),
    // A scored destination must survive catalogue edits.
    destinationId: uuid('destination_id')
      .notNull()
      .references(() => destination.id, { onDelete: 'restrict' }),
    rank: smallint('rank').notNull(),
    gfs: doublePrecision('gfs').notNull(),
    mean: doublePrecision('mean').notNull(),
    min: doublePrecision('min').notNull(),
    sd: doublePrecision('sd').notNull(),
    estimatedCostInr: integer('estimated_cost_inr').notNull(),
    distanceKm: integer('distance_km').notNull(),
    distanceProvenance: provenanceEnum('distance_provenance').notNull(),
    reasons: jsonb('reasons'),
  },
  (t) => [
    uniqueIndex('recommendation_item_rank').on(t.runId, t.rank),
    uniqueIndex('recommendation_item_destination').on(t.runId, t.destinationId),
    index('recommendation_item_run_idx').on(t.runId),
    index('recommendation_item_destination_idx').on(t.destinationId),
  ],
);
