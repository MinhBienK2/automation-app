import { FormField, Input, NumberInput, Select, Textarea } from 'automation-app-ui';

const stack: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  maxWidth: 420,
};

const noop = () => {};

export function Default() {
  return (
    <div style={stack}>
      <FormField label="Workflow name" htmlFor="ff-name">
        <Input id="ff-name" defaultValue="Nightly inventory sync" />
      </FormField>
    </div>
  );
}

export function WithDescription() {
  return (
    <div style={stack}>
      <FormField
        label="Start URL"
        htmlFor="ff-start-url"
        description="Every run opens this page before the first browser step executes."
      >
        <Input id="ff-start-url" defaultValue="https://portal.internal.example/orders" />
      </FormField>
    </div>
  );
}

export function WithError() {
  return (
    <div style={stack}>
      <FormField
        label="Max parallel runs"
        htmlFor="ff-parallel"
        description="Runs above this limit stay queued."
        error="Must be between 1 and 8."
      >
        <NumberInput id="ff-parallel" value={12} min={1} max={8} onChange={noop} />
      </FormField>
    </div>
  );
}

export function ControlTypes() {
  return (
    <div style={stack}>
      <FormField label="Browser engine" htmlFor="ff-engine">
        <Select defaultValue="chromium">
          <option value="chromium">Chromium</option>
          <option value="firefox">Firefox</option>
          <option value="webkit">WebKit</option>
        </Select>
      </FormField>
      <FormField
        label="Run notes"
        htmlFor="ff-notes"
        description="Shown in the run history next to each execution."
      >
        <Textarea id="ff-notes" defaultValue="Skip the supplier catalogue page until the vendor migration lands." />
      </FormField>
    </div>
  );
}

export function Empty() {
  return (
    <div style={stack}>
      <FormField
        label="CSS selector"
        htmlFor="ff-selector"
        description="Leave blank to reuse the selector captured during recording."
      >
        <Input id="ff-selector" placeholder="[data-testid='order-row'] button.confirm" />
      </FormField>
    </div>
  );
}
