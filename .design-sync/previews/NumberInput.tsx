import { FormField, NumberInput } from 'automation-app-ui';

const stack: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  maxWidth: 320,
};

const noop = () => {};

export function Default() {
  return (
    <div style={stack}>
      <NumberInput value={4} min={1} max={16} onChange={noop} />
    </div>
  );
}

export function InFormField() {
  return (
    <div style={stack}>
      <FormField
        label="Step timeout (ms)"
        description="How long a single browser step may run before the run is marked failed."
      >
        <NumberInput value={30000} min={1000} step={500} fallback={30000} onChange={noop} />
      </FormField>
      <FormField label="Max parallel runs" error="Must be between 1 and 8.">
        <NumberInput value={12} min={1} max={8} fallback={1} onChange={noop} />
      </FormField>
    </div>
  );
}

export function Decimals() {
  return (
    <div style={stack}>
      <FormField label="Scroll speed multiplier" description="Decimals allowed.">
        <NumberInput value={1.5} step={0.1} allowDecimals min={0} onChange={noop} />
      </FormField>
      <FormField label="Scroll offset (px)" description="Negative values scroll upwards.">
        <NumberInput value={-250} allowNegative onChange={noop} />
      </FormField>
    </div>
  );
}

export function EmptyAndDisabled() {
  return (
    <div style={stack}>
      <NumberInput value={null} placeholder="Inherit from project defaults" onChange={noop} />
      <NumberInput value={3} min={0} disabled onChange={noop} />
    </div>
  );
}
