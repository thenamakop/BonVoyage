import { useId, useState } from 'react';
import type {
  DiagnosticEvaluation,
  RecommendationItem,
  RecommendationRun,
  Suggestion,
  TripDetail,
} from '@bonvoyage/shared';
import { Alert } from '../../../components/ui/Alert';
import { Button, ButtonLink } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import {
  alternativeText,
  ASK_BUDGET_REVIEW_LABEL,
  bindingText,
  budgetReviewAskedText,
  fitHeading,
  MEMBERS_MAXIMA_LINE,
  perPersonTargetText,
  raiseGroupBudgetText,
  suggestionField,
  suggestionPatch,
  suggestionText,
  togetherAddsText,
  unlocksText,
} from '../../../features/recommendations/wording';
import { useRequestBudgetReview } from '../../../features/notifications/api';
import { useUpdateTrip } from '../../../features/trips/api';
import { ApiError } from '../../../lib/api';
import { GetRecommendations } from '../dashboard/GetRecommendations';
import { CloseSubmissions } from '../dashboard/OrganiserActions';
import { DestinationCard } from './DestinationCard';

// Wireframe 08 (R5, 0004 j): fewer than 3 destinations fit. The page names the
// binding limit, the nearest misses and the smallest changes that would help.
// Only the organiser can apply a change, and only to trip parameters; members'
// maxima and dates stay theirs to change.

function SuggestionButton({
  trip,
  suggestion,
  nearMisses,
  saved,
  onSaved,
}: {
  trip: TripDetail;
  suggestion: Suggestion;
  nearMisses: readonly DiagnosticEvaluation[];
  /** Already applied: the same PATCH again would change nothing. */
  saved: boolean;
  onSaved: () => void;
}) {
  const update = useUpdateTrip(trip.id);
  const unlocksId = useId();
  const unlocks = unlocksText(suggestion.unlocks ?? [], nearMisses);
  // Only called for suggestions with a PATCH (see the caller).
  const patch = suggestionPatch(suggestion) ?? {};
  const field = suggestionField(suggestion);
  const err = update.error;
  // A 400 shows the server's field message as sent; nothing is clamped (amendment 8).
  const message =
    err instanceof ApiError
      ? ((field ? err.fields?.[field] : undefined) ?? err.message)
      : err
        ? 'Something went wrong. Try again.'
        : null;
  return (
    <div className="space-y-1">
      <Button
        variant="secondary"
        loading={update.isPending}
        disabled={saved}
        aria-describedby={unlocks ? unlocksId : undefined}
        onClick={() => update.mutate(patch, { onSuccess: onSaved })}
      >
        {suggestionText(suggestion)}
      </Button>
      {unlocks ? (
        <p id={unlocksId} className="text-sm text-slate-600">
          This {unlocks}.
        </p>
      ) : null}
      {message ? <Alert tone="error">{message}</Alert> : null}
    </div>
  );
}

// #163 (option A): a suggestion that needs both caps to move. The organiser
// raises the trip budget in one tap and asks members to review theirs in
// another; the message carries no figure, so nobody's maximum is shown.
function AskBudgetReview({ trip }: { trip: TripDetail }) {
  const ask = useRequestBudgetReview(trip.id);
  // The server owns the limit: a 201 says when, and after a reload
  // canRequestBudgetReviewAt says the same thing until that time passes.
  const againAt = ask.data?.canRequestAgainAt ?? trip.canRequestBudgetReviewAt ?? null;
  const err = ask.error;
  const message =
    err instanceof ApiError
      ? err.message // The server's sentence as sent (429 and 409, amendment 11).
      : err
        ? 'Something went wrong. Try again.'
        : null;
  return (
    <div className="space-y-1">
      <Button
        variant="secondary"
        loading={ask.isPending}
        disabled={againAt !== null}
        aria-describedby={againAt ? 'budget-review-again' : undefined}
        onClick={() => ask.mutate()}
      >
        {ASK_BUDGET_REVIEW_LABEL}
      </Button>
      {againAt ? (
        <p id="budget-review-again" className="text-sm text-slate-600">
          {budgetReviewAskedText(againAt)}
        </p>
      ) : null}
      {message ? <Alert tone="error">{message}</Alert> : null}
    </div>
  );
}

