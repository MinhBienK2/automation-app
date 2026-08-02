import { Badge, Button, DataTable, EmptyState, StatusBadge } from 'automation-app-ui';
import { Play, Workflow } from 'lucide-react';

type Run = {
  id: string;
  workflow: string;
  status: 'running' | 'success' | 'failed' | 'stopped';
  identity: string;
  duration: string;
  started: string;
};

const runs: Run[] = [
  {
    id: 'run_8c21a4',
    workflow: 'Nightly inventory sync',
    status: 'success',
    identity: 'ops-bot-01',
    duration: '4m 12s',
    started: 'Today, 02:00',
  },
  {
    id: 'run_7f9b30',
    workflow: 'Supplier portal export',
    status: 'running',
    identity: 'ops-bot-02',
    duration: '1m 38s',
    started: 'Today, 09:14',
  },
  {
    id: 'run_6a1d55',
    workflow: 'Invoice reconciliation',
    status: 'failed',
    identity: 'finance-bot',
    duration: '0m 47s',
    started: 'Yesterday, 23:31',
  },
  {
    id: 'run_5e0c12',
    workflow: 'Weekly price audit',
    status: 'stopped',
    identity: 'ops-bot-01',
    duration: '12m 05s',
    started: 'Mon, 06:00',
  },
];

const columns = [
  {
    header: 'Run',
    accessor: (r: Run) => (
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.id}</span>
    ),
  },
  { header: 'Workflow', accessor: (r: Run) => r.workflow },
  { header: 'Status', accessor: (r: Run) => <StatusBadge status={r.status} /> },
  {
    header: 'Identity',
    accessor: (r: Run) => <Badge variant="secondary">{r.identity}</Badge>,
    hideOnMobile: true,
  },
  { header: 'Duration', accessor: (r: Run) => r.duration },
  { header: 'Started', accessor: (r: Run) => r.started, hideOnMobile: true },
];

export function RunHistory() {
  return (
    <DataTable
      data={runs}
      columns={columns}
      keyExtractor={(r) => r.id}
      caption="Recent workflow runs"
    />
  );
}

export function Clickable() {
  return (
    <DataTable
      data={runs.slice(0, 3)}
      columns={columns.slice(0, 4)}
      keyExtractor={(r) => r.id}
      onRowClick={() => undefined}
      rowClassName={(r) => (r.status === 'failed' ? 'bg-[var(--failure-bg)]' : '')}
    />
  );
}

export function Empty() {
  return (
    <DataTable
      data={[]}
      columns={columns}
      keyExtractor={(r) => r.id}
      emptyState={
        <EmptyState
          icon={Workflow}
          title="No runs recorded"
          description="This workflow has never been executed. Start a run to populate its history."
          action={
            <Button>
              <Play size={14} /> Run now
            </Button>
          }
        />
      }
    />
  );
}
