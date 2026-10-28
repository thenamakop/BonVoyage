import { z } from 'zod';
import { COST_CATEGORIES, STAY_TIERS } from '../domain';
import { TRANSPORT_MODES } from '../vocab';

// S3-3 / 0005: the packages shown on the Packages page, built when the
// organiser chooses a destination (T9) and changed via T10, T11, I3 and I4.

export const PackageCostLine = z.object({
  category: z.enum(COST_CATEGORIES),
  label: z.string(),
  amountInr: z.number().int(),
  provenance: z.enum(['curated', 'estimated']),
});
export type PackageCostLine = z.infer<typeof PackageCostLine>;

import { PackageStatus } from '../domain';
export { PackageStatus };

export const TripPackageView = z.object({
  id: z.string(),
  label: z.string(),
  transportMode: z.enum(TRANSPORT_MODES),
  stayTier: z.enum(STAY_TIERS),
  rooms: z.number().int(),
  startDate: z.string(),
  endDate: z.string(),
  totalInr: z.number().int(),
  perPersonInr: z.number().int(),
  overBudget: z.boolean(),
  /** D1, #116: null below MIN_MEMBERS_FOR_RANGE contributors when members' maxima set the cap. */
  overByInr: z.number().int().nullable(),
  status: PackageStatus,
  lines: z.array(PackageCostLine),
  opinions: z.object({
    works: z.number().int(),
    notForMe: z.number().int(),
    members: z.number().int(),
  }),
  mine: z.enum(['accept', 'reject']).nullable(),
});
export type TripPackageView = z.infer<typeof TripPackageView>;

export const PackageChoice = z.object({
  transportMode: z.enum(TRANSPORT_MODES),
  stayTier: z.enum(STAY_TIERS),
});
export type PackageChoice = z.infer<typeof PackageChoice>;

export const PackagesResponse = z.object({
  destination: z.object({ slug: z.string(), name: z.string(), state: z.string() }),
  n: z.number().int(),
  note: z.string().nullable(),
  /** Proposed and accepted packages, in 0005 b label order. */
  packages: z.array(TripPackageView),
  /** Every costable (mode, tier) pair, for the Change action. */
  choices: z.array(PackageChoice),
});
export type PackagesResponse = z.infer<typeof PackagesResponse>;

export const PackageOpinionInput = z.strictObject({
  decision: z.enum(['accept', 'reject']),
});
export type PackageOpinionInput = z.infer<typeof PackageOpinionInput>;

export const ChangePackageInput = z
  .strictObject({
    transportMode: z.enum(TRANSPORT_MODES).optional(),
    stayTier: z.enum(STAY_TIERS).optional(),
  })
  .refine((v) => v.transportMode !== undefined || v.stayTier !== undefined, {
    message: 'Change at least one of transport mode and stay tier.',
  });
export type ChangePackageInput = z.infer<typeof ChangePackageInput>;

export const PACKAGE_ERROR_CODES = {
  PACKAGE_NOT_FOUND: 'PACKAGE_NOT_FOUND',
  PACKAGE_NOT_PROPOSED: 'PACKAGE_NOT_PROPOSED',
  PACKAGE_CHOICE_UNAVAILABLE: 'PACKAGE_CHOICE_UNAVAILABLE',
} as const;
export type PackageErrorCode = keyof typeof PACKAGE_ERROR_CODES;
