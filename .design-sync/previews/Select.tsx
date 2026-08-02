import { FormField, Select } from 'automation-app-ui';

const stack: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  maxWidth: 380,
};

export function Default() {
  return (
    <div style={stack}>
      <Select defaultValue="chromium">
        <option value="chromium">Chromium</option>
        <option value="firefox">Firefox</option>
        <option value="webkit">WebKit</option>
      </Select>
    </div>
  );
}

export function Placeholder() {
  return (
    <div style={stack}>
      <Select placeholder="Select a saved identity…" defaultValue="">
        <option value="ops-eu">ops-eu@internal.example</option>
        <option value="ops-us">ops-us@internal.example</option>
        <option value="qa-sandbox">qa-sandbox@internal.example</option>
      </Select>
    </div>
  );
}

export function InFormField() {
  return (
    <div style={stack}>
      <FormField
        label="Run schedule"
        description="How often the scheduler queues a new run of this workflow."
      >
        <Select defaultValue="hourly">
          <option value="manual">Manual only</option>
          <option value="hourly">Every hour</option>
          <option value="nightly">Nightly at 02:00</option>
          <option value="weekly">Weekly on Monday</option>
        </Select>
      </FormField>
      <FormField label="Target project" error="This project has no browser profile attached.">
        <Select defaultValue="warehouse-portal">
          <option value="warehouse-portal">Warehouse portal</option>
          <option value="supplier-sync">Supplier sync</option>
        </Select>
      </FormField>
    </div>
  );
}

export function DisabledOptions() {
  return (
    <div style={stack}>
      <Select defaultValue="css">
        <option value="css">CSS selector</option>
        <option value="xpath">XPath</option>
        <option value="text">Text content</option>
        <option value="ai" disabled>
          AI locator (not licensed)
        </option>
      </Select>
      <Select disabled defaultValue="headless">
        <option value="headless">Headless — locked by an active run</option>
        <option value="headed">Headed</option>
      </Select>
    </div>
  );
}
