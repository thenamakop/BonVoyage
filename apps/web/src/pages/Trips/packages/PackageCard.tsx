import { useId, useState } from 'react';
import type {
  PackageChoice,
  StayTier,
  TransportMode,
  TripAction,
  TripPackageView,
} from '@bonvoyage/shared';
import { TRANSPORT_MODE_LABELS } from '@bonvoyage/shared';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { ApiError } from '../../../lib/api';
import { formatDate, formatInr } from '../../../lib/format';
import {
  useChangePackage,
  useChoosePackage,
  useGiveOpinion,
  useRemovePackage,
} from '../../../features/packages/api';

// S3-4 (wireframe 09): one costed package. Money and labels come from the API;
// nothing is computed here.

const TIER_LABELS: Record<StayTier, string> = {
  budget: 'Budget',
  mid: 'Mid',
  premium: 'Premium',
};

const errorText = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Something went wrong. Try again.';

function Confirm({
  text,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  text: string;
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-2 rounded-md border border-slate-300 p-3">
      <p className="text-sm text-slate-900">{text}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="danger" loading={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Keep it
        </Button>
      </div>
    </div>
  );
}

function ChangeForm({
  pkg,
  choices,
  tripId,
  onDone,
}: {
  pkg: TripPackageView;
  choices: PackageChoice[];
  tripId: string;
  onDone: () => void;
}) {
  const change = useChangePackage(tripId);
  const [mode, setMode] = useState<TransportMode>(pkg.transportMode);
  const [tier, setTier] = useState<StayTier>(pkg.stayTier);
  const modes = [...new Set(choices.map((c) => c.transportMode))];
  // Picking a mode limits the tiers to the pairs the engine costed (I3).
  const tiers = choices.filter((c) => c.transportMode === mode).map((c) => c.stayTier);
  const validTier = tiers.includes(tier) ? tier : (tiers[0] ?? tier);

  return (
    <div className="space-y-3 rounded-md border border-slate-300 p-3">
      <Select
        label="Transport mode"
        value={mode}
        onChange={(e) => setMode(e.target.value as TransportMode)}
      >
        {modes.map((m) => (
          <option key={m} value={m}>
            {TRANSPORT_MODE_LABELS[m]}
          </option>
        ))}
      </Select>
      <Select
        label="Stay tier"
        value={validTier}
        onChange={(e) => setTier(e.target.value as StayTier)}
      >
        {tiers.map((t) => (
          <option key={t} value={t}>
            {TIER_LABELS[t]}
          </option>
        ))}
      </Select>
      <p className="text-xs text-slate-600">Saving clears everyone’s opinion on this package.</p>
      {change.error ? (
        <p role="alert" className="text-sm text-danger">
          {errorText(change.error)}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          loading={change.isPending}
          onClick={() =>
            change.mutate(
              { packageId: pkg.id, transportMode: mode, stayTier: validTier },
              { onSuccess: onDone },
            )
          }
        >
          Save changes
        </Button>
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function PackageCard({
  pkg,
  choices,
  tripId,
  isLast,
  actions,
  onRemoved,
}: {
  pkg: TripPackageView;
  choices: PackageChoice[];
  tripId: string;
  isLast: boolean;
  actions: Record<string, TripAction | undefined>;
  onRemoved: (status: string) => void;
}) {
  const opinion = useGiveOpinion(tripId);
  const choose = useChoosePackage(tripId);
  const remove = useRemovePackage(tripId);
  const [confirming, setConfirming] = useState<'choose' | 'remove' | null>(null);
  const [changing, setChanging] = useState(false);
  const reasonId = useId();
  const chosen = pkg.status === 'accepted';

  const giveOpinion = actions.givePackageOpinion;
  const chooseAction = actions.choosePackage;
  const removeAction = actions.removePackage;
  const changeAction = actions.changePackage;

  return (
    <article
      aria-label={`${pkg.label} package`}
      className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold text-slate-900">{pkg.label}</h3>
        {chosen ? <Badge tone="success">Chosen</Badge> : null}
      </div>
      <p className="text-sm text-slate-700">
        {TRANSPORT_MODE_LABELS[pkg.transportMode]} · {TIER_LABELS[pkg.stayTier]} stay · {pkg.rooms}{' '}
        {pkg.rooms === 1 ? 'room' : 'rooms'}
      </p>
      <p className="text-sm text-slate-700">
        {formatDate(pkg.startDate)} – {formatDate(pkg.endDate)}
      </p>
      <div>
        <p className="text-base font-medium text-slate-900">
          {formatInr(pkg.totalInr)} for the group
        </p>
        <p className="text-sm text-slate-700">about {formatInr(pkg.perPersonInr)} each</p>
        <Badge tone="info">estimate</Badge>
      </div>
      {pkg.overBudget ? (
        <p className="flex items-center gap-1 text-sm font-medium text-danger">
          <span aria-hidden="true">⚠</span>
          {pkg.overByInr === null
            ? 'Over the group budget'
            : `${formatInr(pkg.overByInr)} over the group budget`}
        </p>
      ) : null}

      <details className="rounded-md border border-slate-200 p-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-900">
          What it costs
        </summary>
        <ul className="mt-2 space-y-1">
          {pkg.lines.map((line) => (
            <li key={line.category} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-slate-700">{line.label}</span>
              <span className="flex items-center gap-2">
                <span className="text-slate-900">{formatInr(line.amountInr)}</span>
                <Badge tone={line.provenance === 'curated' ? 'success' : 'warning'}>
                  {line.provenance === 'curated' ? 'Curated' : 'Estimate'}
                </Badge>
              </span>
            </li>
          ))}
        </ul>
      </details>

      <p className="text-sm text-slate-700">
        {pkg.opinions.works} of {pkg.opinions.members} say it works
      </p>

      {!chosen && giveOpinion?.enabled ? (
        <div className="space-y-1">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              aria-pressed={pkg.mine === 'accept'}
              data-state={pkg.mine === 'accept' ? 'on' : 'off'}
              className="data-[state=on]:border-2 data-[state=on]:border-brand-700 data-[state=on]:bg-mint/40"
              loading={opinion.isPending && opinion.variables?.decision === 'accept'}
              onClick={() => opinion.mutate({ packageId: pkg.id, decision: 'accept' })}
            >
              {pkg.mine === 'accept' ? (
                <span aria-hidden="true" className="mr-1">
                  ✓
                </span>
              ) : null}
              Works for me
            </Button>
            <Button
              variant="secondary"
              aria-pressed={pkg.mine === 'reject'}
              data-state={pkg.mine === 'reject' ? 'on' : 'off'}
              className="data-[state=on]:border-2 data-[state=on]:border-brand-700 data-[state=on]:bg-mint/40"
              loading={opinion.isPending && opinion.variables?.decision === 'reject'}
              onClick={() => opinion.mutate({ packageId: pkg.id, decision: 'reject' })}
            >
              {pkg.mine === 'reject' ? (
                <span aria-hidden="true" className="mr-1">
                  ✓
                </span>
              ) : null}
              Not for me
            </Button>
          </div>
          {pkg.mine ? (
            <p className="text-xs text-slate-600">
              {pkg.mine === 'accept' ? 'You said it works.' : 'You said it does not work.'}
            </p>
          ) : null}
          {opinion.error ? (
            <p role="alert" className="text-sm text-danger">
              {errorText(opinion.error)}
            </p>
          ) : null}
        </div>
      ) : null}

      {!chosen && (chooseAction || removeAction || changeAction) ? (
        <div className="mt-auto space-y-2 border-t border-slate-100 pt-3">
          {confirming === 'choose' ? (
            <Confirm
              text={`Choose the ${pkg.label} package? Everyone moves on to the day plan.`}
              confirmLabel={`Choose ${pkg.label}`}
              busy={choose.isPending}
              onConfirm={() => choose.mutate(pkg.id, { onSettled: () => setConfirming(null) })}
              onCancel={() => setConfirming(null)}
            />
          ) : confirming === 'remove' ? (
            <Confirm
              text={
                isLast
                  ? 'This is the last package. Removing it sends the trip back to the shortlist.'
                  : `Remove the ${pkg.label} package?`
              }
              confirmLabel={`Remove ${pkg.label}`}
              busy={remove.isPending}
              onConfirm={() =>
                remove.mutate(pkg.id, {
                  onSuccess: (detail) => onRemoved(detail.status),
                  onSettled: () => setConfirming(null),
                })
              }
              onCancel={() => setConfirming(null)}
            />
          ) : changing ? (
            <ChangeForm
              pkg={pkg}
              choices={choices}
              tripId={tripId}
              onDone={() => setChanging(false)}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {chooseAction ? (
                chooseAction.enabled ? (
                  <Button onClick={() => setConfirming('choose')}>Choose this package</Button>
                ) : (
                  <>
                    <Button variant="secondary" disabled aria-describedby={reasonId}>
                      Choose this package
                    </Button>
                    <p id={reasonId} className="w-full text-sm text-slate-600">
                      {chooseAction.reason}
                    </p>
                  </>
                )
              ) : null}
              {changeAction?.enabled ? (
                <Button variant="secondary" onClick={() => setChanging(true)}>
                  Change
                </Button>
              ) : null}
              {removeAction?.enabled ? (
                <Button variant="secondary" onClick={() => setConfirming('remove')}>
                  Remove
                </Button>
              ) : null}
            </div>
          )}
          {choose.error ? (
            <p role="alert" className="text-sm text-danger">
              {errorText(choose.error)}
            </p>
          ) : null}
          {remove.error ? (
            <p role="alert" className="text-sm text-danger">
              {errorText(remove.error)}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
