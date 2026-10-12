// Decision 0002: the catalogue is verified in three stages. catalogue:check
// and the administrator page (S1-7) both report progress against these.

export const CATALOGUE_STAGES = {
  a: { name: 'A (hubs, destination identity)', due: '2026-10-18' },
  b: { name: 'B (destination costs, fares, cost rules)', due: '2026-10-25' },
  c: { name: 'C (POIs)', due: '2026-11-01' },
} as const;
export type CatalogueStage = keyof typeof CATALOGUE_STAGES;
export const CATALOGUE_STAGE_ORDER: CatalogueStage[] = ['a', 'b', 'c'];
