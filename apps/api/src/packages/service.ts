import type { Db } from '@bonvoyage/db';
import { costItem, packageDecision, trip, tripPackage } from '@bonvoyage/db/schema';
import type { destination as DestinationTable } from '@bonvoyage/db/schema';
import {
  availableChoices,
  costPackage,
  generatePackages,
  type PackageDraft,
  type PackageInput,
} from '@bonvoyage/engine';
import type { PlannerPlace } from '@bonvoyage/engine';
import { groupProfile } from '@bonvoyage/engine';
import { and, eq } from 'drizzle-orm';
import type { Logger } from 'pino';
import {
  ERROR_CODES,
  type ChangePackageInput,
  type PackagesResponse,
  type TripPackageView,
} from '@bonvoyage/shared';
import { AppError } from '../http/errors';
import type { MemberInput } from '@bonvoyage/engine';
import { transitionTrip, type Tx } from '../trips/transition-trip';
import {
  loadTripForMember,
  requireActiveMember,
  requireOrganiser,
  type TripRow,
} from '../trips/access';
import { loadMembers } from '../recommendations/service';
import { getTrip } from '../trips/service';
import {
  countProposed,
  findPackage,
  listPackagesWithCounts,
  loadPackageSource,
} from './repository';

interface Deps {
  db: Db;
  logger: Logger;
  clock: () => Date;
}

const PACKAGE_ERROR = {
  notFound: () => new AppError(404, ERROR_CODES.PACKAGE_NOT_FOUND, 'Package not found.'),
  notProposed: () =>
    new AppError(409, ERROR_CODES.PACKAGE_NOT_PROPOSED, 'That package is not proposed.'),
  choiceUnavailable: () =>
    new AppError(
      422,
      ERROR_CODES.PACKAGE_CHOICE_UNAVAILABLE,
      'That mode and tier cannot be costed for this trip.',
    ),
};

const COST_RULE_KEYS: Record<
  string,
  'fuelPriceInrPerLitre' | 'carKmPerLitre' | 'tollInrPerKm' | 'personsPerCar' | 'carRentalInrPerDay'
> = {
  fuel_price_inr_per_litre: 'fuelPriceInrPerLitre',
  car_km_per_litre: 'carKmPerLitre',
  toll_inr_per_km: 'tollInrPerKm',
  persons_per_car: 'personsPerCar',
  car_rental_inr_per_day: 'carRentalInrPerDay',
};

/** Build the engine input for a (trip, destination) pair (0005 c/d). */
export async function packageInput(
  db: Db | Tx,
  tripRow: TripRow & { durationNights: number; budgetTotalInr: number },
  members: MemberInput[],
  dest: typeof DestinationTable.$inferSelect,
): Promise<PackageInput> {
  const profile = groupProfile(members, tripRow);
  const { dest: d, fares, rules, pois } = await loadPackageSource(db, tripRow.originHubId, dest.id);
  const hubRow = await db.query.hub.findFirst({
    where: (h, { eq }) => eq(h.id, tripRow.originHubId),
  });
  const fareOf = (mode: 'bus' | 'train' | 'car') => fares.find((f) => f.mode === mode);
  const bus = fareOf('bus');
  const train = fareOf('train');
  const car = fareOf('car');
  const costRules = {
    fuelPriceInrPerLitre: 0,
    carKmPerLitre: 0,
    tollInrPerKm: 0,
    personsPerCar: 4,
    carRentalInrPerDay: 0,
  };
  for (const r of rules) {
    const key = COST_RULE_KEYS[r.key];
    if (key) costRules[key] = r.value;
  }
  const groupInterests = profile.activityVotes.filter((v) => v.count >= 2).map((v) => v.value);
  return {
    n: members.length,
    nights: tripRow.durationNights,
    startDate: profile.commonWindow?.start ?? tripRow.startDate ?? '2026-11-01',
    groupCapInr: Math.min(tripRow.budgetTotalInr, members.length * profile.perPersonCapInr),
    originName: hubRow?.name ?? '',
    destinationName: d?.name ?? dest.name,
    hubSlug: hubRow?.slug ?? '',
    destinationSlug: d?.slug ?? dest.slug,
    modes: {
      bus:
        bus?.farePerPersonInr !== null && bus?.farePerPersonInr !== undefined
          ? {
              farePerPersonInr: bus.farePerPersonInr,
              durationMinutes: bus.durationMinutes,
              verified: bus.reviewStatus === 'verified',
            }
          : null,
      train:
        train?.farePerPersonInr !== null && train?.farePerPersonInr !== undefined
          ? {
              farePerPersonInr: train.farePerPersonInr,
              durationMinutes: train.durationMinutes,
              verified: train.reviewStatus === 'verified',
            }
          : null,
      car: {
        km: car?.distanceKm ?? 0,
        durationMinutes: car?.durationMinutes ?? 0,
        verified: (car?.reviewStatus ?? 'draft') === 'verified',
      },
    },
    costRules: { ...costRules, verified: rules.every((r) => r.verified === 'verified') },
    stay: {
      budget: dest.stayBudgetInr,
      mid: dest.stayMidInr,
      premium: dest.stayPremiumInr,
    },
    costVerified: dest.costReviewStatus === 'verified',
    foodPerDayInr: dest.foodPerDayInr ?? 0,
    localPerDayInr: dest.localPerDayInr ?? 0,
    places: pois.map((p): PlannerPlace => ({
      key: `${d?.slug ?? dest.slug}/${p.poiKey}`,
      name: p.name,
      category: p.category,
      typicalMinutes: p.typicalMinutes,
      openTime: p.openTime,
      closeTime: p.closeTime,
      closedDays: p.closedDays,
      entryFeeInr: p.entryFeeInr,
      verified: p.reviewStatus === 'verified',
    })),
    groupInterests,
  };
}

