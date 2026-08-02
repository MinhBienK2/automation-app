import {
  FormField,
  Input,
  NumberInput,
  SegmentedControl,
  Select,
  SettingsFieldGroup,
  Textarea,
} from 'automation-app-ui';

const stack: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  maxWidth: 520,
};

const noop = () => {};

export function Default() {
  return (
    <div style={stack}>
      <SettingsFieldGroup
        title="Workflow details"
        description="Name and describe the workflow so it is easy to find, export, and audit."
      >
        <FormField label="Workflow name" htmlFor="sfg-name">
          <Input id="sfg-name" defaultValue="Nightly inventory sync" />
        </FormField>
        <FormField label="Description" htmlFor="sfg-desc">
          <Textarea
            id="sfg-desc"
            defaultValue="Signs in to the warehouse portal and exports the previous day's stock deltas."
          />
        </FormField>
      </SettingsFieldGroup>
    </div>
  );
}

export function WithFooter() {
  return (
    <div style={stack}>
      <SettingsFieldGroup
        title="Browser launch"
        description="Applies to every run started from this workflow."
        footer="Changing the engine invalidates cached sessions for this project."
      >
        <FormField label="Browser engine" htmlFor="sfg-engine">
          <Select defaultValue="chromium">
            <option value="chromium">Chromium</option>
            <option value="firefox">Firefox</option>
            <option value="webkit">WebKit</option>
          </Select>
        </FormField>
        <FormField label="Window mode">
          <SegmentedControl
            ariaLabel="Window mode"
            value="headless"
            options={[
              { label: 'Headless', value: 'headless' },
              { label: 'Headed', value: 'headed' },
            ]}
            onValueChange={noop}
          />
        </FormField>
      </SettingsFieldGroup>
    </div>
  );
}

export function RunPolicy() {
  return (
    <div style={stack}>
      <SettingsFieldGroup
        title="Run policy"
        description="Limits the scheduler enforces when queueing runs of this workflow."
      >
        <FormField
          label="Step timeout (ms)"
          htmlFor="sfg-timeout"
          description="A step that exceeds this budget fails the run."
        >
          <NumberInput id="sfg-timeout" value={30000} min={1000} step={500} onChange={noop} />
        </FormField>
        <FormField label="Max parallel runs" htmlFor="sfg-parallel" error="Must be between 1 and 8.">
          <NumberInput id="sfg-parallel" value={12} min={1} max={8} onChange={noop} />
        </FormField>
        <FormField
          label="On failure"
          htmlFor="sfg-retry"
          description="Applied once per queued run before the failure is reported."
        >
          <Select defaultValue="retry-once">
            <option value="retry-once">Retry once, then report</option>
            <option value="report">Report immediately</option>
            <option value="pause">Pause the schedule</option>
          </Select>
        </FormField>
      </SettingsFieldGroup>
    </div>
  );
}

export function TitleOnly() {
  return (
    <div style={stack}>
      <SettingsFieldGroup title="Identity">
        <FormField label="Saved identity" htmlFor="sfg-identity">
          <Select defaultValue="ops-eu">
            <option value="ops-eu">ops-eu@internal.example</option>
            <option value="ops-us">ops-us@internal.example</option>
            <option value="qa-sandbox">qa-sandbox@internal.example</option>
          </Select>
        </FormField>
      </SettingsFieldGroup>
    </div>
  );
}
