# Cross-Feature Impact Map

Use this when a change may touch more than one layer.

## Action Config Changes

Check:

- `src/types/workflow.ts`
- `src/lib/workflowUi.ts`
- `src/features/workflows/lib/workflowStepForm.ts`
- `src/features/workflows/components/ActionConfigEditor.tsx`
- `src/features/workflows/components/ActionConfig*Fields.tsx`
- `electron/backend/graphCompiler.ts`
- `electron/backend/commands.ts`
- `electron/backend/graphCompiler.test.ts`
- `electron/backend/commands.test.ts`
- Temporary Rust parity references under `src-tauri/src/domain/`, `src-tauri/src/services/run_service.rs`, and `src-tauri/src/runner/actions/`
- `README.md` smoke checklist

Risk:

- UI can accept a config the backend rejects.
- Persisted JSON can contain a shape TypeScript does not understand.
- A step can persist but fail at runner dispatch.
- Defaults can create invalid configs.

## Command Changes

Check:

- `src/lib/workflowApi.ts`
- `src/lib/workflowApi.test.ts`
- `electron/preload.ts`
- `electron/ipc.ts`
- `electron/backend/commands.ts`
- `electron/backend/commands.test.ts`

Risk:

- Invoke names or payload keys drift.
- Errors stop being field-addressable.
- UI tests mock old command names.

## Runner Changes

Check:

- `src-tauri/src/runner/`
- `src-tauri/src/services/run_service.rs`
- `src-tauri/src/app_state.rs`
- `src/features/workflows/components/WorkflowGraphEditor.tsx`
- `src/features/workflows/components/RunStatusBar.tsx`

Risk:

- Progress reporting no longer matches UI assumptions.
- Stop becomes slow or misleading.
- Browser sessions close when users expect inspection after a run.

## Persistence Changes

Check:

- `src-tauri/migrations/`
- `electron/backend/database.ts`
- `electron/backend/workflowRepository.ts`
- `electron/backend/commands.ts`
- `electron/backend/commands.test.ts`
- Import/export commands if persisted shape changes.

Risk:

- Existing workflows fail to deserialize.
- Step order becomes non-contiguous.
- Workflow list sorting or step counts drift.