/** T9 (0005 a): drafts before the lock; rows inside beforeDecide. */
export async function draftPackages(
  db: Db,
  tripRow: TripRow,
  members: MemberInput[],
  destinationId: string,
): Promise<{ input: PackageInput; drafts: PackageDraft[]; note: string | null }> {
  const dest = await db.query.destination.findFirst({
    where: (d, { eq }) => eq(d.id, destinationId),
  });
  if (!dest) throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Destination not found.');
  const input = await packageInput(db, tripRow, members, dest);
  const { packages, note } = generatePackages(input);
  return { input, drafts: packages, note };
}

/** Inserts trip_package + cost_item rows; hides earlier generations (P7). */
export async function storePackages(
  tx: Tx,
  tripId: string,
  destinationId: string,
  drafts: PackageDraft[],
): Promise<void> {
  await tx
    .update(tripPackage)
    .set({ status: 'hidden' })
    .where(and(eq(tripPackage.tripId, tripId), eq(tripPackage.status, 'proposed')));
  for (const draft of drafts) {
    const [row] = await tx
      .insert(tripPackage)
      .values({
        tripId,
        destinationId,
        label: draft.label,
        transportMode: draft.transportMode,
        stayTier: draft.stayTier,
        rooms: draft.rooms,
        startDate: draft.startDate,
        endDate: draft.endDate,
        totalInr: draft.totalInr,
        perPersonInr: draft.perPersonInr,
        overBudget: draft.overBudget,
        status: 'proposed',
      })
      .returning({ id: tripPackage.id });
    const packageId = row!.id; // INSERT ... RETURNING returns the row or throws.
    await tx.insert(costItem).values(
      draft.lines.map((line) => ({
        packageId,
        category: line.category,
        label: line.label,
        amountInr: line.amountInr,
        provenance: line.provenance,
        sourceRef: line.sourceRef,
      })),
    );
  }
}

const LABEL_ORDER = ['Saver', 'Balanced', 'Quickest', 'Comfort', 'Comfort by car'];

function toView(
  pkg: typeof tripPackage.$inferSelect,
  lines: { category: string; label: string; amountInr: number; provenance: string }[],
  votes: { works: number; notForMe: number; members: number },
  mine: 'accept' | 'reject' | null,
  groupCapInr: number | null,
): TripPackageView {
  // From the stored total, not a fresh default package: after a change (I3)
  // the row's mode and tier differ from what generatePackages would build.
  const overByInr = groupCapInr === null ? 0 : Math.max(0, pkg.totalInr - groupCapInr);
  return {
    id: pkg.id,
    label: pkg.label,
    transportMode: pkg.transportMode,
    stayTier: pkg.stayTier,
    rooms: pkg.rooms,
    startDate: pkg.startDate,
    endDate: pkg.endDate,
    totalInr: pkg.totalInr,
    perPersonInr: pkg.perPersonInr,
    overBudget: groupCapInr === null ? pkg.overBudget : overByInr > 0,
    overByInr,
    status: pkg.status,
    lines: lines as TripPackageView['lines'],
    opinions: votes,
    mine,
  };
}

