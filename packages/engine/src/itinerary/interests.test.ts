import { describe, expect, it } from 'vitest';
import { ACTIVITIES, POI_CATEGORIES, type Activity } from '@bonvoyage/shared';
import { ACTIVITY_POI_CATEGORIES, groupInterestCategories } from './interests';

describe('ACTIVITY_POI_CATEGORIES', () => {
  it('covers every activity with categories from the catalogue vocabulary', () => {
    for (const activity of ACTIVITIES) {
      const categories = ACTIVITY_POI_CATEGORIES[activity];
      expect(categories.length).toBeGreaterThan(0);
      for (const category of categories) {
        expect(POI_CATEGORIES).toContain(category);
      }
    }
  });

  it('maps the 0005 e table verbatim', () => {
    expect(ACTIVITY_POI_CATEGORIES.trekking).toEqual(['nature', 'viewpoint']);
    expect(ACTIVITY_POI_CATEGORIES.camping).toEqual(['nature', 'viewpoint']);
    expect(ACTIVITY_POI_CATEGORIES.boating).toEqual(['nature', 'viewpoint']);
    expect(ACTIVITY_POI_CATEGORIES.rafting).toEqual(['adventure']);
    expect(ACTIVITY_POI_CATEGORIES.paragliding).toEqual(['adventure']);
    expect(ACTIVITY_POI_CATEGORIES.skiing).toEqual(['adventure']);
    expect(ACTIVITY_POI_CATEGORIES.wildlife_safari).toEqual(['nature', 'adventure']);
    expect(ACTIVITY_POI_CATEGORIES.museums).toEqual(['museum']);
    expect(ACTIVITY_POI_CATEGORIES.forts_palaces).toEqual(['fort_palace']);
    expect(ACTIVITY_POI_CATEGORIES.temples).toEqual(['temple']);
    expect(ACTIVITY_POI_CATEGORIES.yoga_wellness).toEqual(['wellness', 'temple']);
    expect(ACTIVITY_POI_CATEGORIES.food_trails).toEqual(['food', 'market']);
    expect(ACTIVITY_POI_CATEGORIES.shopping).toEqual(['market']);
    expect(ACTIVITY_POI_CATEGORIES.nightlife).toEqual(['market', 'sight']);
  });
});

describe('groupInterestCategories', () => {
  it('returns the union of categories for the group activities', () => {
    const interests: Activity[] = ['temples', 'rafting'];
    expect([...groupInterestCategories(interests)].sort()).toEqual(['adventure', 'temple']);
  });

  it('deduplicates categories shared by two activities', () => {
    const interests: Activity[] = ['trekking', 'boating', 'camping'];
    expect(groupInterestCategories(interests)).toEqual(new Set(['nature', 'viewpoint']));
  });

  it('returns an empty set for no group interests', () => {
    expect(groupInterestCategories([]).size).toBe(0);
  });
});
