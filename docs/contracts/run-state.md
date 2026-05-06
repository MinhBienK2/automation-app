# Run State Contract

## Source Files

- Frontend types: `src/types/workflow.ts`
- UI helpers: `src/lib/workflowUi.ts`
- App orchestration: `src/App.tsx`
- Monitor: `src/features/workflows/components/TestStepMonitor.tsx`
- Status bar: `src/features/workflows/components/RunStatusBar.tsx`
- Rust run domain: `src-tauri/src/domain/run.rs`
- App state: `src-tauri/src/app_state.rs`
- Run service: `src-tauri/src/services/run_service.rs`

## Shape

Run state includes:

- `status`: `idle`, `running`, `success`, `failed`, `stopped`
- `mode`: `none`, `run_workflow`, `test_step`
- `target_step_id`
- `current_step_id`
- `current_step_number`
- `completed_step_ids`
- `outputs`: captured runtime outputs/variables available after the runner has a browser session to inspect
- `error`

Run errors include:

- `step_id`
- `step_number`
- `step_name`
- `action_type`
- `reason`

## Lifecycle

- `begin_run` closes retained browser sessions from previous terminal runs, then sets status to `running`, mode, target step id, and clears progress/error.
- Progress events set current step and completed step ids.
- `stop_run` sets status to `stopped` and clears error.
- `finish_run` clears active run, clears current step, captures `window.__wamOutputs` from the retained browser session when present, sets terminal status, and retains session when present.
- Infrastructure failure sets status to `failed` without retained session.

## UI Expectations

- `App.tsx` polls `get_run_state` while status is `running`.
- Test monitor derives per-step status from target/current/completed/error.
- Run status bar displays terminal and error states.
- Run issue presentation is derived from run state, command errors, and graph validation issues without changing the persisted run-state shape.
- Graph runs reuse this shape. `WorkflowGraphEditor` renders current/completed/failed graph node state when `current_step_id`, `completed_step_ids`, or `error.step_id` match compiled graph node ids.

## Change Checklist

- Update TypeScript and Rust types together.
- Update monitor/status tests.
- Update command tests when lifecycle semantics change.
- Update `docs/domain/execution-semantics.md`.
