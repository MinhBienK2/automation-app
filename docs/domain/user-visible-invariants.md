# User-Visible Invariants

Preserve these unless the task explicitly changes them.

## Workflow Editing

- Blank workflow names are rejected.
- Blank step names fall back to the action label.
- Step order is stable and contiguous after add, reorder, and delete.
- Opening a workflow selects the preferred step if it still exists, otherwise the first step.

## UI Behavior

- Workflow list and detail remain separate screens.
- User-facing layout and styling changes follow `DESIGN.md`.
- Command errors are shown as readable messages.
- Testing a step opens the monitor for the included step range.

## Command Boundary

- Tauri command errors serialize as `{ message, field }`.
- TypeScript invoke payload keys match Rust command parameters.
- TypeScript and Rust DTO shapes remain compatible.

## Runner Behavior

- Full runs execute all steps in order.
- Test-step runs execute from step 1 through the selected step.
- Stop returns a stopped state and clears active-run ownership.
- Browser sessions remain open after success, failure, and stop.
- Failures identify the failed step when possible.

## Persistence

- Workflow summaries include step counts.
- Workflow detail returns ordered steps.
- Child step changes touch the parent workflow `updated_at`.

