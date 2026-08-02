import { ConfirmDialog } from 'automation-app-ui';

const noop = () => {};

export function DeleteWorkflow() {
  return (
    <ConfirmDialog
      open
      onOpenChange={noop}
      onConfirm={noop}
      variant="destructive"
      title="Delete “Warehouse portal sync”?"
      description="This removes the workflow, its 34 steps and its 2 schedules. Past run history and traces are kept for 30 days."
      confirmText="Delete workflow"
      cancelText="Keep workflow"
    />
  );
}

export function StopRun() {
  return (
    <ConfirmDialog
      open
      onOpenChange={noop}
      onConfirm={noop}
      title="Stop run #4821?"
      description="The browser session closes at the current step (12 of 34). Steps already executed are not rolled back."
      confirmText="Stop run"
      cancelText="Let it finish"
    />
  );
}

export function RevokingIdentity() {
  return (
    <ConfirmDialog
      open
      onOpenChange={noop}
      onConfirm={noop}
      variant="destructive"
      isLoading
      title="Revoke ops-eu@internal.example?"
      description="Signing the identity out invalidates its stored cookies. Three scheduled workflows use it and will fail until a new session is captured."
      confirmText="Revoking…"
      cancelText="Cancel"
    />
  );
}
