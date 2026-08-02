import { Input, Label, Textarea } from 'automation-app-ui';

const stack: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
  maxWidth: 440,
};

export function Default() {
  return (
    <div style={stack}>
      <Label htmlFor="label-selector">
        CSS selector
        <Input id="label-selector" defaultValue="#order-table tbody tr" />
      </Label>
    </div>
  );
}

export function StandaloneText() {
  return (
    <div style={stack}>
      <Label htmlFor="label-standalone-a">Schedule timezone</Label>
      <Label htmlFor="label-standalone-b">Retry attempts per step</Label>
      <Label htmlFor="label-standalone-c">Browser identity</Label>
    </div>
  );
}

export function WrappingControls() {
  return (
    <div style={stack}>
      <Label htmlFor="label-run-name">
        Run label
        <Input id="label-run-name" defaultValue="Nightly inventory sync — 02:00" />
      </Label>
      <Label htmlFor="label-expression">
        Transform expression
        <Textarea
          id="label-expression"
          rows={3}
          defaultValue={'rows.filter((row) => row.status === "backordered")'}
        />
      </Label>
    </div>
  );
}

export function WithHelperText() {
  return (
    <div style={stack}>
      <Label htmlFor="label-timeout">
        Step timeout (ms)
        <Input id="label-timeout" type="number" defaultValue={15000} />
        <span style={{ color: 'var(--fg-muted)', fontSize: 12 }}>
          Applies to every browser step unless a step overrides it.
        </span>
      </Label>
    </div>
  );
}
