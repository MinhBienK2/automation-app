# Runner Architecture

## Purpose

The runner executes action configs in a headed Chromium browser and reports progress back to app state.

## Key Files

- `src-tauri/src/runner/browser.rs`
- `src-tauri/src/runner/actions/mod.rs`
- `src-tauri/src/runner/actions/`
- `src-tauri/src/runner/executor.rs`
- `src-tauri/src/runner/cancellation.rs`
- `src-tauri/src/runner/error.rs`
- `src-tauri/src/services/run_service.rs`
- `src-tauri/src/app_state.rs`
- `src-tauri/tests/runner_spike.rs`

## Current Behavior

- `BrowserRunExecutor` runs action configs through `BrowserRunner`.
- `BrowserRunner` emits `StepStarted` and `StepCompleted`.
- `run_service` maps progress step numbers back to workflow step ids.
- Action failures produce failed outcomes with optional failure screenshots.
- Runner infrastructure errors fail the run without a retained session.
- Browser sessions are retained in `AppState` after terminal outcomes.

## Belongs Here

- Chromium session launch and tab/frame/download behavior.
- Action dispatch and browser interaction.
- Cancellation-aware execution.
- Runner-level errors and outcomes.

## Does Not Belong Here

- UI polling logic.
- SQL persistence.
- Command payload naming.

## Change Checklist

- Preserve cancellation behavior.
- Update runner tests for action behavior.
- Update command tests when run state semantics change.
- Update `docs/contracts/run-state.md` for status/progress changes.

