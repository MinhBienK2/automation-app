# Electron IPC Contract

## Source Files

- Renderer wrappers: `src/lib/workflowApi.ts`
- Renderer wrapper tests: `src/lib/workflowApi.test.ts`
- Bridge types: `src/types/electron.ts`
- Preload bridge: `electron/preload.ts`
- IPC channels: `electron/ipc.ts`
- Main process registration: `electron/main.ts`
- Node command handlers: `electron/backend/commands.ts`

## Current Boundary

The renderer calls `src/lib/workflowApi.ts`, which delegates to
`window.workflowApi`. The bridge is exposed by Electron preload through
`contextBridge`; the renderer does not import Node, Electron, Playwright,
CloakBrowser, filesystem, or SQLite modules directly.

Electron main registers typed IPC channels and returns a result envelope:

```text
{ ok: true, value }
{ ok: false, error: { message, field? } }
```

The preload unwraps successful values and throws the serialized error object for
failed calls. This preserves the command-facing error shape used by
`src/lib/workflowUi.ts`.

## Current Commands

- `listWorkflows`
- `getWorkflow`
- `createWorkflow`
- `renameWorkflow`
- `deleteWorkflow`
- `duplicateWorkflow`
- `getWorkflowGraph`
- `saveWorkflowGraph`
- `validateWorkflowGraph`
- `compileWorkflowGraph`
- `getWorkflowSettings`
- `saveWorkflowSettings`
- `saveWorkflowSettingsSection`
- `validateWorkflowSettings`
- `validateWorkflowRun`
- `getWorkflowBrowserConfig`
- `saveWorkflowBrowserConfig`
- `runWorkflow`
- `stopRun`
- `getRunState`
- `validateSchedule`
- `exportWorkflow`
- `importWorkflow`
- `exportWorkflowPackage`
- `previewWorkflowPackage`
- `importWorkflowPackage`
- `saveWorkflowPackageFile`
- `runBatchWorkflow`
- `suggestSelectors`
- `normalizeRecordedEvents`
- `dryRunValidateConfig`

## Payload Rules

- Renderer wrapper names remain camelCase.
- IPC channels are namespaced strings in `electron/ipc.ts`, for example
  `workflow:listWorkflows`.
- Bridge method arguments use the same TypeScript DTO shapes as the old wrapper
  API, but no Tauri casing conversion is involved.
- Native save-dialog and file-writing behavior is owned by Electron main through
  `saveWorkflowPackageFile`; package JSON is not written from the renderer.
- Command errors serialize as `{ message: string, field?: string | null }`.

## Phase 01 Behavior

Plan 01 provides the Electron shell, preload bridge, typed renderer wrapper, app
data directory creation, and a minimal SQLite schema bootstrap. The command
handler module intentionally uses stub/in-memory behavior until the Node
persistence and command parity plan replaces it.

`src-tauri/` remains in the repository as a temporary reference during the
migration. It is not the renderer command boundary after Plan 01.

## Change Checklist

- Update `src/lib/workflowApi.ts`, `src/types/electron.ts`, and
  `electron/preload.ts` together when the bridge surface changes.
- Add or update focused wrapper tests in `src/lib/workflowApi.test.ts`.
- Keep Electron main handlers returning the result envelope so preload can
  preserve serializable command errors.
- Update this document and `docs/task-routes.md` when command names, payloads,
  native dialog behavior, or verification commands change.
