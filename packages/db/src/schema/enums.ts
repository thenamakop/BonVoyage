import {
  COST_CATEGORIES,
  DECISIONS,
  INVITATION_STATUSES,
  ITINERARY_ITEM_KINDS,
  ITINERARY_STATUSES,
  MEMBER_ROLES,
  MEMBER_STATUSES,
  PACKAGE_STATUSES,
  RECOMMENDATION_KINDS,
  STAY_TIERS,
  TRIP_STATUSES,
  CLIMATES,
  CLIMATE_PREFERENCES,
  POI_CATEGORIES,
  REVIEW_STATUSES,
  TRANSPORT_MODES,
  TRAVEL_STYLES,
  Provenance,
} from '@bonvoyage/shared';
import { pgEnum } from 'drizzle-orm/pg-core';

// One pgEnum per shared vocabulary that a column uses (S0-5 step 3).
export const tripStatusEnum = pgEnum('trip_status', TRIP_STATUSES);
export const memberRoleEnum = pgEnum('member_role', MEMBER_ROLES);
export const memberStatusEnum = pgEnum('member_status', MEMBER_STATUSES);
export const invitationStatusEnum = pgEnum('invitation_status', INVITATION_STATUSES);
export const stayTierEnum = pgEnum('stay_tier', STAY_TIERS);
export const costCategoryEnum = pgEnum('cost_category', COST_CATEGORIES);
export const decisionEnum = pgEnum('decision', DECISIONS);
export const packageStatusEnum = pgEnum('package_status', PACKAGE_STATUSES);
export const itineraryStatusEnum = pgEnum('itinerary_status', ITINERARY_STATUSES);
export const itineraryItemKindEnum = pgEnum('itinerary_item_kind', ITINERARY_ITEM_KINDS);
export const recommendationKindEnum = pgEnum('recommendation_kind', RECOMMENDATION_KINDS);
export const climateEnum = pgEnum('climate', CLIMATES);
export const climatePreferenceEnum = pgEnum('climate_preference', CLIMATE_PREFERENCES);
export const poiCategoryEnum = pgEnum('poi_category', POI_CATEGORIES);
export const reviewStatusEnum = pgEnum('review_status', REVIEW_STATUSES);
export const transportModeEnum = pgEnum('transport_mode', TRANSPORT_MODES);
export const travelStyleEnum = pgEnum('travel_style', TRAVEL_STYLES);
export const provenanceEnum = pgEnum('provenance', Provenance.options as [string, ...string[]]);
