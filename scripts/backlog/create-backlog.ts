import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

type Row = Record<string, string>;
type RequirementRow = Row & {
  id: string;
  title: string;
  priority: string;
  modules: string;
  srs_ref: string;
  use_case_dfd: string;
  sprint: string;
  academic_owner: string;
  acceptance: string;
};
type WorkItemRow = Row & {
  key: string;
  title: string;
  epics: string;
  module: string;
  academic_owner: string;
  estimate: string;
  milestone: string;
  labels: string;
  acceptance: string;
};
type Issue = { number: number; title: string; id: string };
type Field = { id: string; name: string; type: string; options?: { id: string; name: string }[] };
type ProjectItem = { id: string; content?: { number?: number }; [key: string]: unknown };

const dryRun = process.argv.includes('--dry-run');
const root = fileURLToPath(new URL('../../', import.meta.url));
const sleep = () => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300);
let created = 0;
let updated = 0;
let unchanged = 0;

function gh(args: string[], write = false): string {
  if (write && dryRun) {
    console.log(`[dry-run] gh ${args.join(' ')}`);
    return '';
  }
  const output = execFileSync('gh', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  if (write) sleep();
  return output;
}

function json<T>(args: string[]): T {
  return JSON.parse(gh(args)) as T;
}

function parseCsv<T extends Row>(path: string): T[] {
  const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      record.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      record.push(field);
      if (record.some(Boolean)) records.push(record);
      record = [];
      field = '';
    } else field += char;
  }
  if (field || record.length) {
    record.push(field);
    records.push(record);
  }
  const headers = records.shift();
  if (!headers) return [];
  return records.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])),
  ) as T[];
}

const requirements = parseCsv<RequirementRow>(`${root}/scripts/backlog/requirements.csv`);
const workItems = parseCsv<WorkItemRow>(`${root}/scripts/backlog/issues.csv`);
const repoView = json<{ nameWithOwner: string; owner: { login: string } }>([
  'repo',
  'view',
  '--json',
  'nameWithOwner,owner',
]);
const [owner, repo] = repoView.nameWithOwner.split('/');
if (!owner || !repo) throw new Error('Could not determine repository owner and name');
const ownerType = gh(['api', `repos/${owner}/${repo}`, '-q', '.owner.type']);
const projectOwner = ownerType === 'User' ? '@me' : owner;
const assignee = gh(['api', 'user', '-q', '.login']);

const labelSpecs = [
  ['type:feature', '1f883d', 'New product capability'],
  ['type:bug', 'd1242f', 'Something is not working'],
  ['type:chore', '6f42c1', 'Maintenance and project work'],
  ['type:docs', '0075ca', 'Documentation work'],
  ['type:spike', 'fbca04', 'Time-boxed investigation'],
  ['type:test', '0e8a16', 'Test coverage and verification'],
  ['epic', '5319e7', 'Requirement-level epic'],
  ['deferred', 'c5def5', 'Deferred beyond 10 November'],
  ['catalogue', 'bfd4f2', 'Curated catalogue work'],
] as const;
const existingLabels = json<{ name: string; color: string; description: string | null }[]>([
  'api',
  `repos/${owner}/${repo}/labels`,
  '--paginate',
]);
for (const [name, color, description] of labelSpecs) {
  const existing = existingLabels.find((label) => label.name === name);
  if (!existing) {
    gh(['label', 'create', name, '--color', color, '--description', description], true);
    created += 1;
  } else if (existing.color.toLowerCase() !== color || existing.description !== description) {
    gh(['label', 'edit', name, '--color', color, '--description', description], true);
    updated += 1;
  } else unchanged += 1;
}

const milestoneSpecs = [
  ['Sprint 1 (12-18 Oct)', '2026-10-18T18:29:59Z'],
  ['Sprint 2 (19-25 Oct)', '2026-10-25T18:29:59Z'],
  ['Sprint 3 (26 Oct-1 Nov)', '2026-11-01T18:29:59Z'],
  ['Sprint 4 (2-7 Nov)', '2026-11-07T18:29:59Z'],
  ['Buffer (8-10 Nov)', '2026-11-10T18:29:59Z'],
] as const;
const milestones = json<{ number: number; title: string; due_on: string | null }[]>([
  'api',
  `repos/${owner}/${repo}/milestones?state=all&per_page=100`,
]);
for (const [title, dueOn] of milestoneSpecs) {
  const existing = milestones.find((milestone) => milestone.title === title);
  if (!existing) {
    gh(
      [
        'api',
        '--method',
        'POST',
        `repos/${owner}/${repo}/milestones`,
        '-f',
        `title=${title}`,
        '-f',
        `due_on=${dueOn}`,
      ],
      true,
    );
    created += 1;
  } else if (existing.due_on?.slice(0, 10) !== dueOn.slice(0, 10)) {
    gh(
      [
        'api',
        '--method',
        'PATCH',
        `repos/${owner}/${repo}/milestones/${existing.number}`,
        '-f',
        `due_on=${dueOn}`,
      ],
      true,
    );
    updated += 1;
  } else unchanged += 1;
}

