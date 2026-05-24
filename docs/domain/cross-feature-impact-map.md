# Cross-Feature Impact Map

Use this when a change may touch more than one layer.

## Action Config Changes

Check:

- `src/types/workflow.ts`
- `src/lib/actionCapabilities.ts`
- `src/lib/workflowUi.ts`
- `src/features/workflows/lib/workflowStepForm.ts`
- `src/features/workflows/components/ActionConfigEditor.tsx`
- `src/features/workflows/components/ActionConfig*Fields.tsx`
- `electron/backend/graph/compiler.ts`
- `electron/backend/commands.ts`
- `electron/backend/graph/compiler.test.ts`
- `electron/backend/commands.test.ts`
- `README.md` smoke checklist

Risk:

- UI can accept a config the backend rejects.
- Persisted JSON can contain a shape TypeScript does not understand.
- A step can persist but fail at runner dispatch.
- Defaults can create invalid configs.
- Capability registry, palette visibility, backend validation, and runner unsupported behavior can drift.

## Command Changes

Check:

- `src/lib/workflowApi.ts`
- `src/lib/workflowApi.test.ts`
- `electron/preload.cts`
- `electron/ipc.ts`
- `electron/backend/commands.ts`
- `electron/backend/commands.test.ts`
- `src/tests/mocks/electron.ts`

Risk:

- Bridge method names or payload keys drift.
- Errors stop being field-addressable.
- UI tests mock old command names.

## Runner Changes

Check:

- `electron/backend/runtime/runner.ts`
- `electron/backend/runtime/runner.test.ts`
- `electron/backend/runtime/runner.smoke.test.ts`
- `electron/backend/commands.ts`
- `src/features/workflows/components/WorkflowGraphEditor.tsx`
- `src/features/workflows/components/RunStatusBar.tsx`

Risk:

- Progress reporting no longer matches UI assumptions.
- Stop becomes slow or misleading.
- Browser sessions close when users expect inspection after a run.
- Evidence paths can escape the app evidence directory or lose run-level audit context if path handling changes without tests.

## Persistence Changes

Check:

- `electron/backend/persistence/database.ts`
- `electron/backend/persistence/workflowRepository.ts`
- `electron/backend/commands.ts`
- `electron/backend/commands.test.ts`
- Import/export commands if persisted shape changes.

Risk:

- Existing workflows fail to deserialize.
- Step order becomes non-contiguous.
- Workflow list sorting or step counts drift.
