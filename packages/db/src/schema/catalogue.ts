import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  climateEnum,
  poiCategoryEnum,
  provenanceEnum,
  reviewStatusEnum,
  transportModeEnum,
} from './enums';
import { timestamps } from './helpers';

export const hub = pgTable('hub', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  state: text('state').notNull(),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  sourceUrl: text('source_url'),
  collectedOn: date('collected_on').notNull(),
  reviewStatus: reviewStatusEnum('review_status').notNull(),
  ...timestamps,
});

export const destination = pgTable(
  'destination',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    state: text('state').notNull(),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    types: text('types').array().notNull(),
    activities: text('activities').array().notNull(),
    climate: climateEnum('climate').notNull(),
    bestMonths: smallint('best_months').array().notNull(),
    minNights: smallint('min_nights').notNull(),
    stayBudgetInr: integer('stay_budget_inr'),
    stayMidInr: integer('stay_mid_inr'),
    stayPremiumInr: integer('stay_premium_inr'),
    foodPerDayInr: integer('food_per_day_inr'),
    localPerDayInr: integer('local_per_day_inr'),
    sourceUrl: text('source_url'),
    collectedOn: date('collected_on').notNull(),
    reviewStatus: reviewStatusEnum('review_status').notNull(),
    costSourceUrl: text('cost_source_url'),
    costCollectedOn: date('cost_collected_on'),
    costReviewStatus: reviewStatusEnum('cost_review_status').notNull(),
    active: boolean('active').default(true).notNull(),
    ...timestamps,
  },
  (t) => [
    check('destination_lat_india', sql`${t.lat} between 6.0 and 37.6`),
    check('destination_lng_india', sql`${t.lng} between 68.0 and 97.5`),
    check('destination_min_nights', sql`${t.minNights} between 1 and 14`),
    check(
      'destination_costs_nonnegative',
      sql`(${t.stayBudgetInr} is null or ${t.stayBudgetInr} >= 0)
        and (${t.stayMidInr} is null or ${t.stayMidInr} >= 0)
        and (${t.stayPremiumInr} is null or ${t.stayPremiumInr} >= 0)
        and (${t.foodPerDayInr} is null or ${t.foodPerDayInr} >= 0)
        and (${t.localPerDayInr} is null or ${t.localPerDayInr} >= 0)`,
    ),
    check(
      'destination_stay_order',
      sql`(${t.stayBudgetInr} is null or ${t.stayMidInr} is null or ${t.stayPremiumInr} is null)
        or (${t.stayBudgetInr} <= ${t.stayMidInr} and ${t.stayMidInr} <= ${t.stayPremiumInr})`,
    ),
  ],
);

export const poi = pgTable(
  'poi',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    destinationId: uuid('destination_id')
      .notNull()
      .references(() => destination.id, { onDelete: 'cascade' }),
    poiKey: text('poi_key').notNull(),
    name: text('name').notNull(),
    category: poiCategoryEnum('category').notNull(),
    typicalMinutes: integer('typical_minutes').notNull(),
    openTime: time('open_time'),
    closeTime: time('close_time'),
    closedDays: smallint('closed_days')
      .array()
      .default(sql`'{}'::smallint[]`)
      .notNull(),
    entryFeeInr: integer('entry_fee_inr').default(0).notNull(),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    sourceUrl: text('source_url'),
    collectedOn: date('collected_on').notNull(),
    reviewStatus: reviewStatusEnum('review_status').notNull(),
  },
  (t) => [
    uniqueIndex('poi_destination_key').on(t.destinationId, t.poiKey),
    index('poi_destination_id_idx').on(t.destinationId),
    check('poi_open_close_pair', sql`(${t.openTime} is null) = (${t.closeTime} is null)`),
    check('poi_close_after_open', sql`${t.openTime} is null or ${t.closeTime} > ${t.openTime}`),
  ],
);

export const fareFallback = pgTable(
  'fare_fallback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    originHubId: uuid('origin_hub_id')
      .notNull()
      .references(() => hub.id, { onDelete: 'cascade' }),
    destinationId: uuid('destination_id')
      .notNull()
      .references(() => destination.id, { onDelete: 'cascade' }),
    mode: transportModeEnum('mode').notNull(),
    farePerPersonInr: integer('fare_per_person_inr'),
    durationMinutes: integer('duration_minutes').notNull(),
    distanceKm: integer('distance_km').notNull(),
    sourceUrl: text('source_url'),
    collectedOn: date('collected_on').notNull(),
    reviewStatus: reviewStatusEnum('review_status').notNull(),
  },
  (t) => [
    uniqueIndex('fare_fallback_trip_key').on(t.originHubId, t.destinationId, t.mode),
    index('fare_fallback_origin_hub_idx').on(t.originHubId),
    index('fare_fallback_destination_idx').on(t.destinationId),
    check('fare_car_no_fare', sql`${t.mode} <> 'car' or ${t.farePerPersonInr} is null`),
  ],
);

export const costRule = pgTable('cost_rule', {
  key: text('key').primaryKey(),
  value: doublePrecision('value').notNull(),
  unit: text('unit').notNull(),
  sourceUrl: text('source_url'),
  collectedOn: date('collected_on').notNull(),
  reviewStatus: reviewStatusEnum('review_status').notNull(),
});

export const distanceCache = pgTable(
  'distance_cache',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    originKey: text('origin_key').notNull(),
    destinationId: uuid('destination_id')
      .notNull()
      .references(() => destination.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    distanceKm: integer('distance_km').notNull(),
    durationMin: integer('duration_min'),
    provenance: provenanceEnum('provenance').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex('distance_cache_key').on(t.originKey, t.destinationId, t.provider),
    index('distance_cache_destination_idx').on(t.destinationId),
  ],
);

export const providerUsage = pgTable(
  'provider_usage',
  {
    provider: text('provider').notNull(),
    day: date('day').notNull(),
    calls: integer('calls').default(0).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.day] }),
    check('provider_usage_calls_nonnegative', sql`${t.calls} >= 0`),
  ],
);