const projects = json<{ projects: { number: number; title: string; url: string; id: string }[] }>([
  'project',
  'list',
  '--owner',
  projectOwner,
  '--format',
  'json',
  '--limit',
  '100',
]);
let project = projects.projects.find((candidate) => candidate.title === 'BonVoyage');
if (!project) {
  if (dryRun) {
    console.log(
      '[dry-run] create project BonVoyage; fields, issues and project items require a real run',
    );
    created += 1;
    console.log(`Summary: ${created} created, ${updated} updated, ${unchanged} unchanged`);
    process.exit(0);
  }
  const made = json<{ number: number; title: string; url: string; id: string }>([
    'project',
    'create',
    '--owner',
    projectOwner,
    '--title',
    'BonVoyage',
    '--format',
    'json',
  ]);
  project = made;
  created += 1;
}
if (!project) throw new Error('Project creation failed');
const projectNumber = String(project.number);
const projectId = project.id;
const projectUrl = project.url;
if (!dryRun) {
  try {
    gh(
      ['project', 'link', projectNumber, '--owner', owner, '--repo', repoView.nameWithOwner],
      true,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('already linked')) throw error;
  }
}

const moduleOptions = [
  'User & Group Management',
  'Preference Management',
  'Geospatial & Filtering',
  'Recommendation Engine',
  'Transport & Cost',
  'Accommodation & Package',
  'AI Itinerary Generator',
  'Trip & Feedback',
  'Notification',
  'External Data Integration',
  'all modules',
];
const fieldSpecs: [string, 'SINGLE_SELECT' | 'NUMBER', string[]?][] = [
  ['Priority', 'SINGLE_SELECT', ['Must', 'Should', 'Could']],
  ['Module', 'SINGLE_SELECT', moduleOptions],
  ['Requirement', 'SINGLE_SELECT', requirements.map((row) => row.id)],
  ['Sprint', 'SINGLE_SELECT', ['S0', 'S1', 'S2', 'S3', 'S4', 'Buffer', 'Deferred']],
  ['Estimate', 'NUMBER'],
  ['Academic owner', 'SINGLE_SELECT', ['Maulik', 'Kushagra', 'Manan', 'Parth']],
];
let fields = json<{ fields: Field[] }>([
  'project',
  'field-list',
  projectNumber,
  '--owner',
  projectOwner,
  '--format',
  'json',
]).fields;
for (const [name, dataType, options] of fieldSpecs) {
  if (!fields.some((field) => field.name === name)) {
    const args = [
      'project',
      'field-create',
      projectNumber,
      '--owner',
      projectOwner,
      '--name',
      name,
      '--data-type',
      dataType,
    ];
    if (options) args.push('--single-select-options', options.join(','));
    gh(args, true);
    created += 1;
  } else unchanged += 1;
}
fields = json<{ fields: Field[] }>([
  'project',
  'field-list',
  projectNumber,
  '--owner',
  projectOwner,
  '--format',
  'json',
]).fields;

