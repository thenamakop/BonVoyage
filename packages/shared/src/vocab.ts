import { z } from 'zod';

// Catalogue and preference vocabularies (docs/specs/scoring.md, S0-4).
// Every value is snake_case; every value has a UI label.

export const DESTINATION_TYPES = [
  'mountain',
  'hill_station',
  'beach',
  'heritage',
  'city',
  'spiritual',
  'adventure',
  'wildlife',
  'lake',
  'desert',
] as const;
export const DestinationType = z.enum(DESTINATION_TYPES);
export type DestinationType = z.infer<typeof DestinationType>;
export const DESTINATION_TYPE_LABELS: Record<DestinationType, string> = {
  mountain: 'Mountain',
  hill_station: 'Hill station',
  beach: 'Beach',
  heritage: 'Heritage',
  city: 'City',
  spiritual: 'Spiritual',
  adventure: 'Adventure',
  wildlife: 'Wildlife',
  lake: 'Lake',
  desert: 'Desert',
};

export const ACTIVITIES = [
  'trekking',
  'rafting',
  'camping',
  'paragliding',
  'skiing',
  'wildlife_safari',
  'boating',
  'museums',
  'forts_palaces',
  'temples',
  'yoga_wellness',
  'food_trails',
  'shopping',
  'nightlife',
] as const;
export const Activity = z.enum(ACTIVITIES);
export type Activity = z.infer<typeof Activity>;
export const ACTIVITY_LABELS: Record<Activity, string> = {
  trekking: 'Trekking',
  rafting: 'Rafting',
  camping: 'Camping',
  paragliding: 'Paragliding',
  skiing: 'Skiing',
  wildlife_safari: 'Wildlife safari',
  boating: 'Boating',
  museums: 'Museums',
  forts_palaces: 'Forts and palaces',
  temples: 'Temples',
  yoga_wellness: 'Yoga and wellness',
  food_trails: 'Food trails',
  shopping: 'Shopping',
  nightlife: 'Nightlife',
};

export const CLIMATES = ['cold', 'mild', 'warm'] as const;
export const Climate = z.enum(CLIMATES);
export type Climate = z.infer<typeof Climate>;
export const CLIMATE_LABELS: Record<Climate, string> = {
  cold: 'Cold',
  mild: 'Mild',
  warm: 'Warm',
};

export const CLIMATE_PREFERENCES = ['cold', 'mild', 'warm', 'any'] as const;
export const ClimatePreference = z.enum(CLIMATE_PREFERENCES);
export type ClimatePreference = z.infer<typeof ClimatePreference>;
export const CLIMATE_PREFERENCE_LABELS: Record<ClimatePreference, string> = {
  cold: 'Cold',
  mild: 'Mild',
  warm: 'Warm',
  any: 'Any',
};

export const TRAVEL_STYLES = ['budget', 'comfort', 'premium'] as const;
export const TravelStyle = z.enum(TRAVEL_STYLES);
export type TravelStyle = z.infer<typeof TravelStyle>;
export const TRAVEL_STYLE_LABELS: Record<TravelStyle, string> = {
  budget: 'Budget',
  comfort: 'Comfort',
  premium: 'Premium',
};

export const TRANSPORT_MODES = ['bus', 'train', 'car'] as const;
export const TransportMode = z.enum(TRANSPORT_MODES);
export type TransportMode = z.infer<typeof TransportMode>;
export const TRANSPORT_MODE_LABELS: Record<TransportMode, string> = {
  bus: 'Bus',
  train: 'Train',
  car: 'Car',
};

export const POI_CATEGORIES = [
  'sight',
  'temple',
  'fort_palace',
  'museum',
  'market',
  'nature',
  'adventure',
  'food',
  'viewpoint',
  'wellness',
] as const;
export const PoiCategory = z.enum(POI_CATEGORIES);
export type PoiCategory = z.infer<typeof PoiCategory>;
export const POI_CATEGORY_LABELS: Record<PoiCategory, string> = {
  sight: 'Sight',
  temple: 'Temple',
  fort_palace: 'Fort or palace',
  museum: 'Museum',
  market: 'Market',
  nature: 'Nature',
  adventure: 'Adventure',
  food: 'Food',
  viewpoint: 'Viewpoint',
  wellness: 'Wellness',
};

export const REVIEW_STATUSES = ['draft', 'verified'] as const;
export const ReviewStatus = z.enum(REVIEW_STATUSES);
export type ReviewStatus = z.infer<typeof ReviewStatus>;
export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  draft: 'Draft',
  verified: 'Verified',
};
