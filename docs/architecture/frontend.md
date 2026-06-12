# Frontend Architecture

## Purpose

The frontend renders workflow management UI, owns interaction state, and calls typed Electron bridge wrappers. It must NOT import Node, Electron, Playwright, CloakBrowser, filesystem, or SQLite.

## Key File Locations

| Area | Entry Point |
|------|-------------|
| Top-level orchestration | `src/App.tsx` |
| Overview | `src/features/overview/` |
| Evidence | `src/features/evidence/` |
| Identities | `src/features/identities/` |
| Projects | `src/features/projects/` |
| Schedules | `src/features/schedules/` |
| Settings | `src/features/settings/` |
| Workflows/Subflows/Graph | `src/features/workflows/` |
| Shared UI primitives | `src/components/ui/` |
| Bridge wrappers | `src/lib/workflowApi.ts` |
| DTO types | `src/types/workflow.ts` (barrel) |
| UI helpers | `src/lib/workflowUi.ts`, `src/lib/appState.ts` |
| Styles | `src/styles/workflows.css`, `workflow-panels.css`, `mission-workspaces.css`, `workflow-graph.css`, `workflow-graph-overlays.css` |
| Graph libs | `src/features/workflows/lib/` (layout, commands, edges, config, help) |

For component-level inventory, use `ls` on the relevant directory.

## Belongs Here

- User interaction state, form rendering, local validation display.
- Visual graph editing state (React Flow adapter, undo/redo, clipboard, selection).
- Graph inspector drawer, toolbar, palettes, node help, port tooltips.
- Workflow Settings editing (dialog-level save, section help, unsaved-close protection).
- Run status display, Run Monitor drawer, run issue panel.
- Run polling via `list_run_states` for active run snapshots.
- App-level autosave preference, graph save status presentation.
- Exit protection for unsaved graph/settings edits.
- Command invocation through `workflowApi.ts` → `window.workflowApi`.
- UI-only labels, summaries, grouping, failure suggestions.
- Typed Mission Control navigation target routing (sidebar + in-page links).
- Shared UI primitives (switch, segmented-control, icon-button with tooltip).

## Does Not Belong Here

- SQL behavior.
- Runner/browser implementation.
- Backend validation as the only source of truth.
- Ad hoc string manipulation of persisted config JSON.
- Creating identity ids, fingerprint seeds, or deleting profile directories.
- Reading raw run outputs, proxy credentials, cookies, or profile storage.

## Change Checklist

- Keep props/DTOs aligned with `src/types/workflow.ts` barrel.
- Update focused component/page tests.
- Read `DESIGN.md` before layout or styling changes.
- Keep command names centralized in `workflowApi.ts`.