const listedIssues = json<Issue[]>([
  'issue',
  'list',
  '--state',
  'all',
  '--limit',
  '500',
  '--json',
  'number,title,id',
]);
const epicNumbers = new Map<string, number>();
const childNumbers = new Map<string, number>();
function checklist(value: string): string {
  return value
    .split(';')
    .map((criterion) => `- [ ] ${criterion}`)
    .join('\n');
}
function milestoneTitle(sprint: string): string | undefined {
  return milestoneSpecs.find(([title]) =>
    title.startsWith(sprint === 'Buffer' ? 'Buffer' : `Sprint ${sprint.slice(1)}`),
  )?.[0];
}
function createIssue(title: string, body: string, labels: string[], milestone?: string): number {
  const args = ['issue', 'create', '--title', title, '--body', body, '--assignee', assignee];
  for (const label of labels) args.push('--label', label);
  if (milestone) args.push('--milestone', milestone);
  const output = gh(args, true);
  const number = Number(output.match(/\/(\d+)$/)?.[1]);
  if (!number) throw new Error(`Could not read issue number from ${output}`);
  created += 1;
  listedIssues.push({ number, title, id: '' });
  return number;
}
for (const row of requirements) {
  const existing = listedIssues.find((issue) => issue.title.startsWith(`[${row.id}] `));
  const body = `**Requirement:** ${row.title}\n\n**Priority:** ${row.priority}\n**Modules:** ${row.modules}\n**SRS reference:** ${row.srs_ref}\n**Use case / DFD:** ${row.use_case_dfd}\n**Sprint:** ${row.sprint}\n\n## Acceptance criteria\n${checklist(row.acceptance)}\n\nTraceability: docs/traceability.md`;
  const labels = ['type:feature', 'epic', ...(row.sprint === 'Deferred' ? ['deferred'] : [])];
  const number =
    existing?.number ?? createIssue(row.title, body, labels, milestoneTitle(row.sprint));
  if (existing) unchanged += 1;
  epicNumbers.set(row.id, number);
}
for (const row of workItems) {
  const existing = listedIssues.find((issue) => issue.title === row.title);
  const body = `**Goal:** ${row.title}\n\n## Acceptance criteria\n${checklist(row.acceptance)}\n\n**Epics:** ${row.epics
    .split(',')
    .map((id) => `#${epicNumbers.get(id)}`)
    .join(
      ', ',
    )}\n**Module:** ${row.module}\n**Academic owner:** ${row.academic_owner}\n**Estimate:** ${row.estimate}\n\nDefinition of Done: AGENTS.md section 13`;
  const number =
    existing?.number ??
    createIssue(
      row.title,
      body,
      row.labels.split(','),
      milestoneTitle(row.milestone.replace('Sprint ', 'S')),
    );
  if (existing) unchanged += 1;
  childNumbers.set(row.key, number);
  const parent = epicNumbers.get(row.epics.split(',')[0] ?? '');
  if (!parent) throw new Error(`Missing parent epic for ${row.key}`);
  const children = json<{ number: number }[]>([
    'api',
    `repos/${owner}/${repo}/issues/${parent}/sub_issues?per_page=100`,
  ]);
  if (!children.some((child) => child.number === number)) {
    const restId = gh(['api', `repos/${owner}/${repo}/issues/${number}`, '-q', '.id']);
    gh(
      [
        'api',
        '--method',
        'POST',
        `repos/${owner}/${repo}/issues/${parent}/sub_issues`,
        '-F',
        `sub_issue_id=${restId}`,
      ],
      true,
    );
    updated += 1;
  } else unchanged += 1;
}

const projectItems = json<{ items: ProjectItem[] }>([
  'project',
  'item-list',
  projectNumber,
  '--owner',
  projectOwner,
  '--format',
  'json',
  '--limit',
  '200',
]).items;
function field(name: string): Field {
  const found = fields.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`Missing project field ${name}`);
  return found;
}
function setField(item: ProjectItem, name: string, value: string): void {
  const current = item[name.toLowerCase()];
  if ((typeof current === 'string' || typeof current === 'number') && String(current) === value) {
    unchanged += 1;
    return;
  }
  const target = field(name);
  const args = [
    'project',
    'item-edit',
    '--id',
    item.id,
    '--project-id',
    projectId,
    '--field-id',
    target.id,
  ];
  if (target.type === 'ProjectV2Field') args.push('--number', value);
  else {
    const option = target.options?.find((candidate) => candidate.name === value);
    if (!option) throw new Error(`Missing option ${value} in ${name}`);
    args.push('--single-select-option-id', option.id);
  }
  gh(args, true);
  updated += 1;
}
function addAndSet(number: number, values: Record<string, string>): void {
  let item = projectItems.find((candidate) => candidate.content?.number === number);
  if (!item) {
    const added = json<{ id: string }>([
      'project',
      'item-add',
      projectNumber,
      '--owner',
      projectOwner,
      '--url',
      `https://github.com/${owner}/${repo}/issues/${number}`,
      '--format',
      'json',
    ]);
    item = { id: added.id, content: { number } };
    projectItems.push(item);
    created += 1;
  } else unchanged += 1;
  for (const [name, value] of Object.entries(values)) setField(item, name, value);
}
for (const row of requirements) {
  const number = epicNumbers.get(row.id);
  if (!number) continue;
  addAndSet(number, {
    Priority: row.priority,
    Module: row.modules.split(';')[0] ?? row.modules,
    Requirement: row.id,
    Sprint: row.sprint,
    'Academic owner': row.academic_owner,
  });
}
for (const row of workItems) {
  const number = childNumbers.get(row.key);
  const requirement = row.epics.split(',')[0];
  if (!number || !requirement) continue;
  const priority = requirements.find((candidate) => candidate.id === requirement)?.priority;
  if (!priority) throw new Error(`Missing priority for ${requirement}`);
  addAndSet(number, {
    Priority: priority,
    Module: row.module,
    Requirement: requirement,
    Sprint: row.milestone.replace('Sprint ', 'S'),
    Estimate: row.estimate,
    'Academic owner': row.academic_owner,
  });
}
console.log(`Project: ${projectUrl}`);
console.log(`Epics: ${[...epicNumbers].map(([id, number]) => `${id}=#${number}`).join(', ')}`);
console.log(`Issues: ${[...childNumbers].map(([key, number]) => `${key}=#${number}`).join(', ')}`);
console.log(`Summary: ${created} created, ${updated} updated, ${unchanged} unchanged`);
