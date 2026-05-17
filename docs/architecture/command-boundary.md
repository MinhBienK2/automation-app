# Command Boundary

## Purpose

The Electron IPC bridge is the contract between the React renderer and the
Node/Electron backend.

## Key Files

- Frontend wrappers: `src/lib/workflowApi.ts`
- Wrapper tests: `src/lib/workflowApi.test.ts`
- Bridge types: `src/types/electron.ts`
- Electron preload: `electron/preload.cts`
- Electron IPC channels: `electron/ipc.ts`
- Electron main registration: `electron/main.ts`
- Node command handlers: `electron/backend/commands.ts`
- Electron SQLite bootstrap: `electron/backend/database.ts`
- Electron repository: `electron/backend/workflowRepository.ts`
- Command contract: `docs/contracts/electron-ipc.md`

## Belongs Here

- Bridge method names, IPC channel names, and payload keys.
- Conversion from repository/domain/runner errors into `CommandError`.
- Workflow lookup and command-level not-found errors.
- Validation before persistence or execution.
- Workflow Settings load/save/section-save commands, run validation, and validation before persistence or execution.
- Legacy workflow browser runtime config commands map to Workflow Settings Browser.
- Import/export, duplicate, batch run, builder assist command logic.
- Schedule CRUD, enable/disable validation, schedule event listing, and in-app scheduler tick logic.
- Workflow graph load, save, validate, compile, and run command logic.
- Native file dialogs and file writes needed by command flows, such as workflow package export.
- Graph commands must keep invalid advanced node execution explicit: return a serializable command error before starting a run instead of compiling invalid nodes to no-ops.
- Graph runs reject graphs with no executable compiled steps before starting the runner.
- Nested subworkflow nodes are not part of the current workflow contract.
- Product-facing workflow execution goes through `runWorkflow`, which runs the saved workflow graph with saved Workflow Settings as the run baseline. The UI saves the current graph and dirty settings sections before invoking it.
- Product-facing batch execution remains globally exclusive with normal workflow execution, shares stop handling and persisted run records, and rejects starts while any normal run is active.
- Product-facing scheduled execution uses the same saved-workflow run path as manual `runWorkflow`, uses workflow/profile/batch conflict checks instead of a global normal-run lock, and records skipped/missed/failed scheduler decisions in schedule events.
- Workflow package import validates selected sections before creation and wraps workflow, graph, and settings writes in a SQLite transaction.
- Production BrowserWindows keep `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`; renderer access stays limited to the typed preload bridge.
- Product-facing local copy goes through `duplicateWorkflow`, which copies the saved graph and non-storage local settings without package-export sanitization, but creates a fresh browser identity/profile/fingerprint and disables Run from selected so the copy does not reuse the source session.
- CloakBrowser operational commands stay in the backend: diagnostics report wrapper/binary/cache/display/GeoIP/font/profile metadata plus last smoke/preflight summary fields, install triggers `ensureBinary()`, and orphan cleanup deletes only inactive profile directories that no workflow references.
- Workflow deletion accepts an explicit profile-data choice from the renderer. It keeps browser profile data by default, deletes only unshared profile directories when requested, and rejects deletion while that workflow's retained browser session still owns the profile.
- Workflow Settings saves reject identity profile reset/delete while that workflow's retained browser session still owns the profile.
- Debug-only fixture generation is not part of the production command surface.
- List-step authoring commands remain retired from the production command surface.

## Does Not Belong Here

- UI state decisions.
- SQL implementation details.
- Browser action internals.
- Long-running run progress state internals outside calls into the run service.

## Change Checklist

- Update `workflowApi.ts`, `src/types/electron.ts`, `electron/preload.cts`, and `electron/ipc.ts` for bridge contract changes.
- Update `workflowApi.test.ts` and focused command handler tests.
- Keep `CommandError` serializable as `{ message, field? }`.
- Keep the preload unwrap compatible with the IPC result envelope.
