import { UnsavedChangesDialog } from 'automation-app-ui';

const noop = () => {};

export function ClosingTheGraphEditor() {
  return (
    <UnsavedChangesDialog
      open
      onKeepEditing={noop}
      onDiscardChanges={noop}
      onSaveAndClose={noop}
    />
  );
}

export function OverTheStepEditor() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minHeight: 260,
        padding: 16,
        borderRadius: 10,
        border: '1px solid var(--border)',
        background: 'var(--surface)',
      }}
    >
      <span style={{ color: 'var(--fg-primary)', fontWeight: 600 }}>
        Step 12 — Click “Export CSV”
      </span>
      <span style={{ color: 'var(--fg-secondary)' }}>
        Selector, wait condition and retry policy edited since the last save.
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-secondary)', fontSize: 12 }}>
        [data-testid="export-csv"]
      </span>
      <UnsavedChangesDialog
        open
        onKeepEditing={noop}
        onDiscardChanges={noop}
        onSaveAndClose={noop}
      />
    </div>
  );
}
