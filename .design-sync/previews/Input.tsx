import { FormField, Input, Label } from 'automation-app-ui';

const stack: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  maxWidth: 420,
};

export function Default() {
  return (
    <div style={stack}>
      <Input placeholder="https://portal.internal.example/login" />
      <Input defaultValue="nightly-inventory-sync" />
    </div>
  );
}

export function WithLabel() {
  return (
    <div style={stack}>
      <Label htmlFor="workflow-name">
        Workflow name
        <Input id="workflow-name" defaultValue="Nightly inventory sync" />
      </Label>
    </div>
  );
}

export function InFormField() {
  return (
    <div style={stack}>
      <FormField
        label="Start URL"
        htmlFor="start-url"
        description="The page every run of this workflow opens first."
      >
        <Input id="start-url" defaultValue="https://portal.internal.example/orders" />
      </FormField>
      <FormField
        label="Concurrency"
        htmlFor="concurrency"
        error="Must be between 1 and 8."
      >
        <Input id="concurrency" type="number" defaultValue={12} />
      </FormField>
    </div>
  );
}

export function Types() {
  return (
    <div style={stack}>
      <Input type="email" placeholder="automation-lab@example.invalid" />
      <Input type="password" defaultValue="hunter2-not-really" />
      <Input type="number" defaultValue={30} />
      <Input type="search" placeholder="Filter runs" />
    </div>
  );
}

export function Disabled() {
  return (
    <div style={stack}>
      <Input disabled defaultValue="Locked by an active run" />
      <Input disabled placeholder="Unavailable while running" />
      <Input readOnly defaultValue="wf_8c21a4e0 (read-only)" />
    </div>
  );
}
