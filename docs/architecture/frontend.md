# Frontend Architecture

## Purpose

The frontend renders workflow management UI, owns interaction state, and calls typed desktop API wrappers. In the current Tauri app those wrappers call Tauri commands. In the Electron rebuild, the same `workflowApi.ts` wrappers first use the preload `window.cloakBrowser` API when available, then fall back to Tauri invoke for the existing app.

## Key Files

- `src/App.tsx`: top-level state orchestration.
- `src/features/settings/pages/SettingsPage.tsx`: app-level settings, including graph autosave and graph shortcut guidance.
- `src/features/workflows/pages/WorkflowListPage.tsx`: workflow list screen.
- `src/features/workflows/pages/WorkflowDetailPage.tsx`: graph-only workflow workspace.
- `src/features/workflows/components/WorkflowGraphEditor.tsx`: React Flow visual graph workspace and graph orchestration state; canvas parts, toolbar, palettes, and inspector panels are split into sibling `WorkflowGraph*` component modules.
- `src/features/workflows/components/WorkflowSettingsDialog.tsx`: per-workflow settings dialog with General, Execution, Browser, Environment, Variables, Triggers, Advanced, and section help.
- `src/components/ui/unsaved-changes-dialog.tsx`: shared confirmation dialog for editable popups that should protect unsaved changes before close.
- `src/components/ui/switch.tsx`, `src/components/ui/segmented-control.tsx`, and `src/components/ui/icon-button.tsx`: shared interaction primitives for on/off settings, compact mutually exclusive choices, and icon-only actions with tooltip text.
- `src/features/workflows/lib/workflowSettings.ts`: frontend defaults, section metadata, Browser device profile presets, tag parsing, Browser compatibility mapping, and bilingual settings help content.
- `src/features/workflows/components/RunIssuePanel.tsx`: blocking validation, runtime failure, and system/startup issue presentation.
- `src/features/workflows/components/GraphShortcutGuide.tsx`: shared graph mouse and keyboard shortcut guide rendered in Settings and the graph toolbar dialog.
- `src/features/workflows/components/ActionConfigEditor.tsx`: reusable action config editor dispatcher used by graph action nodes and the legacy step form container; concrete fields are split into grouped `ActionConfig*Fields.tsx` modules.
- `src/features/workflows/components/TemplateTextField.tsx`: template-aware textarea with token preview/highlighting and variable insertion from known graph variables.
- `src/features/workflows/components/VariableConfigFields.tsx`: shared Set Variables row editor used by action config and graph-node config surfaces.
- `src/features/workflows/components/WorkflowGraphInspectorFields.tsx`: structured graph node config fields used by the graph inspector.
- `src/features/workflows/lib/stepHelpContent.ts` and `src/features/workflows/lib/graphNodeHelpContent.ts`: bilingual schema-backed decision-guide action and graph-node help content rendered in shared modal layouts from the graph inspector and node context menu. These catalogs own detailed field references, required/optional/advanced grouping metadata, value guidance, field-level mistake guidance, port semantics, and select-option explanations for the help popups.
- `src/features/workflows/lib/graphEditorCommands.ts`: pure graph editor commands for bulk delete, duplicate, copy/paste fragments, and bounded undo/redo history.
- `src/features/workflows/lib/workflowActionDefaults.ts`: frontend default action config catalog used by graph node creation and re-exported through `workflowGraph.ts`.
- `src/features/workflows/components/RunStatusBar.tsx`: run status and errors.
- `src/lib/workflowApi.ts`: desktop API wrappers; Electron preload first, Tauri invoke fallback.
- `src/vite-env.d.ts`: typed `window.cloakBrowser` preload surface for the Electron rebuild.
- `src/lib/workflowUi.ts`: pure UI helpers, labels, summaries, run-state normalization.
- `src/types/workflow.ts`: DTO and action config types.

## Belongs Here

