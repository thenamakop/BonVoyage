import type { TripAction, TripDetail } from '@bonvoyage/shared';

// A TripDetail for web tests. progress is computed from members, and
// availableActions follows apps/api/src/trips/actions.ts for the statuses the
// tests use, so a test only states what it changes.

export const TRIP_ID = '11111111-1111-4111-8111-111111111111';

export function member(
  userId: string,
  name: string,
  { role = 'member', status = 'active', submitted = false } = {},
) {
  return {
    userId,
    name,
    role: role as 'organiser' | 'member',
    status: status as 'active' | 'excluded',
    submitted,
    joinedAt: '2026-10-12T00:00:00.000Z',
  };
}

function actionsFor(t: Omit<TripDetail, 'availableActions'>): TripAction[] {
  if (t.myStatus === 'excluded') return [];
  const organiser = t.myRole === 'organiser';
  const out: TripAction[] = [];
  const open = t.status === 'draft' || t.status === 'collecting_preferences';
  if (organiser && open) out.push({ action: 'invite', enabled: true });
  // 0004 j: details stay editable until the shortlist is made.
  if (
    organiser &&
    ['draft', 'collecting_preferences', 'ready_for_recommendation'].includes(t.status)
  )
    out.push({ action: 'editDetails', enabled: true });
  if (t.status === 'draft') {
    out.push({
      action: 'editPreferences',
      enabled: false,
      reason: 'Preferences open once the invite link exists.',
    });
  } else if (open || t.status === 'ready_for_recommendation') {
    out.push({ action: 'editPreferences', enabled: true });
  }
  if (organiser && t.status === 'collecting_preferences') {
    out.push(
      t.progress.submittedCount >= 2
        ? { action: 'closeSubmissions', enabled: true }
        : {
            action: 'closeSubmissions',
            enabled: false,
            reason: 'At least 2 members need to submit first.',
          },
    );
  }
  const planning = !['finalised', 'in_progress', 'completed', 'cancelled'].includes(t.status);
  if (organiser && planning) out.push({ action: 'cancelTrip', enabled: true });
  if (!organiser && open) out.push({ action: 'leaveTrip', enabled: true });
  return out;
}

export function tripDetail(overrides: Partial<TripDetail> = {}): TripDetail {
  const members = overrides.members ?? [
    member('u1', 'Asha', { role: 'organiser', submitted: true }),
    member('u2', 'Rohan', { submitted: true }),
    member('u3', 'Meera'),
  ];
  const active = members.filter((m) => m.status === 'active');
  const submitted = active.filter((m) => m.submitted).length;
  const base = {
    id: TRIP_ID,
    title: 'Long weekend in the hills',
    status: 'collecting_preferences' as const,
    originHub: { slug: 'gurugram', name: 'Gurugram', state: 'Haryana' },
    selectedDestination: null,
    durationNights: 2,
    budgetTotalInr: 48000,
    radiusKm: 450,
    startDate: null,
    endDate: null,
    organiser: { userId: 'u1', name: 'Asha' },
    myRole: 'organiser' as const,
    myStatus: 'active' as const,
    legalEvents: [],
    lastActivityAt: '2026-10-13T09:00:00.000Z',
    latestRecommendation: null,
    createdAt: '2026-10-12T00:00:00.000Z',
    updatedAt: '2026-10-12T00:00:00.000Z',
    ...overrides,
    members,
    progress: {
      activeCount: active.length,
      submittedCount: submitted,
      pendingCount: active.length - submitted,
      excludedCount: members.length - active.length,
      maxMembers: 8,
    },
  };
  return { ...base, availableActions: overrides.availableActions ?? actionsFor(base) };
}
