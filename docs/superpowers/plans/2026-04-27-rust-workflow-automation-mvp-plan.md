# Rust Workflow Automation MVP Implementation Plan

Date: 2026-04-27

## Scope

Implement the Workflow Automation MVP from `docs/superpowers/specs/2026-04-27-workflow-automation-mvp-design.md`, with one architecture adjustment requested after the spec:

- Use Rust for the desktop app backend and automation runtime.
- Replace the spec's Electron recommendation with Tauri.
- Keep a web UI for builder ergonomics.
- Control a visible Chromium browser from Rust.

This plan does not include implementation yet. It is the execution plan for the MVP.

## Architecture Decision

Use:

- **Tauri 2** for the desktop shell and Rust command bridge.
- **React + TypeScript** for the UI inside Tauri WebView.
- **Rust backend** for workflow persistence, validation, run state, and browser automation.
- **SQLite + SQLx migrations** for local data.
- **chromiumoxide** for controlling headed Chromium through Chrome DevTools Protocol.
- **Tokio** for async runtime and cancellation.

Why this stack:

- Tauri gives a Rust backend with a desktop WebView UI.
- React keeps the two-column workflow builder and drag/drop UI straightforward.
- SQLx gives typed async SQLite access and embedded migrations.
- chromiumoxide can launch Chromium with UI and has a fetcher path for Chromium binaries if needed.

Primary risk:

- Rust browser automation libraries are less mature than Playwright's Node ecosystem. The first implementation phase must prove that `Open URL`, XPath lookup, click, type, scroll, and stop work reliably in headed Chromium.

## MVP Feature Boundary

Build only:

- Workflow List.
- Workflow Builder.
- SQLite persistence with migrations.
- Five action types:
  - Open URL
  - Sleep
  - Type Text by XPath
  - Click by XPath
  - Scroll by pixels
- Test Step.
- Run Workflow.
- Stop Run.
- One active run at a time.
- Current run status: `idle`, `running`, `success`, `failed`, `stopped`.
- Failure message: step number + short reason.

Do not build:

- Profile.
- Variables.
- Run History.
- Output extraction.
- Screenshots.
- Element picker.
- Recorder.
- Headless mode.
- Multi-run.

## Phase 1: Scaffold App

Goal: create a runnable Rust desktop app skeleton.

Tasks:

- Create a Tauri 2 app with React + TypeScript frontend.
- Add Rust dependencies:
  - `tauri`
  - `tokio`
  - `serde`
  - `serde_json`
  - `thiserror`
  - `uuid`
  - `chrono` or `time`
  - `sqlx` with SQLite and migrate features
  - `chromiumoxide`
- Add frontend dependencies:
  - React
  - TypeScript
  - Vite
  - drag/drop library, likely `@dnd-kit/core`
- Define app data directory access from Rust.
- Add basic app window with placeholder navigation.

Acceptance criteria:

- `cargo test` runs.
- Tauri dev app launches.
- Frontend can invoke one Rust command successfully.
- App can resolve a local app data path.

## Phase 2: Domain Model And Validation

Goal: define stable workflow and step types before persistence/UI.

Rust modules:

- `domain/workflow.rs`
- `domain/step.rs`
- `domain/action_config.rs`
- `domain/validation.rs`
- `errors.rs`

Types:

- `Workflow`
- `WorkflowStep`
- `ActionType`
- `ActionConfig`
- `RunStatus`
- `RunError`

Action config enum:

```rust
enum ActionConfig {
    OpenUrl { url: String },
    Sleep { seconds: f64 },
    TypeText { xpath: String, text: String },
    Click { xpath: String },
    Scroll { direction: ScrollDirection, pixels: i64 },
}
```

Validation rules:

- Workflow name is required.
- Step type is required.
- Open URL requires non-empty URL.
- Sleep seconds must be greater than 0.
- Type Text requires XPath and text.
- Click requires XPath.
- Scroll requires direction and pixels greater than 0.

Acceptance criteria:

- Unit tests cover each validation rule.
- Invalid configs return structured errors suitable for UI display.
- Serialization/deserialization to JSON is tested for every action config.

## Phase 3: SQLite Persistence And Migrations

Goal: store workflows and steps locally.

Rust modules:

- `db/mod.rs`
- `db/migrations.rs`
- `repositories/workflow_repository.rs`

Migration 001:

```sql
CREATE TABLE workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE workflow_steps (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  type TEXT NOT NULL,
  config_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

CREATE INDEX idx_workflow_steps_workflow_id
  ON workflow_steps(workflow_id);

CREATE UNIQUE INDEX idx_workflow_steps_order
  ON workflow_steps(workflow_id, order_index);
```

Repository operations:

- List workflows with step count.
- Create workflow.
- Get workflow with ordered steps.
- Rename workflow.
- Delete workflow.
- Add step to end.
- Update step.
- Delete step and compact order indexes.
- Reorder steps in one transaction.

Acceptance criteria:

- Migrations run at app startup.
- Repository tests use a temporary SQLite database.
- Reorder persists correctly.
- Delete workflow cascades steps.
- Step config round-trips through `config_json`.

## Phase 4: Tauri Command API

Goal: expose backend operations to the UI through typed commands.

Commands:

- `list_workflows()`
- `create_workflow(name)`
- `get_workflow(id)`
- `rename_workflow(id, name)`
- `delete_workflow(id)`
- `add_step(workflow_id, action_type)`
- `update_step(step_id, config)`
- `delete_step(step_id)`
- `reorder_steps(workflow_id, ordered_step_ids)`
- `run_workflow(workflow_id)`
- `test_step(workflow_id, step_id)`
- `stop_run()`
- `get_run_state()`

