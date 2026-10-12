import type { TripDetail } from '@bonvoyage/shared';
import type { ReactNode } from 'react';
import { ButtonLink } from '../../../components/ui/Button';
import { waitingFor } from './wording';

// The next-step callout, worded for this viewer (wireframe 06).

function Callout({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <section
      aria-label="Next step"
      className="mb-4 space-y-3 rounded-lg border-l-4 border-brand-700 bg-white p-4"
    >
      <p className="text-sm font-medium text-slate-900">{text}</p>
      {children}
    </section>
  );
}

export function NextStep({ trip, myUserId }: { trip: TripDetail; myUserId: string | undefined }) {
  const prefs = trip.availableActions.find((a) => a.action === 'editPreferences');
  const me = trip.members.find((m) => m.userId === myUserId);
  const prefsLink = (label: string) =>
    prefs?.enabled ? (
      <ButtonLink to={`/trips/${trip.id}/preferences`} fullWidth>
        {label}
      </ButtonLink>
    ) : null;

  if (trip.myStatus === 'excluded') {
    return <Callout text="You were removed from this trip, so you can only view it." />;
  }
  if (trip.status === 'draft') {
    return trip.myRole === 'organiser' ? (
      <Callout text="Create the invite link to open the trip." />
    ) : (
      <Callout text={prefs?.reason ?? 'Preferences open once the invite link exists.'} />
    );
  }
  if (trip.status === 'collecting_preferences') {
    if (!me?.submitted) {
      return (
        <Callout text="Fill in your preferences.">{prefsLink('Fill in your preferences')}</Callout>
      );
    }
    const pending = trip.members
      .filter((m) => m.status === 'active' && !m.submitted)
      .map((m) => m.name);
    return <Callout text={waitingFor(pending)}>{prefsLink('Edit your preferences')}</Callout>;
  }
  if (trip.status === 'ready_for_recommendation') {
    return (
      <Callout text="Everyone is in. Recommendations arrive in the next release.">
        {prefsLink('Edit your preferences')}
      </Callout>
    );
  }
  if (trip.status === 'cancelled') return <Callout text="This trip was cancelled." />;
  return null;
}
