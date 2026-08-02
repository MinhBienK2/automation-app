import { ScrollArea, StatusBadge } from 'automation-app-ui';

const logLines = [
  '[02:00:01] session started — identity ops-bot-01, viewport 1440x900',
  '[02:00:02] step 1 navigate https://portal.supplier.internal/login',
  '[02:00:04] step 2 type #username → ops-bot-01',
  '[02:00:04] step 3 type #password → ********',
  '[02:00:05] step 4 click button[type="submit"]',
  '[02:00:08] step 5 waitForSelector .dashboard-header (3.1s)',
  '[02:00:09] step 6 click a[href="/reports/stock"]',
  '[02:00:12] step 7 waitForSelector table.report-grid (2.4s)',
  '[02:00:13] step 8 click button[data-test="export"]',
  '[02:00:19] step 9 waitForDownload stock-report.csv (5.8s)',
  '[02:00:20] step 10 upload stock-report.csv → warehouse drive',
  '[02:00:24] step 11 assert row count >= 1200 → 1284 ok',
  '[02:00:25] step 12 click button[data-test="logout"]',
  '[02:00:27] session closed — 4m 12s, 0 retries',
];

export function RunLog() {
  return (
    <ScrollArea style={{ height: 180, maxWidth: 460, border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
      <div style={{ display: 'grid', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>
        {logLines.map((line) => (
          <div key={line} style={{ whiteSpace: 'nowrap', color: 'var(--fg-secondary)' }}>
            {line}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

export function StepPicker() {
  const steps = [
    'Navigate to URL',
    'Click element',
    'Type text',
    'Wait for selector',
    'Wait for navigation',
    'Extract text',
    'Extract attribute',
    'Select dropdown option',
    'Upload file',
    'Download file',
    'Run subflow',
    'Set variable',
  ];
  return (
    <ScrollArea style={{ height: 160, maxWidth: 300, border: '1px solid var(--border)', borderRadius: 8 }}>
      <div style={{ display: 'grid' }}>
        {steps.map((step) => (
          <div
            key={step}
            style={{
              padding: '8px 12px',
              fontSize: 13,
              borderBottom: '1px solid var(--border)',
            }}
          >
            {step}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

export function ActiveRuns() {
  const runs = Array.from({ length: 9 }, (_, index) => ({
    id: `run_${(0x8c21a4 + index * 7919).toString(16)}`,
    workflow: [
      'Nightly inventory sync',
      'Supplier portal export',
      'Invoice reconciliation',
      'Weekly price audit',
    ][index % 4],
    status: (['running', 'success', 'failed', 'stopped'] as const)[index % 4],
  }));
  return (
    <ScrollArea style={{ height: 170, maxWidth: 380, border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
      <div style={{ display: 'grid', gap: 8 }}>
        {runs.map((run) => (
          <div
            key={run.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '4px 4px',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--fg-secondary)' }}>
                {run.id}
              </span>
              <span style={{ fontSize: 13 }}>{run.workflow}</span>
            </span>
            <StatusBadge status={run.status} />
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
