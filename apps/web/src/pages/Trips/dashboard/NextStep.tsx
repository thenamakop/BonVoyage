import type { TripDetail } from '@bonvoyage/shared';
import type { ReactNode } from 'react';
import { ButtonLink } from '../../../components/ui/Button';
import { useLatestRecommendation } from '../../../features/recommendations/api';
import { lastRoundText } from '../../../features/recommendations/wording';
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
  // After T4 or T6>T8 the dashboard says what the last round found; F3 needs
  // the run's bindingConstraint, which TripDetail's summary does not carry.
  const afterDiagnostic =
    trip.status === 'collecting_preferences' && trip.latestRecommendation?.kind === 'diagnostic';
  const latest = useLatestRecommendation(trip.id, trip.latestRecommendation, {
    enabled: afterDiagnostic,
  });
  const diagnostic = afterDiagnostic ? latest.data?.run : null;
  const prefs = trip.availableActions.find((a) => a.action === 'editPreferences');
  const me = trip.members.find((m) => m.userId === myUserId);
  const prefsLink = (label: string) =>
    prefs?.enabled ? (
      <ButtonLink to={`/trips/${trip.id}/preferences`} fullWidth>
        {label}
      </ButtonLink>
    ) : null;

  const shortlistLink = (label: string) => (
    <ButtonLink to={`/trips/${trip.id}/shortlist`} variant="secondary" fullWidth>
      {label}
    </ButtonLink>
  );
  const organiserName = trip.organiser.name;
  const organiser = trip.myRole === 'organiser';

  if (trip.myStatus === 'excluded') {
    const view = trip.availableActions.some((a) => a.action === 'viewRecommendations');
    return (
      <Callout text="You were removed from this trip, so you can only view it.">
        {view ? shortlistLink('See the recommendations') : null}
      </Callout>
    );
  }
  if (trip.status === 'draft') {
    return trip.myRole === 'organiser' ? (
      <Callout text="Create the invite link to open the trip." />
    ) : (
      <Callout text={prefs?.reason ?? 'Preferences open once the invite link exists.'} />
    );
  }
  if (trip.status === 'collecting_preferences') {
    if (diagnostic) {
      return (
        <Callout text={lastRoundText(diagnostic)}>
          {shortlistLink('See why')}
          {prefsLink('Edit your preferences')}
        </Callout>
      );
    }
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
      <Callout
        text={
          organiser
            ? 'Get recommendations when you are ready.'
            : `Waiting for ${organiserName} to get recommendations.`
        }
      >
        {prefsLink('Edit your preferences')}
      </Callout>
    );
  }
  if (trip.status === 'shortlisted') {
    return (
      <Callout
        text={
          organiser
            ? 'Choose a destination from the shortlist.'
            : `Waiting for ${organiserName} to choose a destination.`
        }
      >
        {shortlistLink('See the shortlist')}
      </Callout>
    );
  }
  if (trip.status === 'packages_proposed' && trip.selectedDestination) {
    return (
      <Callout
        text={`${trip.selectedDestination.name} chosen. Packages arrive in the next release.`}
      />
    );
  }
  if (trip.status === 'cancelled') return <Callout text="This trip was cancelled." />;
  return null;
}
