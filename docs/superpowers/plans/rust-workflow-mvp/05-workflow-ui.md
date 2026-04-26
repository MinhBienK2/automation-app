# Plan 05 - Workflow UI

## Goal

Build the Workflow List and Workflow Builder UI against the Tauri command API.

This plan can use placeholder run commands if the runner is not implemented yet.

## Scope

Build:

- Workflow List.
- Two-column Workflow Builder.
- Step add/edit/delete/reorder.
- Action-specific forms.
- Current run status display using existing command state.

Do not implement Chromium automation in this plan.

## Components

Create components similar to:

- `AppShell`
- `WorkflowListPage`
- `WorkflowRow`
- `CreateWorkflowDialog`
- `WorkflowBuilderPage`
- `StepList`
- `StepListItem`
- `AddStepMenu`
- `StepDetailPanel`
- `OpenUrlForm`
- `SleepForm`
- `TypeTextForm`
- `ClickForm`
- `ScrollForm`
- `RunStatusBar`

## UI Behavior

- Workflow List shows saved workflows.
- User can create workflow.
- User can open workflow builder.
- User can delete workflow with confirmation.
- Builder left side shows ordered steps.
- Builder right side shows selected step form.
- Add Step appends to the end and selects the new step.
- Drag/drop reorder persists.
- Save Step validates and persists.
- Delete Step removes selected step.
- Test/Run buttons call existing commands.
- Stop is shown only while `running`.

## DONE Gate

This plan is DONE when:

- User can create, open, rename, and delete workflows from UI.
- User can add every MVP action type.
- User can edit and save every action form.
- User can delete a step.
- User can drag/drop reorder steps and reload with order preserved.
- Validation errors are visible next to relevant fields.
- Test/Run buttons are disabled while running.
- Stop button appears while running.
- Frontend build passes.

## Checks

```text
npm run build
cargo test
```

Add frontend tests if the scaffold includes a test runner. If not, record manual UI smoke checks in the commit message or README.

## Stop Rule

Stop after CRUD and builder UX work. Do not implement browser automation here.
