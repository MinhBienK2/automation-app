# Electron IPC Contract

## Source Files

- Renderer wrappers: `src/lib/workflowApi.ts` (tests: `src/lib/workflowApi.test.ts`)
- Bridge types: `src/types/electron.ts`
- Preload bridge: `electron/preload.cts`
- IPC channels: `electron/ipc.ts`
- Command handlers: `electron/backend/commands.ts`

## Boundary Rules

- Renderer calls `src/lib/workflowApi.ts` → `window.workflowApi` → preload `contextBridge`.
- Renderer must NOT import: Node, Electron, Playwright, CloakBrowser, filesystem, SQLite.
- Result envelope: `{ ok: true, value }` or `{ ok: false, error: { message, field? } }`.
- Preload unwraps values / throws error objects.
- IPC channels: namespaced strings from `electron/ipc.ts` (e.g., `workflow:listWorkflows`).
- No casing conversion at boundary — shared DTO shapes pass through.
- Native save-dialog and file-writing: owned by Electron main (`saveWorkflowPackageFile`, `saveProjectPackageFile`, `saveSubflowPackageFile`).

## Backend Ownership

| Domain | Owner |
|--------|-------|
| Graph validation/compilation, Call Subflow resolution | Backend |
| Run orchestration, CloakBrowser runner | Backend |
| SQLite persistence, migrations | Backend |
| Package import/export, sanitization | Backend |
| Schedule CRUD, ticking, event history | Backend |
| Operations Overview aggregation | Backend |
| Identity Lab read model, retained-session close | Backend |
| CloakBrowser diagnostics, binary/profile lifecycle | Backend |
| Recorder session, normalization, draft generation | Backend |

## Renderer Restrictions

- No absolute original artifact paths.
- No proxy passwords, cookies, localStorage, sessionStorage, profile contents.
- No raw run outputs through Identity Lab boundaries.
- Recorder DTOs: no browser secrets, no captured password/secret values.
- Profile diagnostic sizes: bounded approximations, not unbounded scans.

## Command Catalog

For the full command list, see `electron/ipc.ts`. Key patterns:

- **Project CRUD**: `createProject` (+ initial profile + `Main` workflow), `updateProject`, `duplicateProject`, `deleteProject`
- **Profile CRUD**: `createProjectEnvironment`, `updateProjectEnvironment`, `deleteProjectEnvironment`, `setWorkflowProjectEnvironment`
- **Workflow CRUD**: `createWorkflow`, `renameWorkflow`, `deleteWorkflow(id, { deleteBrowserProfile? })`, `duplicateWorkflow`
- **Graph**: `getWorkflowGraph`, `saveWorkflowGraph`, `validateWorkflowGraph`, `compileWorkflowGraph`
- **Settings**: `getWorkflowSettings`, `saveWorkflowSettings`, `saveWorkflowSettingsSection`, `validateWorkflowSettings`
- **Run**: `runWorkflow`, `runWorkflowFromNode` → `WorkflowRunSnapshot`, `stopRun`, `getRunState`, `listRunStates`
- **Subflow**: `createSubflow`, `listSubflows`, `getSubflow`, `updateSubflow`, `getSubflowGraph`, `saveSubflowGraph`, `duplicateSubflow`, `deleteSubflow`, `getSubflowUsage`, `exportSubflow`, `importSubflow`, `saveSubflowPackageFile`
- **Package**: `exportWorkflowPackage`, `previewWorkflowPackage`, `importWorkflowPackage`, `exportProjectPackage`, `previewProjectPackage`, `importProjectPackage`
- **Schedule**: `listSchedules`, `getSchedule`, `createSchedule`, `updateSchedule`, `deleteSchedule`, `enableSchedule`, `disableSchedule`, `listScheduleEvents`, `validateSchedule`
- **Identity**: `getIdentityLabOverview`, `getIdentityLabDetail`, `closeIdentityRetainedSession`
- **Recording**: `startRecordingSession`, `getRecordingSession`, `stopRecordingSession`, `listRecordingEvents`, `discardRecordingSession`, `generateRecordingDraft`, `getRecordingDraft`, `saveRecordingDraft`
- **Diagnostics**: `getCloakBrowserDiagnostics`, `installCloakBrowserBinary`, `cleanupOrphanedBrowserProfiles`, `dryRunValidateConfig`

## Change Checklist

- Update `workflowApi.ts`, `electron.ts`, and `preload.cts` together.
- Add/update wrapper tests in `workflowApi.test.ts`.
- Keep main handlers returning result envelope.