function RaisesBothBlock({
  trip,
  suggestion,
  nearMisses,
  canEdit,
  saved,
  onSaved,
}: {
  trip: TripDetail;
  suggestion: Extract<Suggestion, { constraint: 'F5' }>;
  nearMisses: readonly DiagnosticEvaluation[];
  canEdit: boolean;
  saved: boolean;
  onSaved: () => void;
}) {
  const update = useUpdateTrip(trip.id);
  const unlocksId = useId();
  // Below 3 contributing members the API strips every figure (D1, #116): only
  // the flag arrives, so this block carries the line and the button alone.
  const newGroupCapInr = suggestion.newGroupCapInr;
  const full = newGroupCapInr !== undefined;
  const together = full ? togetherAddsText(suggestion.unlocks ?? [], nearMisses) : null;
  const err = update.error;
  const message =
    err instanceof ApiError
      ? (err.fields?.['budgetTotalInr'] ?? err.message)
      : err
        ? 'Something went wrong. Try again.'
        : null;
  return (
    <div className="space-y-1">
      {full && canEdit ? (
        <>
          <Button
            variant="secondary"
            loading={update.isPending}
            disabled={saved}
            aria-describedby={together ? unlocksId : undefined}
            onClick={() =>
              update.mutate({ budgetTotalInr: newGroupCapInr }, { onSuccess: onSaved })
            }
          >
            {raiseGroupBudgetText(newGroupCapInr)}
          </Button>
          {together ? (
            <p id={unlocksId} className="text-sm text-slate-600">
              {together}
            </p>
          ) : null}
          {suggestion.capSource === 'members' && suggestion.newPerPersonMaxInr !== undefined ? (
            <p className="text-sm text-slate-900">
              {perPersonTargetText(suggestion.newPerPersonMaxInr)}
            </p>
          ) : null}
          {message ? <Alert tone="error">{message}</Alert> : null}
        </>
      ) : full ? (
        <SuggestionTextItem suggestion={suggestion} nearMisses={nearMisses} />
      ) : null}
      <p className="text-sm text-slate-900">{MEMBERS_MAXIMA_LINE}</p>
      {trip.myRole === 'organiser' ? <AskBudgetReview trip={trip} /> : null}
    </div>
  );
}

function SuggestionTextItem({
  suggestion,
  nearMisses,
}: {
  suggestion: Suggestion;
  nearMisses: readonly DiagnosticEvaluation[];
}) {
  const unlocks = unlocksText(suggestion.unlocks ?? [], nearMisses);
  return (
    <p className="text-sm text-slate-900">
      {suggestionText(suggestion)}
      {unlocks ? <span className="text-slate-600"> ({unlocks})</span> : null}
    </p>
  );
}

export function DiagnosticView({
  trip,
  run,
  items,
}: {
  trip: TripDetail;
  run: RecommendationRun;
  items: RecommendationItem[];
}) {
  // The caller keys this view on run.id, so a new run starts with nothing saved.
  const [saved, setSaved] = useState<Suggestion['constraint'] | null>(null);
  const find = (name: string) => trip.availableActions.find((a) => a.action === name && a.enabled);
  const organiser = trip.myRole === 'organiser';
  const canEdit = organiser && Boolean(find('editDetails'));
  const markReady = organiser ? find('closeSubmissions') : undefined;
  const recommend = organiser ? find('requestRecommendations') : undefined;
  const prefs = !organiser ? find('editPreferences') : undefined;
  const diagnostic = run.diagnostic;
  const nearMisses = diagnostic?.nearMisses ?? [];
  // amendment 6: no binding constraint means no single change helps.
  const suggestions = run.bindingConstraint === null ? [] : (diagnostic?.suggestions ?? []);
  const alternatives = diagnostic?.alternatives ?? [];

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">{fitHeading(run.feasibleCount)}</h2>
        <p className="text-sm text-slate-900">{bindingText(run, trip.durationNights)}</p>

        {alternatives.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Closest misses</h3>
            <ul className="mt-1 list-inside list-disc text-sm text-slate-900">
              {alternatives.map((e) => (
                <li key={e.slug}>{alternativeText(e)}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {run.bindingConstraint === 'F3' || suggestions.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-900">Try one of these changes:</h3>
            {run.bindingConstraint === 'F3' ? (
              <p className="text-sm text-slate-900">Ask members to check their dates</p>
            ) : null}
            {suggestions.map((s) =>
              s.constraint === 'F5' && s.raisesBoth === true ? (
                <RaisesBothBlock
                  key={s.constraint}
                  trip={trip}
                  suggestion={s}
                  nearMisses={nearMisses}
                  canEdit={canEdit}
                  saved={saved === s.constraint}
                  onSaved={() => setSaved(s.constraint)}
                />
              ) : canEdit && suggestionPatch(s) ? (
                <SuggestionButton
                  key={s.constraint}
                  trip={trip}
                  suggestion={s}
                  nearMisses={nearMisses}
                  saved={saved === s.constraint}
                  onSaved={() => setSaved(s.constraint)}
                />
              ) : (
                <SuggestionTextItem key={s.constraint} suggestion={s} nearMisses={nearMisses} />
              ),
            )}
          </div>
        ) : null}

        {saved !== null && markReady ? (
          <Alert tone="success">
            Saved. Now mark the trip ready again and get recommendations.
          </Alert>
        ) : null}
        {markReady ? <CloseSubmissions trip={trip} action={markReady} /> : null}
        {recommend ? <GetRecommendations tripId={trip.id} /> : null}
        {prefs ? (
          <ButtonLink to={`/trips/${trip.id}/preferences`} variant="secondary">
            Edit your preferences
          </ButtonLink>
        ) : null}
      </Card>

      {items.length > 0 && run.weakMatch ? (
        <Alert tone="info">
          These are the closest options; none match the types the group asked for well.
        </Alert>
      ) : null}
      {items.length > 0 ? (
        <ol className="space-y-3" aria-label="Destinations that fit">
          {items.map((item) => (
            <li key={item.destination.slug}>
              <DestinationCard item={item} tripId={trip.id} canChoose={false} />
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
