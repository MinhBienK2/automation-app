import { FormField, Label, Textarea } from 'automation-app-ui';

const stack: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
  maxWidth: 460,
};

export function Default() {
  return (
    <div style={stack}>
      <Textarea
        rows={4}
        defaultValue={
          'Opens the supplier portal, exports the backorder report, and uploads it to the shared drive.'
        }
      />
    </div>
  );
}

export function Placeholder() {
  return (
    <div style={stack}>
      <Textarea rows={4} placeholder="Describe what this workflow does…" />
    </div>
  );
}

export function Sizes() {
  return (
    <div style={stack}>
      <Textarea rows={2} defaultValue="Skip rows where quantity is zero." />
      <Textarea
        rows={6}
        defaultValue={
          'Run notes\n\n1. Sign in with the "eu-readonly" identity.\n2. Wait for #orders-grid to settle.\n3. Export the visible page as CSV.\n4. Close the session without saving cookies.'
        }
      />
    </div>
  );
}

export function InFormField() {
  return (
    <div style={stack}>
      <FormField
        label="Selector script"
        htmlFor="textarea-script"
        description="Evaluated in the page context after the step's selector resolves."
      >
        <Textarea
          id="textarea-script"
          rows={4}
          style={{ fontFamily: 'var(--font-mono)' }}
          defaultValue={
            'return document.querySelectorAll("#orders tbody tr").length;'
          }
        />
      </FormField>
      <FormField
        label="Failure webhook payload"
        htmlFor="textarea-payload"
        error="Payload must be valid JSON."
      >
        <Textarea
          id="textarea-payload"
          rows={3}
          style={{ fontFamily: 'var(--font-mono)' }}
          defaultValue={'{ "run_id": "{{run.id}}", "status": "failed", }'}
        />
      </FormField>
    </div>
  );
}

export function DisabledAndReadOnly() {
  return (
    <div style={stack}>
      <Label htmlFor="textarea-disabled">
        Description
        <Textarea
          id="textarea-disabled"
          rows={3}
          disabled
          defaultValue="Locked while a run of this workflow is in progress."
        />
      </Label>
      <Label htmlFor="textarea-readonly">
        Last failure trace
        <Textarea
          id="textarea-readonly"
          rows={3}
          readOnly
          style={{ fontFamily: 'var(--font-mono)' }}
          defaultValue={
            'TimeoutError: waiting for selector "#orders-grid"\n  at step 4 (Wait for element)\n  run wf_8c21a4e0 · 2026-07-31 02:00:14Z'
          }
        />
      </Label>
    </div>
  );
}
