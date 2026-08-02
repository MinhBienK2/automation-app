import { CheckboxField } from 'automation-app-ui';

const stack: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  maxWidth: 460,
};

const noop = () => {};

export function Default() {
  return (
    <div style={stack}>
      <CheckboxField
        label="Run headless"
        description="Launch Chromium without a visible window on every scheduled run."
        checked
        onCheckedChange={noop}
      />
    </div>
  );
}

export function LabelOnly() {
  return (
    <div style={stack}>
      <CheckboxField label="Stop on first failed step" checked onCheckedChange={noop} />
      <CheckboxField label="Clear cookies before the run" checked={false} onCheckedChange={noop} />
      <CheckboxField label="Persist the browser session" checked={false} onCheckedChange={noop} />
    </div>
  );
}

export function CheckedStates() {
  return (
    <div style={stack}>
      <CheckboxField
        label="Capture a screenshot on failure"
        description="Stored with the run artifacts for 30 days."
        checked
        onCheckedChange={noop}
      />
      <CheckboxField
        label="Capture a screenshot after every step"
        description="Slows long workflows and grows run storage quickly."
        checked={false}
        onCheckedChange={noop}
      />
    </div>
  );
}

export function Disabled() {
  return (
    <div style={stack}>
      <CheckboxField
        label="Batch runs are headless"
        description="Locked by the project run policy."
        checked
        disabled
        onCheckedChange={noop}
      />
      <CheckboxField
        label="Share the session across batch rows"
        description="Unavailable until the batch run UI ships."
        checked={false}
        disabled
        onCheckedChange={noop}
      />
    </div>
  );
}

export function SettingsGroup() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        maxWidth: 460,
        padding: 18,
        borderRadius: 10,
        border: '1px solid var(--border)',
        background: 'var(--surface)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <strong style={{ fontSize: 14 }}>Run artifacts</strong>
        <span style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>
          What each run of this workflow keeps after it finishes.
        </span>
      </div>
      <CheckboxField
        label="Save the network HAR"
        description="Useful when a selector fails only on the scheduled run."
        checked
        onCheckedChange={noop}
      />
      <CheckboxField
        label="Save downloaded files"
        description="Exports land in the project's artifacts folder."
        checked
        onCheckedChange={noop}
      />
      <CheckboxField
        label="Save the full DOM snapshot"
        description="Adds roughly 2 MB per step."
        checked={false}
        onCheckedChange={noop}
      />
    </div>
  );
}
