import { Switch } from 'automation-app-ui';

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
        <Switch id="sw-schedule" checked onCheckedChange={noop} />
        <label htmlFor="sw-schedule" style={{ fontSize: 14 }}>
          Schedule enabled
        </label>
      </div>
    </div>
  );
}

export function States() {
  return (
    <div style={stack}>
      <div style={row}>
        <Switch id="sw-on" checked onCheckedChange={noop} />
        <label htmlFor="sw-on" style={{ fontSize: 14 }}>
          Allow Run JavaScript steps
        </label>
      </div>
      <div style={row}>
        <Switch id="sw-off" checked={false} onCheckedChange={noop} />
        <label htmlFor="sw-off" style={{ fontSize: 14 }}>
          Retry the whole workflow on failure
        </label>
      </div>
      <div style={row}>
        <Switch id="sw-on-disabled" checked disabled onCheckedChange={noop} />
        <label htmlFor="sw-on-disabled" style={{ fontSize: 14, color: 'var(--fg-muted)' }}>
          Batch runs are headless (locked by run policy)
        </label>
      </div>
      <div style={row}>
        <Switch id="sw-off-disabled" checked={false} disabled onCheckedChange={noop} />
        <label htmlFor="sw-off-disabled" style={{ fontSize: 14, color: 'var(--fg-muted)' }}>
          Stop batch on first failed row (unavailable)
        </label>
      </div>
    </div>
  );
}

export function InToolbarRow() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        maxWidth: 460,
        padding: '12px 16px',
        borderRadius: 10,
        border: '1px solid var(--border)',
        background: 'var(--surface)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <strong style={{ fontSize: 14 }}>Nightly inventory sync</strong>
        <span style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>
          Runs at 02:00 Europe/Berlin
        </span>
      </div>
      <Switch id="sw-toolbar" checked onCheckedChange={noop} aria-label="Enable schedule" />
    </div>
  );
}
