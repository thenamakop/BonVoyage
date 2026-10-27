// Decisions 0002 and 0004: the catalogue is verified in four stages.
// catalogue:check and the administrator page (S1-7, #81) both report progress
// against this single definition.

export const CATALOGUE_STAGES = {
  a: { name: 'A (hubs, destination identity)', due: '2026-10-26' },
  b1: { name: 'B1 (cost rules, destination costs, car rows)', due: '2026-11-01' },
  b2: { name: 'B2 (bus and train fares, best effort)', due: '2026-11-05' },
  c: { name: 'C (POIs)', due: '2026-11-01' },
} as const;
export type CatalogueStage = keyof typeof CATALOGUE_STAGES;
export const CATALOGUE_STAGE_ORDER: CatalogueStage[] = ['a', 'b1', 'b2', 'c'];
