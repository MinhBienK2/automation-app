import { Checkbox } from 'automation-app-ui';

const stack: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  maxWidth: 420,
};

const row: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};

const noop = () => {};

export function Default() {
  return (
    <div style={stack}>
      <div style={row}>
        <Checkbox id="cb-headless" checked onCheckedChange={noop} />
        <label htmlFor="cb-headless" style={{ fontSize: 14 }}>
          Run headless
        </label>
      </div>
    </div>
  );
}

export function States() {
  return (
    <div style={stack}>
      <div style={row}>
        <Checkbox id="cb-unchecked" checked={false} onCheckedChange={noop} />
        <label htmlFor="cb-unchecked" style={{ fontSize: 14 }}>
          Capture a screenshot after every step
        </label>
      </div>
      <div style={row}>
        <Checkbox id="cb-checked" checked onCheckedChange={noop} />
        <label htmlFor="cb-checked" style={{ fontSize: 14 }}>
          Stop the run on the first failed step
        </label>
      </div>
      <div style={row}>
        <Checkbox id="cb-disabled" checked={false} disabled onCheckedChange={noop} />
        <label htmlFor="cb-disabled" style={{ fontSize: 14, color: 'var(--fg-muted)' }}>
          Reuse the previous browser session (unavailable)
        </label>
      </div>
      <div style={row}>
        <Checkbox id="cb-disabled-checked" checked disabled onCheckedChange={noop} />
        <label
          htmlFor="cb-disabled-checked"
          style={{ fontSize: 14, color: 'var(--fg-muted)' }}
        >
          Record a trace (forced on by run policy)
        </label>
      </div>
    </div>
  );
}

export function SelectionList() {
  const steps = [
    { id: 'step-open', label: 'Open supplier portal', selected: true },
    { id: 'step-login', label: 'Sign in with "eu-readonly"', selected: true },
    { id: 'step-filter', label: 'Filter orders by backordered', selected: false },
    { id: 'step-export', label: 'Export the visible page as CSV', selected: false },
  ];
  return (
    <div style={{ ...stack, gap: 12 }}>
      <span style={{ fontSize: 12, letterSpacing: '0.06em', color: 'var(--fg-secondary)' }}>
        STEPS TO RE-RUN
      </span>
      {steps.map((step) => (
        <div key={step.id} style={row}>
          <Checkbox id={step.id} checked={step.selected} onCheckedChange={noop} />
          <label htmlFor={step.id} style={{ fontSize: 14 }}>
            {step.label}
          </label>
        </div>
      ))}
    </div>
  );
}

export function InlineInTableRow() {
  const runs = [
    { id: 'run_9f13', workflow: 'Nightly inventory sync', started: '02:00:04' },
    { id: 'run_9f14', workflow: 'Vendor price check', started: '02:14:51' },
    { id: 'run_9f15', workflow: 'Invoice download', started: '03:00:00' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxWidth: 460 }}>
      {runs.map((run, index) => (
        <div
          key={run.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 12px',
            borderTop: index === 0 ? '1px solid var(--border)' : undefined,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Checkbox
            id={`row-${run.id}`}
            checked={index === 0}
            onCheckedChange={noop}
            aria-label={`Select ${run.workflow}`}
          />
          <span style={{ fontSize: 14, flex: 1 }}>{run.workflow}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)' }}>
            {run.started}
          </span>
        </div>
      ))}
    </div>
  );
}
