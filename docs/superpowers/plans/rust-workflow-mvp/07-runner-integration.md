# Plan 07 - Runner Integration

## Goal

Connect persisted workflows, Tauri commands, UI state, and the Chromium runner.

## Scope

Implement:

- `run_workflow(workflow_id)`.
- `test_step(workflow_id, step_id)`.
- `stop_run()`.
- One-active-run guard.
- In-memory run state.
- Frontend updates for current status and failure message.

## Runner Behavior

- Run Workflow loads all ordered steps and executes from first to last.
- Test Step loads ordered steps and executes from first step through selected step.
- A new headed Chromium browser opens for every Test/Run.
- Browser remains open after success, failure, or stop.
- First failed step stops execution.
- Stop prevents later steps from running and keeps browser open.
- Starting a second run while one is active is rejected.

## Run State

Represent:

- `idle`
- `running`
- `success`
- `failed`
- `stopped`

Failure payload:

- failed step number
- action type
- short reason

Example:

```text
Failed at step 4: XPath not found
```

## DONE Gate

This plan is DONE when:

- Run Workflow executes all saved steps.
- Test Step executes only through the selected step.
- UI disables Test/Run while running.
- UI shows Stop while running.
- Stop changes status to `stopped`.
- First failure changes status to `failed`.
- Failed message shows step number and short reason.
- Browser remains open in success/failure/stopped states.
- A second Test/Run is rejected while one is running.
- Integration tests or manual smoke tests cover success, failure, and stop.

## Checks

```text
cargo test
npm run build
```

Manual smoke test:

1. Create a workflow with all five actions.
2. Run full workflow.
3. Confirm Chromium remains open on success.
4. Add a bad XPath and run.
5. Confirm failure message and browser remains open.
6. Run a workflow with long Sleep.
7. Click Stop.
8. Confirm status is stopped and browser remains open.

## Stop Rule

Stop after Test/Run/Stop are fully connected. Do not add Run History, screenshots, variables, profile, or extra actions.
