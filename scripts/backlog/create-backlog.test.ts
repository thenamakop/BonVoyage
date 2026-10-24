import { afterEach, expect, it, vi } from 'vitest';

const { run, read } = vi.hoisted(() => ({ run: vi.fn(), read: vi.fn() }));
vi.mock('node:child_process', () => ({ execFileSync: run }));
vi.mock('node:fs', () => ({ readFileSync: read }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

it.each([true, false])(
  'dry run never writes with existing project items = %s',
  async (hasItems) => {
    vi.stubGlobal('process', { ...process, argv: [...process.argv, '--dry-run'] });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    read.mockImplementation((path: string) =>
      path.endsWith('requirements.csv')
        ? 'id,title,priority,modules,srs_ref,use_case_dfd,sprint,academic_owner,acceptance\nR4,[R4] Profile,Must,Preference Management,Table 6,3.0,S2,Maulik,Computed on read\n'
        : 'key,title,epics,module,academic_owner,estimate,milestone,labels,acceptance\nEXISTING,Existing work,R4,Preference Management,Maulik,3,Sprint 2,type:feature,Already exists\nNEW,New work,R4,Preference Management,Maulik,3,Sprint 2,type:feature,Not created during dry run\n',
    );
    const fields = [
      ['Priority', 'Must'],
      ['Module', 'Preference Management'],
      ['Requirement', 'R4'],
      ['Sprint', 'S2'],
      ['Estimate', '3'],
      ['Academic owner', 'Maulik'],
    ].map(([name, value]) => ({
      id: name,
      name,
      type: name === 'Estimate' ? 'ProjectV2Field' : 'ProjectV2SingleSelectField',
      options: [{ id: value, name: value }],
    }));
    run.mockImplementation((command: string, args: string[]) => {
      expect(command).toBe('gh');
      const key = args.slice(0, 2).join(' ');
      if (key === 'repo view')
        return JSON.stringify({ nameWithOwner: 'owner/repo', owner: { login: 'owner' } });
      if (args[0] === 'api') {
        const route = args[1] ?? '';
        if (route === 'repos/owner/repo') return 'User';
        if (route === 'user') return 'owner';
        if (route.endsWith('/labels') || route.includes('/milestones?')) return '[]';
        if (route.endsWith('/sub_issues?per_page=100')) return '[{"number":2}]';
      }
      if (key === 'project list')
        return JSON.stringify({
          projects: [{ number: 1, title: 'BonVoyage', id: 'project', url: 'project' }],
        });
      if (key === 'project field-list') return JSON.stringify({ fields });
      if (key === 'issue list')
        return JSON.stringify([
          { number: 1, title: '[R4] Profile', id: 'epic' },
          { number: 2, title: 'Existing work', id: 'child' },
        ]);
      if (key === 'project item-list')
        return JSON.stringify({
          items: hasItems
            ? [1, 2].map((number) => ({
                id: String(number),
                content: { number },
                priority: 'Must',
                module: 'Preference Management',
                requirement: 'R4',
                sprint: 'S2',
                estimate: 3,
                'academic owner': 'Maulik',
              }))
            : [],
        });
      throw new Error(`Unexpected command: ${args.join(' ')}`);
    });

    await import('./create-backlog');

    const output = log.mock.calls.map((args) => args.join(' ')).join('\n');
    expect(output).toContain('[dry-run] gh issue create --title New work');
    expect(output).toContain('NEW=#0');
    expect(output.includes('[dry-run] gh project item-add')).toBe(!hasItems);
    expect(output).not.toContain('/issues/0');
    expect(output).not.toContain('gh project item-edit');
    expect(run.mock.calls.every(([, args]) => !(args as string[]).includes('item-add'))).toBe(true);
    expect(run.mock.calls.every(([, args]) => !(args as string[]).includes('create'))).toBe(true);
  },
);
