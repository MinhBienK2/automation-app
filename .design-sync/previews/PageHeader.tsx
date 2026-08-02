import { Button, PageHeader, StatusBadge } from 'automation-app-ui';
import { Play, Plus, Save } from 'lucide-react';

export function WorkflowDetailHeader() {
  return (
    <div style={{ maxWidth: 720 }}>
      <PageHeader
        eyebrow="Workflow Detail"
        title="Nightly inventory sync"
        meta={['Saved 2 minutes ago', 'Project: Warehouse Ops', '14 steps']}
        status={<StatusBadge status="success" />}
        backLabel="Back to Workflows"
        onBack={() => undefined}
        actions={
          <>
            <Button variant="secondary" size="sm">
              <Save size={14} /> Save
            </Button>
            <Button size="sm">
              <Play size={14} /> Run
            </Button>
          </>
        }
      />
    </div>
  );
}

export function ListPageHeader() {
  return (
    <div style={{ maxWidth: 720 }}>
      <PageHeader
        title="Workflows"
        meta={['28 workflows', '4 scheduled']}
        actions={
          <Button size="sm">
            <Plus size={14} /> New workflow
          </Button>
        }
      />
    </div>
  );
}

export function TitleOnly() {
  return (
    <div style={{ maxWidth: 720 }}>
      <PageHeader title="Identities" />
    </div>
  );
}

export function RunningWithStatus() {
  return (
    <div style={{ maxWidth: 720 }}>
      <PageHeader
        eyebrow="Run 2841"
        title="Supplier portal export"
        meta={['Started 00:41 ago', 'Identity: ops-bot-01', 'Step 6 of 14']}
        status={<StatusBadge status="running" />}
        actions={
          <Button variant="destructive" size="sm">
            Stop run
          </Button>
        }
      />
    </div>
  );
}