Acceptance criteria:

- Commands return JSON-safe DTOs.
- Errors map to user-facing messages.
- Running command is rejected if another run is already active.
- Unit tests cover command-level validation where practical.

## Phase 5: Workflow List UI

Goal: let users manage saved workflows.

UI components:

- `AppShell`
- `WorkflowListPage`
- `WorkflowRow`
- `CreateWorkflowDialog`

Behavior:

- Show workflow list.
- Create workflow with name.
- Open workflow builder.
- Delete workflow with confirmation.
- Run workflow from list.
- Reflect current run status.

Acceptance criteria:

- User can create a workflow and see it immediately.
- User can reopen saved workflow after app reload.
- User can delete workflow.
- Run button disables while status is `running`.

## Phase 6: Workflow Builder UI

Goal: implement the two-column builder from the spec.

UI components:

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

Behavior:

- Left side shows ordered steps.
- Right side shows selected step form.
- Add Step appends to workflow end and selects new step.
- Drag/drop reorder updates local state and persists.
- Save Step validates and persists form.
- Delete Step removes selected step.
- Test Step runs from step 1 to selected step.
- Run Workflow runs all steps.
- Stop appears while running.

Acceptance criteria:

- Every MVP action can be added and edited.
- Drag/drop reorder survives reload.
- Validation errors appear next to fields.
- Test/Run buttons are disabled while running.
- Stop is visible while running.

## Phase 7: Chromium Runner Spike

Goal: prove Rust can perform all MVP browser actions in headed Chromium before wiring full UX.

Rust modules:

- `runner/mod.rs`
- `runner/browser_session.rs`
- `runner/action_handlers.rs`
- `runner/xpath.rs`
- `runner/cancellation.rs`

Spike tasks:

- Launch headed Chromium with chromiumoxide.
- Open a new clean browser/page for each run.
- Navigate to URL without intentionally waiting for page load.
- Locate XPath immediately using `document.evaluate`.
- Fail immediately when XPath returns no element.
- Click element by calculating bounding rect and dispatching mouse events.
- Type text by focusing element, clearing current value, and inserting text.
- Scroll main page by pixels.
- Sleep with cancellation support.
- Keep browser open after final status.
- Stop execution without closing browser.

Acceptance criteria:

- A local static HTML page can be automated with all five actions.
- Missing XPath fails with `XPath not found`.
- Type Text clears previous value before entering new text.
- Stop during Sleep sets status to `stopped` and does not close browser.
- Browser remains open after success/failure/stop.

## Phase 8: Runner Integration

Goal: connect persisted workflows to the browser runner.

Runner behavior:

- Load workflow and ordered steps from repository.
- For Run Workflow, execute all steps.
- For Test Step, execute from first step through selected step.
- Reject if there is an active run.
- Maintain in-memory run state.
- Emit state changes to frontend.
- Return status:
  - `success`
  - `failed`
  - `stopped`

Failure handling:

- Stop immediately at first failed step.
- Store current in-memory error:
  - step number
  - action type
  - short reason

Acceptance criteria:

- Test Step runs only through selected step.
- Run Workflow runs all steps.
- First failure stops later steps.
- UI shows failed step and reason.
- A second run cannot start while one is running.

## Phase 9: Automated Tests

Goal: lock down core behavior before polishing.

Rust tests:

- Config validation.
- Config JSON round-trip.
- Repository CRUD.
- Migration startup.
- Reorder transaction.
- Run state transitions.
- Test Step boundary.
- Stop handling.

Runner integration tests:

- Serve a local HTML page during tests.
- Run a workflow that types, clicks, scrolls, and sleeps.
- Assert missing XPath fails immediately.
- Assert Open URL does not require page-load wait from app logic.

Frontend tests:

- Render Workflow List.
- Create workflow.
- Add each action form.
- Validate required fields.
- Reorder steps.

Acceptance criteria:

- `cargo test` passes.
- Frontend test command passes.
- Manual smoke test confirms headed Chromium opens and remains open.

## Phase 10: App Polish For MVP

Goal: make the MVP usable without expanding scope.

Tasks:

- Add empty states.
- Add delete confirmations.
- Add unsaved form state handling.
- Add concise status bar.
- Add failed message format:
  - `Failed at step 4: XPath not found`
- Add basic app menu/window title.
- Add README with development commands.

Acceptance criteria:

- User can complete the full flow:
  1. Create workflow.
  2. Add Open URL, Sleep, Type Text, Click, Scroll.
  3. Reorder steps.
  4. Save workflow.
  5. Test a selected step.
  6. Run full workflow.
  7. Stop a running workflow.
  8. Reopen workflow after restart.

## Implementation Order

Recommended order:

1. Scaffold Tauri app.
2. Domain model and validation.
3. SQLite migration and repository.
4. Tauri command API for workflow CRUD.
5. Workflow List UI.
6. Workflow Builder UI without runner.
7. Chromium runner spike.
8. Runner integration.
9. Tests.
10. MVP polish.

This order keeps the uncertain Rust/Chromium automation layer isolated until the data model and UI contract are stable, but still validates it before final integration.

## Source References

- Tauri docs describe Tauri as a Rust backend with HTML rendered in a WebView and a bridge between WebView and Rust backend.
- chromiumoxide README shows launching Chromium with UI using `with_head()` and notes a fetcher option for Chromium binaries.
- SQLx migration docs describe embedded migrations through `sqlx::migrate!()`.
