import { SwitchField } from 'automation-app-ui';

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
      <SwitchField
        label="Allow Run JavaScript"
        description="Lets steps evaluate scripts in the page context."
        checked
        onCheckedChange={noop}
      />
    </div>
  );
}

export function LabelOnly() {
  return (
    <div style={stack}>
      <SwitchField label="Snap nodes to the grid" checked onCheckedChange={noop} />
      <SwitchField label="Auto-connect new steps" checked={false} onCheckedChange={noop} />
      <SwitchField label="Highlight unreachable branches" checked onCheckedChange={noop} />
    </div>
  );
}

export function CheckedStates() {
  return (
    <div style={stack}>
      <SwitchField
        label="Close the browser after each run"
        description="Turn off to keep the session open for inspection."
        checked
        onCheckedChange={noop}
      />
      <SwitchField
        label="Reuse the stored identity profile"
        description="Cookies and local storage are restored before step 1."
        checked={false}
        onCheckedChange={noop}
      />
    </div>
  );
}

export function Disabled() {
  return (
    <div style={stack}>
      <SwitchField
        label="Batch runs are headless"
        description="Locked until the batch run UI is ready."
        checked
        disabled
        onCheckedChange={noop}
      />
      <SwitchField
        label="Stop batch on first failed row"
        description="Locked until the batch run UI is ready."
        checked={false}
        disabled
        onCheckedChange={noop}
      />
    </div>
  );
}

export function SettingsSection() {
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
        <strong style={{ fontSize: 14 }}>Run lifecycle</strong>
        <span style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>
          Limits and browser-session behavior for normal workflow runs.
        </span>
      </div>
      <SwitchField
        label="Retain the browser for inspection"
        description="The window stays open after the last step finishes."
        checked
        onCheckedChange={noop}
      />
      <SwitchField
        label="Capture a screenshot on failure"
        description="Attached to the run record in the Runs view."
        checked
        onCheckedChange={noop}
      />
      <SwitchField
        label="Send a webhook when a run fails"
        description="Posts the run id and failing step to the project webhook."
        checked={false}
        onCheckedChange={noop}
      />
    </div>
  );
}