export async function getPackages(
  db: Db | Tx,
  tripRow: TripRow,
  members: MemberInput[],
  destinationId: string,
  viewerId: string,
): Promise<PackagesResponse> {
  const { all, decisions, lines, memberCount } = await listPackagesWithCounts(
    db,
    tripRow.id,
    viewerId,
  );
  const dest = await db.query.destination.findFirst({
    where: (d, { eq }) => eq(d.id, destinationId),
  });
  const input = dest ? await packageInput(db, tripRow, members, dest) : null;
  // generatePackages only for the note: it counts what the destination can
  // cost, which the stored rows (some removed or changed) do not show.
  const note = input ? generatePackages(input).note : null;

  const views: TripPackageView[] = all
    .map((pkg) => {
      const pkgLines = lines.filter((l) => l.cost_item.packageId === pkg.id);
      const votes = decisions.filter((d) => d.package_decision.packageId === pkg.id);
      return toView(
        pkg,
        pkgLines.map((l) => l.cost_item),
        {
          works: votes.filter((v) => v.package_decision.decision === 'accept').length,
          notForMe: votes.filter((v) => v.package_decision.decision === 'reject').length,
          members: memberCount,
        },
        (votes.find((v) => v.package_decision.userId === viewerId)?.package_decision.decision as
          'accept' | 'reject' | undefined) ?? null,
        input?.groupCapInr ?? null,
      );
    })
    .sort((a, b) => LABEL_ORDER.indexOf(a.label) - LABEL_ORDER.indexOf(b.label));

  return {
    destination: dest
      ? { slug: dest.slug, name: dest.name, state: dest.state }
      : { slug: '', name: '', state: '' },
    n: memberCount,
    note,
    packages: views,
    choices: input
      ? availableChoices(input).map((c) => ({ transportMode: c.mode, stayTier: c.tier }))
      : [],
  };
}

export async function listTripPackages(
  db: Db,
  tripId: string,
  userId: string,
): Promise<PackagesResponse> {
  const { trip: tripRow } = await loadTripForMember(db, tripId, userId);
  const members = await loadMembers(db, tripId);
  if (!tripRow.selectedDestinationId || tripRow.status === 'shortlisted') {
    throw new AppError(409, ERROR_CODES.ILLEGAL_TRANSITION, 'Choose a destination first.');
  }
  return getPackages(db, tripRow, members, tripRow.selectedDestinationId, userId);
}

export async function giveOpinion(
  deps: Deps,
  tripId: string,
  packageId: string,
  userId: string,
  decision: 'accept' | 'reject',
): Promise<PackagesResponse> {
  const { db } = deps;
  const { trip: tripRow, membership } = await loadTripForMember(db, tripId, userId);
  requireActiveMember(membership);
  if (tripRow.status !== 'packages_proposed') {
    throw new AppError(409, ERROR_CODES.ILLEGAL_TRANSITION, 'Packages are not open for opinions.');
  }
  const pkg = await findPackage(db, packageId, tripId);
  if (!pkg) throw PACKAGE_ERROR.notFound();
  if (pkg.status !== 'proposed') throw PACKAGE_ERROR.notProposed();
  await db
    .insert(packageDecision)
    .values({ packageId, userId, decision })
    .onConflictDoUpdate({
      target: [packageDecision.packageId, packageDecision.userId],
      set: { decision },
    });
  const members = await loadMembers(db, tripId);
  return getPackages(db, tripRow, members, tripRow.selectedDestinationId!, userId);
}

