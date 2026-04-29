# Cross-Feature Impact Map

Use this when a change may touch more than one layer.

## Action Config Changes

Check:

- `src/types/workflow.ts`
- `src/lib/workflowUi.ts`
- `src/features/workflows/lib/workflowStepForm.ts`
- `src/features/workflows/components/StepForm.tsx`
- `src-tauri/src/domain/action_config.rs`
- `src-tauri/src/domain/validation.rs`
- `src-tauri/src/services/run_service.rs`
- `src-tauri/src/runner/actions/`
- `src-tauri/tests/domain_validation.rs`
- `src-tauri/tests/command_api.rs`
- `README.md` smoke checklist

Risk:

- UI can accept a config the backend rejects.
- Rust can serialize a shape TypeScript does not understand.
- A step can persist but fail at runner dispatch.
- Defaults can create invalid configs.

## Command Changes

Check:

- `src/lib/workflowApi.ts`
- `src/lib/workflowApi.test.ts`
- `src-tauri/src/commands.rs`
- `src-tauri/tests/command_api.rs`

Risk:

- Invoke names or payload keys drift.
- Errors stop being field-addressable.
- UI tests mock old command names.

## Runner Changes

Check:

- `src-tauri/src/runner/`
- `src-tauri/src/services/run_service.rs`
- `src-tauri/src/app_state.rs`
- `src/features/workflows/components/TestStepMonitor.tsx`
- `src/features/workflows/components/RunStatusBar.tsx`

Risk:

- Progress reporting no longer matches UI assumptions.
- Stop becomes slow or misleading.
- Browser sessions close when users expect inspection after a run.

## Persistence Changes

Check:

- `src-tauri/migrations/`
- `src-tauri/src/repositories/workflow_repository.rs`
- `src-tauri/tests/persistence.rs`
- Import/export commands if persisted shape changes.

Risk:

- Existing workflows fail to deserialize.
- Step order becomes non-contiguous.
- Workflow list sorting or step counts drift.

