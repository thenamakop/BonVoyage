import { useId, useState } from 'react';
import {
  CATALOGUE_TABLE_NAMES,
  CatalogueInvalidDetails,
  type CatalogueFiles,
  type CatalogueImportResponse,
  type CatalogueIssue,
  type StageProgress,
} from '@bonvoyage/shared';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { useCatalogueImport, useCatalogueStatus } from '../../features/admin/api';
import { ApiError } from '../../lib/api';
import { formatDate, formatDateTime } from '../../lib/format';
import { useDocumentTitle } from '../../lib/use-document-title';

// S1-7: check and import the five catalogue files. The import writes exactly
// what the files say; it never deletes a row and never marks one verified.

const FILES: { key: keyof CatalogueFiles; name: string; accept: string }[] = [
  { key: 'hubs', name: 'hubs.csv', accept: '.csv,text/csv' },
  { key: 'destinations', name: 'destinations.csv', accept: '.csv,text/csv' },
  { key: 'fares', name: 'fares.csv', accept: '.csv,text/csv' },
  { key: 'pois', name: 'pois.csv', accept: '.csv,text/csv' },
  { key: 'costRules', name: 'cost-rules.json', accept: '.json,application/json' },
];

const STAGE_NAMES: Record<StageProgress['stage'], string> = {
  a: 'A',
  b1: 'B1',
  b2: 'B2',
  c: 'C',
};
const SEVERITY_WORD = { error: 'Error', warning: 'Warning', info: 'Info' } as const;
const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 } as const;
const TABLE_LABELS: Record<(typeof CATALOGUE_TABLE_NAMES)[number], string> = {
  hub: 'Hubs',
  destination: 'Destinations',
  poi: 'Points of interest',
  fare_fallback: 'Fares',
  cost_rule: 'Cost rules',
};

function stageLine(s: StageProgress): string {
  return `Stage ${STAGE_NAMES[s.stage]}: ${s.verified} of ${s.total} verified, due ${formatDate(s.dueDate)}`;
}

function StatusCard() {
  const status = useCatalogueStatus();
  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-900">In this database</h2>
      {status.isLoading ? (
        <div aria-label="Loading catalogue status">
          <Skeleton className="h-24" />
        </div>
      ) : status.isError || !status.data ? (
        <Alert
          tone="error"
          action={
            <Button variant="ghost" onClick={() => void status.refetch()}>
              Retry
            </Button>
          }
        >
          The catalogue status could not be loaded.
        </Alert>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
            {CATALOGUE_TABLE_NAMES.map((t) => (
              <div key={t}>
                <dt className="text-slate-600">{TABLE_LABELS[t]}</dt>
                <dd className="font-medium text-slate-900">{status.data.tables[t]}</dd>
              </div>
            ))}
          </dl>
          <ul className="space-y-1 text-sm text-slate-900">
            {status.data.stages.map((s) => (
              <li key={s.stage}>{stageLine(s)}</li>
            ))}
          </ul>
          <p className="text-sm text-slate-600">
            {status.data.lastUpdatedAt
              ? `Last updated ${formatDateTime(status.data.lastUpdatedAt)}`
              : 'Nothing imported yet.'}
          </p>
        </>
      )}
    </Card>
  );
}

