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
- Graph-internal action configs execute branch, switch, loop, retry, try/catch, fallback, break/continue, transform, output assertion, and domain allowlist semantics above the browser action dispatch layer.
- Action failures produce failed outcomes with optional failure screenshots.
- Runner infrastructure errors fail the run without a retained session.
- Browser sessions are retained in `AppState` after terminal outcomes, and captured `window.__wamOutputs` values are copied into run state before retention.

## Belongs Here

- Chromium session launch and tab/frame/download behavior.
- Action dispatch and browser interaction.
- Cancellation-aware execution.
- Runner-level errors and outcomes.

## Action Modules

Browser action script builders live under `src-tauri/src/runner/actions/` and are grouped by user behavior:

- `pointer.rs`: click, force DOM click, hover, and drag/drop pointer interactions.
- `scroll.rs`: page, container, into-view, and until-visible scrolling.
- `wait.rs`: wait condition polling scripts.
- `input.rs`: text input, clearing input, and contenteditable updates.
- `form.rs`: select, checkbox/radio, custom option, and submit form actions.
- `keyboard.rs`: key press, hotkey, and typed key sequence actions.
- `clipboard.rs`: in-run clipboard store and paste actions.
- `element.rs`: focus and blur element actions.
- `data_capture.rs`: output extraction and storage scripts.
- `actionability.rs`, `js.rs`: shared helper code used by action modules.

## Does Not Belong Here

- UI polling logic.
- SQL persistence.
- Command payload naming.

## Change Checklist

- Preserve cancellation behavior.
- Update runner tests for action behavior.
- Update command tests when run state semantics change.
- Update `docs/contracts/run-state.md` for status/progress changes.
