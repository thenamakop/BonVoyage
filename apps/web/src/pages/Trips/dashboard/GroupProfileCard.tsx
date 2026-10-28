import type { ReactNode } from 'react';
import {
  ACTIVITY_LABELS,
  CLIMATE_PREFERENCE_LABELS,
  DESTINATION_TYPE_LABELS,
  type GroupProfileReady,
  type TripDetail,
} from '@bonvoyage/shared';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useGroupProfile } from '../../../features/recommendations/api';
import {
  BUDGET_HIDDEN_NOTE,
  ROUNDED_NOTE,
  budgetBandText,
  dateConflictText,
  moreInterestsText,
  voteText,
  windowLine,
} from '../../../features/recommendations/wording';
import { formatInr } from '../../../lib/format';

// S2-7 (R4): the group's combined answers. Counts only, values that 2 or more
// members share, no names anywhere (0004 i); every figure is the server's.

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-slate-600">{label}</dt>
      <dd className="text-slate-900">{children}</dd>
    </div>
  );
}

function Warning({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-start gap-1 text-amber-900">
      <span aria-hidden="true">⚠</span>
      <span>{children}</span>
    </span>
  );
}

function Profile({
  profile,
  durationNights,
}: {
  profile: GroupProfileReady;
  durationNights: number;
}) {
  const n = profile.memberCount;
  const conflict = dateConflictText(profile.conflicts, profile.commonWindow, durationNights);
  const interests = [
    ...profile.typeVotes.map((v) => voteText(DESTINATION_TYPE_LABELS[v.value], v.count, n)),
    ...profile.activityVotes.map((v) => voteText(ACTIVITY_LABELS[v.value], v.count, n)),
  ];
  const more = moreInterestsText(profile.otherInterestCount);
  const band = budgetBandText(profile);
  return (
    <dl className="mt-2 space-y-3 text-sm">
      <Row label="Dates everyone can make">
        {conflict || !profile.commonWindow ? (
          <Warning>{conflict ?? 'The dates members gave do not overlap.'}</Warning>
        ) : (
          windowLine(profile.commonWindow)
        )}
      </Row>
      <Row label="Budget per person">
        {profile.budgetBand.overlaps ? band : <Warning>{band}</Warning>}
        {profile.budgetBand.maxInr === null ? (
          <span className="block text-slate-600">{BUDGET_HIDDEN_NOTE}</span>
        ) : null}
      </Row>
      {profile.groupCapInr === null ? null : (
        <Row label="The group can spend">
          {formatInr(profile.groupCapInr)} for the group
          <span className="block text-slate-600">{ROUNDED_NOTE}</span>
        </Row>
      )}
      <Row label="Shared interests">
        {interests.length > 0 ? (
          <ul className="list-inside list-disc">
            {interests.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        ) : (
          <p>No interest is shared by 2 or more members yet.</p>
        )}
        {more ? <p className="text-slate-600">{more}</p> : null}
      </Row>
      <Row label="Climate">
        {profile.climateVotes.length > 0 ? (
          <ul className="list-inside list-disc">
            {profile.climateVotes.map((v) => (
              <li key={v.value}>{voteText(CLIMATE_PREFERENCE_LABELS[v.value], v.count, n)}</li>
            ))}
          </ul>
        ) : (
          <p>No climate is shared by 2 or more members yet.</p>
        )}
      </Row>
    </dl>
  );
}

export function GroupProfileCard({ trip }: { trip: TripDetail }) {
  const profile = useGroupProfile(trip.id, trip);
  let body: ReactNode;
  if (profile.isLoading) {
    body = <Skeleton className="mt-2 h-24" />;
  } else if (!profile.data) {
    body = (
      <div className="mt-2">
        <Alert
          tone="error"
          action={
            <Button variant="ghost" onClick={() => void profile.refetch()}>
              Reload the group profile
            </Button>
          }
        >
          The group profile could not be loaded.
        </Alert>
      </div>
    );
  } else if (!profile.data.ready) {
    body = (
      <p className="mt-2 text-sm text-slate-600">
        The group profile appears once 2 members have submitted.
      </p>
    );
  } else {
    body = <Profile profile={profile.data} durationNights={trip.durationNights} />;
  }
  return (
    <Card>
      <h2 className="text-sm font-semibold text-slate-900">Group profile</h2>
      {body}
    </Card>
  );
}
