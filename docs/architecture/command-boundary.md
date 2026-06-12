# Command Boundary

## Purpose

The Electron IPC bridge is the contract between the React renderer and the Node/Electron backend.

## Key Files

| Layer | Files |
|-------|-------|
| Frontend wrappers | `src/lib/workflowApi.ts`, `src/lib/workflowApi.test.ts` |
| Bridge types | `src/types/electron.ts` |
| Preload/IPC | `electron/preload.cts`, `electron/ipc.ts`, `electron/main.ts` |
| Command handlers | `electron/backend/commands.ts` |
| Run lifecycle | `electron/backend/runtime/runManager.ts`, `batchWorkflowRun.ts` |
| Scheduling | `electron/backend/scheduling/scheduleCommands.ts` |
| Services | `workflowSettingsService.ts`, `workflowPackageService.ts`, `projectPackageService.ts` |
| Project cascades | `electron/backend/projects/projectCommandCascades.ts` |
| Persistence | `electron/backend/persistence/database.ts`, `workflowRepository.ts` |
| Read models | `operationsRepository.ts`, `evidenceRepository.ts`, `identityRepository.ts` |
| Recording | `recordingDraftCommands.ts`, `reviewReconciliation.ts` |
| Diagnostics | `cloakBrowserDiagnostics.ts` |

## Belongs Here

- Bridge method names, IPC channel names, payload keys.
- `electron/ipc.ts` is the canonical channel map (preload derives from it).
- Conversion from domain/runner errors → `CommandError { message, field? }`.
- Delegating validation to owning domain services before persistence/execution.
- All CRUD command logic (project, profile, workflow, subflow, settings, schedule, evidence, identity).
- Graph load/save/validate/compile/run commands.
- Import/export, duplicate, batch run, recorder lifecycle/draft commands.
- Native file dialogs and file writes for export flows.
- Security: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.

## Does Not Belong Here

- UI state decisions.
- SQL implementation details.
- Renderer-side KPI, evidence, or identity aggregation.
- Browser action internals.
- Run manager internal state (locks, snapshots, batch accounting).

## Key Rules

- Invalid nodes → serializable `CommandError` before run starts (never compile to no-ops).
- Empty compiled plans → rejected before runner starts.
- Empty Call Subflow → blocking error (not skip-and-continue).
- Manual blocked launches → one `launch_blocked` attention item. Manual Validate alone does not.
- Package export sanitizes: proxy passwords, URL credentials, font dirs.
- Recorder `saveRecordingDraft` ignores renderer action type/locator replacement.
- Retired: `suggestSelectors`, `normalizeRecordedEvents`, list-step commands.

## Change Checklist

- Update `workflowApi.ts`, `electron.ts`, `preload.cts`, `ipc.ts` together.
- Update `workflowApi.test.ts` and focused command handler tests.
- Keep `CommandError` serializable as `{ message, field? }`.
- Keep preload unwrap compatible with IPC result envelope.
