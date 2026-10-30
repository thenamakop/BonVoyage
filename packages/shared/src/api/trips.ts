import { z } from 'zod';
import { MemberRole, MemberStatus, TripStatus } from '../domain';
import { LatestRecommendationSummary } from './recommendations';
import type { TripStatus as TripStatusType } from '../domain';

// Trip API contracts (S1-2). budgetTotalInr is the whole group's budget for
// the whole trip; per-person figures are display-only. TripMember never
// carries an email: members see each other's names only.

export const HubSummary = z.object({
  slug: z.string(),
  name: z.string(),
  state: z.string(),
});
export type HubSummary = z.infer<typeof HubSummary>;

export const HubsResponse = z.object({ hubs: z.array(HubSummary) });
export type HubsResponse = z.infer<typeof HubsResponse>;

// The events a trip can take (engine TRIP_EVENTS, mirrored here so web and
// api share one contract; packages/engine/src/trip-state.test.ts asserts the
// two lists never drift).
export const TripEventName = z.enum([
  'createTrip',
  'inviteMembers',
  'preferenceSubmitted',
  'closeSubmissions',
  'conflictDetected',
  'preferenceRevised',
  'recommendationRequested',
  'destinationSelected',
  'packageRejected',
  'packageAccepted',
  'generateItinerary',
  'itineraryRejected',
  'itineraryAccepted',
  'packageModified',
  'itineraryModified',
  'cancelTrip',
  'tripStarted',
  'tripEnded',
  'shortlistReopened',
  'voteCast',
]);
export type TripEventName = z.infer<typeof TripEventName>;

export const CreateTripInput = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Give the trip a title.')
    .max(120, 'Keep the title under 120 characters.'),
  originHubSlug: z.string().min(1, 'Choose a starting city from the list.'),
  durationNights: z
    .number('Enter the number of nights.')
    .int('Whole nights only.')
    .min(1, 'Choose between 1 and 14 nights.')
    .max(14, 'Choose between 1 and 14 nights.'),
  budgetTotalInr: z
    .number('Enter the group budget in rupees.')
    .int('Whole rupees only.')
    .min(1000, 'The group budget must be at least ₹1,000.')
    .max(10000000, 'The group budget must be under ₹1,00,00,000.'),
  radiusKm: z
    .number('Enter the radius in kilometres.')
    .int('Whole kilometres only.')
    .min(50, 'Radius must be at least 50 km.')
    .max(1500, 'Radius must be 1,500 km or less.'),
});
export type CreateTripInput = z.infer<typeof CreateTripInput>;

export const UpdateTripInput = CreateTripInput.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'Change at least one field.' },
);
export type UpdateTripInput = z.infer<typeof UpdateTripInput>;

export const TripMember = z.object({
  userId: z.string(),
  name: z.string(),
  role: MemberRole,
  status: MemberStatus,
  submitted: z.boolean(),
  joinedAt: z.string(),
  /**
   * S5-3: only for the organiser, and only on a member they could remind. Null when
   * reminding is allowed now, else when it next is. Omitted for everyone else.
   */
  canRemindAt: z.string().nullable().optional(),
});
export type TripMember = z.infer<typeof TripMember>;

// S1-5: the dashboard's counts, computed from trip_member (active and
// excluded rows; maxMembers is MAX_MEMBERS).
export const TripProgress = z.object({
  activeCount: z.number().int(),
  submittedCount: z.number().int(),
  pendingCount: z.number().int(),
  excludedCount: z.number().int(),
  maxMembers: z.number().int(),
});
export type TripProgress = z.infer<typeof TripProgress>;

export const TripActionName = z.enum([
  'invite',
  'editDetails',
  'editPreferences',
  'closeSubmissions',
  'cancelTrip',
  'leaveTrip',
  'requestRecommendations',
  'viewRecommendations',
  'chooseDestination',
  'viewPackages',
  'givePackageOpinion',
  'choosePackage',
  'removePackage',
  'changePackage',
  'planDays',
  'viewItinerary',
  'acceptItinerary',
  'rejectItinerary',
  'modifyItinerary',
  'reopenShortlist',
]);
export type TripActionName = z.infer<typeof TripActionName>;

/** An action this viewer may take now; a disabled one carries the reason. */
export const TripAction = z.object({
  action: TripActionName,
  enabled: z.boolean(),
  reason: z.string().optional(),
});
export type TripAction = z.infer<typeof TripAction>;

