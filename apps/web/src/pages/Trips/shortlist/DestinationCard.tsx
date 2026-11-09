import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import type { RecommendationItem } from '@bonvoyage/shared';
import { Alert } from '../../../components/ui/Alert';
import { panelClass } from '../../../components/ui/panel';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { useChooseDestination } from '../../../features/recommendations/api';
import {
  chooseConfirmText,
  climateText,
  costText,
  distanceText,
  forYouText,
  groupScoreText,
  sharedText,
  voteCountText,
} from '../../../features/recommendations/wording';
import { ApiError } from '../../../lib/api';
import { VoteButton } from './VoteButton';

// One ranked destination (wireframe 07). Everything on it is the API's: the
// group sees aggregates, and "For you" comes only from the caller's own match.

const chip =
  'rounded-2xl border-2 border-ink bg-white px-3 py-1 text-xs font-semibold text-ink shadow-sticker-chip';

const errorText = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Something went wrong. Try again.';

function Choose({ tripId, item }: { tripId: string; item: RecommendationItem }) {
  const choose = useChooseDestination(tripId);
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const { name, slug } = item.destination;
  return (
    // Beside the vote button; the confirm or an error takes the whole row.
    <div className={confirming || choose.error ? 'basis-full space-y-2' : 'space-y-2'}>
      {/* T9: 422 DESTINATION_NOT_IN_SHORTLIST and 409 show as sent (amendment 11). */}
      {choose.error ? <Alert tone="error">{errorText(choose.error)}</Alert> : null}
      {confirming ? (
        <div className={`space-y-2 ${panelClass}`}>
          <p className="text-sm text-slate-900">{chooseConfirmText(name)}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              loading={choose.isPending}
              onClick={() =>
                choose.mutate(slug, {
                  onSuccess: () => void navigate(`/trips/${tripId}`),
                  onSettled: () => setConfirming(false),
                })
              }
            >
              Choose {name}
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Keep looking
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setConfirming(true)}>
          Choose
        </Button>
      )}
      <p role="status" className="sr-only">
        {choose.isPending ? `Choosing ${name}` : ''}
      </p>
    </div>
  );
}

/** R18: this card's share of the votes. Never who voted; `count` is absent while a pair waits (E4). */
export interface CardVote {
  count: number | undefined;
  mine: boolean;
  canVote: boolean;
  busy: boolean;
  onToggle: () => void;
}

export function DestinationCard({
  item,
  tripId,
  canChoose,
  vote,
}: {
  item: RecommendationItem;
  tripId: string;
  canChoose: boolean;
  vote?: CardVote | undefined;
}) {
  const headingId = useId();
  const score = groupScoreText(item.group);
  return (
    <Card as="article" aria-labelledby={headingId} className="space-y-1 text-sm">
      {/* tabIndex -1: "Show all" moves focus here; it is not a tab stop. The rank comes
          first in the text, so the heading still reads "1. Chakrata"; it shows top right. */}
      <h2
        id={headingId}
        tabIndex={-1}
        className="flex items-start justify-between gap-3 text-2xl text-ink"
      >
        <span className="order-last shrink-0 rounded-full border-2 border-ink bg-accent px-3 py-0.5 text-base shadow-sticker-chip">
          {item.rank}.
        </span>{' '}
        <span className="min-w-0 [overflow-wrap:anywhere]">{item.destination.name}</span>
      </h2>
      <p className="text-muted">{item.destination.state}</p>
      <div className="flex flex-wrap gap-2 py-2">
        <p className={chip}>{distanceText(item.distanceKm, item.distanceProvenance)}</p>
        <p className={chip}>{costText(item)}</p>
      </div>
      {score ? <p className="text-slate-900">{score}</p> : null}
      <p className="text-slate-900">{climateText(item.group)}</p>
      <p className="text-slate-900">{sharedText(item.group)}</p>
      {item.mine ? <p className="font-medium text-slate-900">{forYouText(item.mine)}</p> : null}
      {vote?.count !== undefined ? (
        <p className="font-medium text-slate-900">{voteCountText(vote.count)}</p>
      ) : null}
      {vote?.canVote || canChoose ? (
        <div className="flex flex-wrap items-start gap-3 pt-3">
          {vote?.canVote ? (
            <VoteButton mine={vote.mine} busy={vote.busy} onToggle={vote.onToggle} />
          ) : null}
          {canChoose ? <Choose tripId={tripId} item={item} /> : null}
        </div>
      ) : null}
    </Card>
  );
}
