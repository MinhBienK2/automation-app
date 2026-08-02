import { StatusBadge } from 'automation-app-ui';

export function Statuses() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <StatusBadge status="idle" />
      <StatusBadge status="running" />
      <StatusBadge status="success" />
      <StatusBadge status="attention" />
      <StatusBadge status="failed" />
      <StatusBadge status="stopped" />
    </div>
  );
}

export function CustomText() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <StatusBadge status="running" customText="Step 6 of 14" />
      <StatusBadge status="success" customText="Enabled" />
      <StatusBadge status="attention" customText="Selector drifted" />
      <StatusBadge status="failed" customText="Login timed out" />
    </div>
  );
}

export function InRunList() {
  const runs = [
    { id: 'run_8c21a4', workflow: 'Nightly inventory sync', status: 'success' as const },
    { id: 'run_7f9b30', workflow: 'Supplier portal export', status: 'running' as const },
    { id: 'run_6a1d55', workflow: 'Invoice reconciliation', status: 'failed' as const },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360 }}>
      {runs.map((run) => (
        <div
          key={run.id}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-secondary)' }}>
              {run.id}
            </span>
            <span style={{ fontSize: 13 }}>{run.workflow}</span>
          </span>
          <StatusBadge status={run.status} />
        </div>
      ))}
    </div>
  );
}