- User interaction state.
- Form rendering and local validation display.
- Visual graph editing state before persistence.
- App-level graph autosave preference and graph save status presentation.
- Graph validation/run controls and presentation of validation issues for the selected node or selected link.
- Workflow Settings editing through list Edit and detail Settings, Execution wait-between-nodes controls, Browser device profile presets that coherently fill user agent, viewport, mobile, and touch settings, dialog-level saving for all dirty sections, unsaved-close confirmation, bilingual section help with field-level guidance, and run-before-save orchestration.
- Workflow list duplicate and Workflow Package import/export interaction. Duplicate calls `duplicate_workflow` so local copies preserve saved graph and full settings. Export chooses Flow and selected Workflow Settings sections, opens the native Save dialog, writes package JSON through the Tauri filesystem plugin, and relies on backend sanitization. Import reads package JSON, previews available sections, always creates a new workflow, refreshes the list, and opens the imported workflow.
- Run issue summaries that route graph-backed issues back to the affected node or link.
- Selected-node port guidance for required body ports, optional no-op branches, implicit successful continuation endings, and recovery branches that preserve failure behavior when missing.
- Selected-node help from the graph inspector and node context menu. Configured action nodes reuse the action guide popup with minimum setup, grouped field and option references, output guidance, workflow examples, and safety notes; graph-native nodes use port semantics before minimum setup, grouped field references, and workflow examples with the same modal structure. Mistake guidance belongs inside field or option detail blocks, not as a standalone top-level section.
- DTO-to-React-Flow and React-Flow-to-DTO adapter state, while keeping persisted `WorkflowGraph` as source of truth.
- Action node creation from the semantic action palette, including fixed Wait and Random Wait actions in the Wait group, unconfigured `New node` draft creation from the toolbar, graph-control node creation from simplified grouped node pickers, plus searchable type selection and config editing through the reusable action config editor.
- Variable authoring UI for Set Variables, Set JSON Variables, Repeat For Each manual/array modes, and template token insertion/highlighting in supported text fields.
- Variable picker catalogs known graph variables from Set Variables rows, Set JSON Variables keys, and output-producing action nodes when available.
- Editor-only graph selection, clipboard, and history state. These drive multi-selection summaries, bulk duplicate/delete/copy/paste, undo/redo, and keyboard shortcuts without changing persisted `WorkflowGraph` shape.
- Select-first graph canvas interaction. Empty-canvas drag performs box selection; Space temporarily enables panning through separate temporary state, and the toolbar exposes persistent select/pan modes plus undo, redo, fit view, and shortcuts icon controls.
- Workflow Settings Triggers is currently a planned/compatibility section. The UI shows saved trigger intent and scheduling policy values without active scheduler controls until a scheduler service exists.
- Command invocation through `workflowApi.ts`. New Electron-compatible calls should be added to the preload surface and wrapper fallback together. Workflow wrappers expose default Run Profile, Identity Profile, and Environment selection. Run Profile wrappers expose list/get/create/update/delete. Environment wrappers expose list/get/create/update/delete. Identity Profile wrappers currently expose list/get/create/update/delete/validate/checkAvailability for the Electron rebuild contract. Run wrappers expose start/stop/state, run history listing, and Electron run-event subscription. Policy wrappers expose workspace allowed-origin policy. Evidence wrappers expose event/artifact listing, sanitizer access, and compact sanitized run export.
- UI-only labels, summaries, grouping, and failure suggestions.
- Settings navigation state in the app shell/sidebar.
- Shared switch, segmented-control, and tooltip-backed icon button presentation for user-facing settings, help language controls, editor modes, and icon-only commands.

## Does Not Belong Here

- SQL behavior.
- Runner/browser implementation.
- Backend validation as the only source of truth.
- Ad hoc string manipulation of persisted config JSON.
- List-step authoring UI.

## Change Checklist

- Keep props and DTO shapes aligned with `src/types/workflow.ts`.
- Update focused component/page tests.
- Read `DESIGN.md` before layout or styling changes.
- Keep desktop API names centralized in `workflowApi.ts`; update `src/lib/workflowApi.test.ts` for Tauri fallback and `src/lib/workflowApi.electron.test.ts` for Electron preload behavior.