export async function selectPackage(
  deps: Deps,
  tripId: string,
  packageId: string,
  userId: string,
): Promise<ReturnType<typeof getTrip>> {
  const { db } = deps;
  const { membership } = await loadTripForMember(db, tripId, userId);
  requireActiveMember(membership);
  requireOrganiser(membership);
  const pkg = await findPackage(db, packageId, tripId);
  if (!pkg) throw PACKAGE_ERROR.notFound();
  if (pkg.status !== 'proposed') throw PACKAGE_ERROR.notProposed();
  await transitionTrip(deps, {
    tripId,
    event: 'packageAccepted',
    actorUserId: userId,
    beforeDecide: async (tx) => {
      await tx.update(tripPackage).set({ status: 'accepted' }).where(eq(tripPackage.id, packageId));
      await tx
        .update(tripPackage)
        .set({ status: 'hidden' })
        .where(and(eq(tripPackage.tripId, tripId), eq(tripPackage.status, 'proposed')));
    },
  });
  return getTrip(db, tripId, userId);
}

export async function removePackage(
  deps: Deps,
  tripId: string,
  packageId: string,
  userId: string,
): Promise<ReturnType<typeof getTrip>> {
  const { db } = deps;
  const { membership } = await loadTripForMember(db, tripId, userId);
  requireActiveMember(membership);
  requireOrganiser(membership);
  const pkg = await findPackage(db, packageId, tripId);
  if (!pkg) throw PACKAGE_ERROR.notFound();
  if (pkg.status !== 'proposed') throw PACKAGE_ERROR.notProposed();
  const alternativesLeft = await countProposed(db, tripId, packageId);
  await transitionTrip(deps, {
    tripId,
    event: 'packageRejected',
    actorUserId: userId,
    alternativesLeft,
    beforeDecide: async (tx) => {
      await tx.update(tripPackage).set({ status: 'hidden' }).where(eq(tripPackage.id, packageId));
      // T10 (no alternatives): going back to shortlisted clears the choice.
      if (alternativesLeft === 0) {
        await tx.update(trip).set({ selectedDestinationId: null }).where(eq(trip.id, tripId));
      }
    },
  });
  return getTrip(db, tripId, userId);
}

export async function changePackage(
  deps: Deps,
  tripId: string,
  packageId: string,
  userId: string,
  input: ChangePackageInput,
): Promise<PackagesResponse> {
  const { db } = deps;
  const { trip: tripRow, membership } = await loadTripForMember(db, tripId, userId);
  requireActiveMember(membership);
  requireOrganiser(membership);
  const pkg = await findPackage(db, packageId, tripId);
  if (!pkg) throw PACKAGE_ERROR.notFound();
  if (pkg.status !== 'proposed') throw PACKAGE_ERROR.notProposed();
  const members = await loadMembers(db, tripId);
  const dest = await db.query.destination.findFirst({
    where: (d, { eq }) => eq(d.id, tripRow.selectedDestinationId!),
  });
  const engineInput = await packageInput(db, tripRow, members, dest!);
  const spec = {
    mode: input.transportMode ?? pkg.transportMode,
    tier: input.stayTier ?? pkg.stayTier,
  };
  if (!availableChoices(engineInput).some((c) => c.mode === spec.mode && c.tier === spec.tier)) {
    throw PACKAGE_ERROR.choiceUnavailable();
  }
  const draft = costPackage(engineInput, { label: pkg.label, ...spec });
  if (!draft) throw PACKAGE_ERROR.choiceUnavailable();
  await transitionTrip(deps, {
    tripId,
    event: 'packageModified',
    actorUserId: userId,
    beforeDecide: async (tx) => {
      await tx.delete(costItem).where(eq(costItem.packageId, packageId));
      await tx.delete(packageDecision).where(eq(packageDecision.packageId, packageId));
      await tx
        .update(tripPackage)
        .set({
          transportMode: draft.transportMode,
          stayTier: draft.stayTier,
          rooms: draft.rooms,
          startDate: draft.startDate,
          endDate: draft.endDate,
          totalInr: draft.totalInr,
          perPersonInr: draft.perPersonInr,
          overBudget: draft.overBudget,
        })
        .where(eq(tripPackage.id, packageId));
      await tx.insert(costItem).values(
        draft.lines.map((line) => ({
          packageId,
          category: line.category,
          label: line.label,
          amountInr: line.amountInr,
          provenance: line.provenance,
          sourceRef: line.sourceRef,
        })),
      );
    },
  });
  return getPackages(db, tripRow, members, tripRow.selectedDestinationId!, userId);
}
