# Plan 01 - Electron Shell And IPC Foundation

Date: 2026-05-09

## Goal

Create the installable Electron desktop foundation without changing workflow
behavior yet. The React renderer should load in Electron, and the renderer
should call a typed Electron IPC bridge instead of Tauri `invoke`.

## Scope

- Add Electron main and preload entry points.
- Add Linux-oriented Electron packaging scripts.
- Keep Vite and the current React app as the renderer.
- Replace Tauri invoke usage in `src/lib/workflowApi.ts` with a typed bridge
  wrapper.
- Add renderer-side bridge types.
- Add a minimal backend command registry with stub or in-memory handlers only
  where needed to keep UI tests focused.
- Initialize the new Electron app data path.
- Add a minimal SQLite open/migrate bootstrap, but do not port full persistence
  yet.

## Out Of Scope

- CloakBrowser runner implementation.
- Full workflow persistence.
- Graph compiler port.
- Tauri/Rust deletion.
- Data migration from existing SQLite.

## TDD And Checks

- Use `.agents/skills/test-driven-development` before behavior-changing edits.
- Start with tests that prove `workflowApi.ts` calls the Electron bridge and
  preserves command error shape.
- Update existing frontend mocks from Tauri to Electron bridge equivalents.
- Run:
  - `npm test -- src/lib/workflowApi.test.ts`
  - focused UI tests affected by bridge mocking
  - `npx tsc --noEmit`
  - Electron package/build smoke command once available

## Docs To Update

- `docs/architecture/overview.md`
- `docs/architecture/command-boundary.md`
- `docs/contracts/tauri-commands.md`, renamed or replaced with an Electron IPC
  contract
- `docs/task-routes.md`
- `README.md` command references for Electron development

## DONE Gate

- React UI launches inside Electron on Linux.
- Renderer has no direct Node integration.
- `window.workflowApi` is exposed through preload.
- `workflowApi.ts` no longer depends on Tauri invoke.
- Existing frontend tests pass after mock updates.
- A Linux package/dev command is documented.
- Docs reflect Electron IPC as the command boundary.
- Changes are committed.