export const TripDetail = z.object({
  id: z.string(),
  title: z.string(),
  status: TripStatus,
  originHub: HubSummary,
  selectedDestination: HubSummary.nullable(),
  durationNights: z.number(),
  budgetTotalInr: z.number(),
  radiusKm: z.number(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  organiser: z.object({ userId: z.string(), name: z.string() }),
  members: z.array(TripMember),
  myRole: MemberRole,
  myStatus: MemberStatus,
  legalEvents: z.array(TripEventName),
  progress: TripProgress,
  availableActions: z.array(TripAction),
  /** created_at of the newest trip_transition row; the activity list reloads when it moves. */
  lastActivityAt: z.string().nullable(),
  /** The newest recommendation run (S2-6), or null before the first one. */
  latestRecommendation: LatestRecommendationSummary.nullable(),
  /** The accepted package (S3-3), or null until one is chosen. */
  selectedPackage: z
    .object({
      id: z.string(),
      label: z.string(),
      totalInr: z.number().int(),
      perPersonInr: z.number().int(),
    })
    .nullable(),
  /** The newest itinerary version (S3-6), or null before T12. */
  latestItinerary: z.object({ version: z.number().int(), status: z.string() }).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TripDetail = z.infer<typeof TripDetail>;

export const TripSummary = z.object({
  id: z.string(),
  title: z.string(),
  status: TripStatus,
  originHub: HubSummary,
  durationNights: z.number(),
  budgetTotalInr: z.number(),
  memberCount: z.number(),
  myRole: MemberRole,
  updatedAt: z.string(),
});
export type TripSummary = z.infer<typeof TripSummary>;

export const TripsResponse = z.object({ trips: z.array(TripSummary) });
export type TripsResponse = z.infer<typeof TripsResponse>;

// Status names and plain-language explanations for badges and the trip page.
export const TRIP_STATUS_LABELS: Record<TripStatusType, { label: string; explanation: string }> = {
  draft: {
    label: 'Draft',
    explanation: 'The organiser is still setting up the trip; nobody has been invited yet.',
  },
  collecting_preferences: {
    label: 'Collecting preferences',
    explanation: 'Members are filling in what they want from the trip.',
  },
  ready_for_recommendation: {
    label: 'Ready for recommendations',
    explanation: 'Every active member has submitted; the group can ask for a shortlist.',
  },
  shortlisted: {
    label: 'Shortlist ready',
    explanation: 'Destinations that fit the group are ranked and waiting for a choice.',
  },
  packages_proposed: {
    label: 'Packages proposed',
    explanation: 'Costed packages are ready for the group to compare.',
  },
  package_selected: {
    label: 'Package selected',
    explanation: 'The group has picked a package; an itinerary can now be generated.',
  },
  itinerary_proposed: {
    label: 'Itinerary proposed',
    explanation: 'A day-wise plan is ready for the group to review.',
  },
  finalised: {
    label: 'Finalised',
    explanation: 'The day plan is accepted; the trip is ready to go.',
  },
  in_progress: {
    label: 'In progress',
    explanation: 'The trip is happening now.',
  },
  completed: {
    label: 'Completed',
    explanation: 'The trip is finished; feedback may still come in.',
  },
  cancelled: {
    label: 'Cancelled',
    explanation: 'The trip was called off.',
  },
};

/** POST /api/trips/:id/close-submissions takes an empty object. */
export const CloseSubmissionsInput = z.strictObject({});
export type CloseSubmissionsInput = z.infer<typeof CloseSubmissionsInput>;

export const ActivityItem = z.object({
  id: z.string(),
  transitionId: z.string(),
  event: z.string(),
  fromStatus: z.string().nullable(),
  toStatus: z.string(),
  actorName: z.string().nullable(),
  createdAt: z.string(),
  summary: z.string(),
});
export type ActivityItem = z.infer<typeof ActivityItem>;

export const ActivityResponse = z.object({ items: z.array(ActivityItem) });
export type ActivityResponse = z.infer<typeof ActivityResponse>;

// One sentence per state-machine event for the activity list. Joining,
// leaving and removal are not events, so they never appear here (S1-5).
export const EVENT_SUMMARIES: Record<TripEventName, (actor: string, detail?: string) => string> = {
  createTrip: (a) => `${a} created the trip`,
  inviteMembers: (a) => `${a} opened the trip for preferences`,
  preferenceSubmitted: (a) => `${a} submitted preferences`,
  closeSubmissions: (a) => `${a} closed submissions`,
  conflictDetected: (a) => `${a} found the group's dates do not overlap enough`,
  preferenceRevised: (a) => `${a} updated preferences`,
  recommendationRequested: (a) => `${a} asked for recommendations`,
  destinationSelected: (a) => `${a} chose the destination`,
  packageRejected: (a) => `${a} turned down the packages`,
  packageAccepted: (a, d) => `${a} accepted the ${d ?? ''} package`,
  generateItinerary: (a, d) => `${a} planned the days${d ? ` (${d})` : ''}`,
  itineraryRejected: (a) => `${a} asked for a new day plan`,
  itineraryAccepted: (a) => `${a} accepted the day plan; the trip is finalised`,
  packageModified: (a) => `${a} changed the package`,
  itineraryModified: (a) => `${a} adjusted the day plan`,
  cancelTrip: (a) => `${a} cancelled the trip`,
  tripStarted: (a) => `${a} marked the trip as started`,
  tripEnded: (a) => `${a} marked the trip as finished`,
  shortlistReopened: (a) => `${a} asked for new recommendations`,
  // Never shown: the activity list leaves I6 out, because a name beside a count
  // that just moved would say who voted for what (R18).
  voteCast: (a) => `${a} changed their vote`,
};

/** The activity sentence for a stored event; a missing actor reads "Someone". */
export function summarizeEvent(event: string, actorName: string | null, detail?: string): string {
  const parsed = TripEventName.safeParse(event);
  const actor = actorName ?? 'Someone';
  return parsed.success ? EVENT_SUMMARIES[parsed.data](actor, detail) : `${actor} changed the trip`;
}
