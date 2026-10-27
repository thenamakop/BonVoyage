import type { Activity, PoiCategory } from '@bonvoyage/shared';

// 0005 e: which catalogue place categories count as matching a group interest.
export const ACTIVITY_POI_CATEGORIES: Record<Activity, PoiCategory[]> = {
  trekking: ['nature', 'viewpoint'],
  camping: ['nature', 'viewpoint'],
  boating: ['nature', 'viewpoint'],
  rafting: ['adventure'],
  paragliding: ['adventure'],
  skiing: ['adventure'],
  wildlife_safari: ['nature', 'adventure'],
  museums: ['museum'],
  forts_palaces: ['fort_palace'],
  temples: ['temple'],
  yoga_wellness: ['wellness', 'temple'],
  food_trails: ['food', 'market'],
  shopping: ['market'],
  nightlife: ['market', 'sight'],
};

// 0005 e: group interests are the activities chosen by 2 or more members; the
// caller passes that filtered list, never one member's own list (P8).
export function groupInterestCategories(activities: readonly Activity[]): ReadonlySet<PoiCategory> {
  const set = new Set<PoiCategory>();
  for (const activity of activities) {
    for (const category of ACTIVITY_POI_CATEGORIES[activity]) set.add(category);
  }
  return set;
}