function IssueList({ issues }: { issues: CatalogueIssue[] }) {
  if (issues.length === 0) return <p className="text-sm text-slate-700">No issues.</p>;
  const byFile = new Map<string, CatalogueIssue[]>();
  for (const i of [...issues].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  )) {
    byFile.set(i.file, [...(byFile.get(i.file) ?? []), i]);
  }
  return (
    <div className="space-y-3">
      {[...byFile].map(([file, list]) => (
        <section key={file}>
          <h4 className="text-sm font-semibold text-slate-900">{file}</h4>
          <ul className="mt-1 space-y-1 text-sm">
            {list.map((i, n) => (
              <li key={n} className={i.severity === 'error' ? 'text-danger' : 'text-slate-800'}>
                <span className="font-semibold">{SEVERITY_WORD[i.severity]}</span>
                {i.line !== null ? ` · line ${i.line}` : ''}
                {i.column ? ` · ${i.column}` : ''}: {i.message}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Results({ result }: { result: CatalogueImportResponse }) {
  return (
    <div className="space-y-4">
      <Alert tone="success">
        {result.dryRun
          ? 'Check passed. Nothing was written; an import would make these changes.'
          : 'Imported.'}
      </Alert>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Rows inserted and updated per table</caption>
          <thead>
            <tr className="text-slate-600">
              <th scope="col" className="py-1 pr-4 font-medium">
                Table
              </th>
              <th scope="col" className="py-1 pr-4 font-medium">
                Inserted
              </th>
              <th scope="col" className="py-1 font-medium">
                Updated
              </th>
            </tr>
          </thead>
          <tbody>
            {CATALOGUE_TABLE_NAMES.map((t) => (
              <tr key={t} className="border-t border-slate-200">
                <th scope="row" className="py-1 pr-4 font-normal">
                  {TABLE_LABELS[t]}
                </th>
                <td className="py-1 pr-4">{result.counts[t].inserted}</td>
                <td className="py-1">{result.counts[t].updated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-1 text-sm text-slate-900">
        {result.stages.map((s) => (
          <li key={s.stage}>{stageLine(s)}</li>
        ))}
      </ul>
      {result.notInFiles.length > 0 ? (
        <Alert tone="warning">
          In the database but not in these files (kept, never deleted):{' '}
          {result.notInFiles.join(', ')}.
        </Alert>
      ) : null}
      <h3 className="text-sm font-semibold text-slate-900">Issues</h3>
      <IssueList issues={result.issues} />
    </div>
  );
}

export function CataloguePage() {
  useDocumentTitle('Catalogue');
  const importer = useCatalogueImport();
  const baseId = useId();
  const [files, setFiles] = useState<Partial<Record<keyof CatalogueFiles, File>>>({});
  // The exact File objects of the last clean check; any change resets it.
  const [cleanFor, setCleanFor] = useState<Partial<Record<keyof CatalogueFiles, File>> | null>(
    null,
  );
  const [result, setResult] = useState<CatalogueImportResponse | null>(null);
  const [failure, setFailure] = useState<{ message: string; issues: CatalogueIssue[] } | null>(
    null,
  );
  const [confirming, setConfirming] = useState(false);

  const allChosen = FILES.every((f) => files[f.key]);
  const cleanCheckOfThese =
    cleanFor !== null && FILES.every((f) => cleanFor[f.key] === files[f.key]);

  function choose(key: keyof CatalogueFiles, file: File | undefined) {
    setFiles((prev) => {
      const next = { ...prev };
      if (file) next[key] = file;
      else delete next[key];
      return next;
    });
    setCleanFor(null);
    setConfirming(false);
  }

  async function run(dryRun: boolean) {
    setFailure(null);
    setConfirming(false);
    const chosen = { ...files };
    const texts = await Promise.all(FILES.map((f) => chosen[f.key]!.text()));
    const payload = Object.fromEntries(FILES.map((f, i) => [f.key, texts[i]!])) as CatalogueFiles;
    importer.mutate(
      { files: payload, dryRun },
      {
        onSuccess: (res) => {
          setResult(res);
          setCleanFor(dryRun ? chosen : null);
        },
        onError: (err) => {
          setResult(null);
          setCleanFor(null);
          const details =
            err instanceof ApiError ? CatalogueInvalidDetails.safeParse(err.details) : null;
          setFailure({
            message: err instanceof ApiError ? err.message : 'Something went wrong. Try again.',
            issues: details?.success ? details.data.issues : [],
          });
        },
      },
    );
  }

  return (
    <>
      <PageHeader title="Catalogue" />
      <p className="mb-4 text-sm text-slate-700">
        Check the five catalogue files, then import them into this database. An import adds and
        updates rows exactly as the files say. It never deletes a row and never marks one verified.
      </p>
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <StatusCard />
        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Import files</h2>
          {FILES.map((f) => (
            <div key={f.key}>
              <label
                htmlFor={`${baseId}-${f.key}`}
                className="mb-1 block text-sm font-medium text-slate-900"
              >
                {f.name}
              </label>
              <input
                id={`${baseId}-${f.key}`}
                type="file"
                accept={f.accept}
                onChange={(e) => choose(f.key, e.target.files?.[0])}
                className="block min-h-11 w-full text-sm text-slate-900 file:mr-3 file:min-h-11 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-4 file:text-sm file:font-semibold"
              />
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={!allChosen}
              loading={importer.isPending && !confirming}
              onClick={() => void run(true)}
            >
              Check files
            </Button>
            <Button
              disabled={!cleanCheckOfThese || importer.isPending}
              onClick={() => setConfirming(true)}
            >
              Import
            </Button>
          </div>
          {!cleanCheckOfThese ? (
            <p className="text-sm text-slate-600">
              Import becomes available after a check of these five files finds no errors.
            </p>
          ) : null}
          {confirming ? (
            <div className="space-y-2 rounded-md border border-slate-300 p-3">
              <p className="text-sm text-slate-900">
                Import into this database? This page is on{' '}
                <span className="font-semibold">{window.location.host}</span>.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button loading={importer.isPending} onClick={() => void run(false)}>
                  Import now
                </Button>
                <Button variant="secondary" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      {failure || result ? (
        <Card className="mt-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Results</h2>
          {failure ? (
            <>
              <Alert tone="error">{failure.message}</Alert>
              <IssueList issues={failure.issues} />
            </>
          ) : result ? (
            <Results result={result} />
          ) : null}
        </Card>
      ) : null}
    </>
  );
}
