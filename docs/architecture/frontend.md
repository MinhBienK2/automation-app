# Frontend Architecture

## Purpose

The frontend renders workflow management UI, owns interaction state, and calls typed Electron bridge wrappers.

## Key Files

- `src/App.tsx`: top-level state orchestration.
- `src/features/overview/pages/OperationsOverviewPage.tsx`: default Mission
  Control operations dashboard with durable metrics, live runs, attention,
  activity, recent evidence metadata, and upcoming schedules.
- `src/features/evidence/pages/EvidenceExplorerPage.tsx`: durable evidence
  workspace with filters, list/grid results, selection, typed detail payloads,
  screenshot preview, artifact reveal, and bundle export actions.
- `src/features/identities/pages/IdentityLabPage.tsx`: current managed browser
  identity workspace with list/detail posture, latest observed evidence,
  sanitized diagnostics, historical identity references, retained-session close,
  guarded reset, and navigation to Evidence/Runs/Workflow Settings.
- `src/features/settings/pages/SettingsPage.tsx`: app-level settings, including graph autosave, environment readiness diagnostics, guarded maintenance commands, and graph shortcut guidance.
- `src/features/schedules/pages/SchedulesPage.tsx`: cross-workflow schedule list, create/edit dialog, enable/disable actions, focused schedule target state, and event history view with run/workflow traceability.
- `src/features/runs/pages/RunCenterPage.tsx`: user-facing Runs session monitor for active and recent workflow run snapshots, selected durable run detail, missing-run target state, and run-to-workflow/identity/evidence links.
- `src/features/workflows/pages/WorkflowListPage.tsx`: workflow list screen with icon-only row actions, including direct Run for saved workflow state and the Record Workflow entry point.
- `src/features/workflows/pages/WorkflowDetailPage.tsx`: graph-only workflow workspace.
- `src/features/workflows/components/WorkflowGraphEditor.tsx`: React Flow visual graph workspace and graph orchestration state; canvas parts, toolbar, palettes, and inspector panels are split into sibling `WorkflowGraph*` component modules.
- `src/features/workflows/components/WorkflowSettingsDialog.tsx`: per-workflow settings dialog with General, Graph, Run Policy, Browser Launch, Environment, grouped fieldsets for related controls, and section help. Run Policy exposes run lifecycle controls including Allow Run JavaScript and a grouped Run from selected enablement/scope control, while batch defaults stay paused and disabled until Batch Run UI is ready.
- `src/features/workflows/components/RecordingReviewDialog.tsx`: browser recorder status and review dialog for generated recording drafts.
- `src/features/workflows/components/WorkflowPackageOptions.tsx`: shared Workflow Package Flow/Settings section checkbox controls used by import/export dialogs.
- `src/components/ui/unsaved-changes-dialog.tsx`: shared confirmation dialog for editable popups that should protect unsaved changes before close.
- `src/components/ui/switch.tsx`, `src/components/ui/segmented-control.tsx`, and `src/components/ui/icon-button.tsx`: shared interaction primitives for on/off settings, compact mutually exclusive choices, and icon-only actions with tooltip text.
- `src/features/workflows/lib/workflowSettings.ts`: frontend defaults, section metadata, tag parsing, browser profile naming, variable JSON helpers, and bilingual settings help content.
- `src/features/workflows/components/RunIssuePanel.tsx`: compact blocking validation, runtime failure, and system/startup issue presentation with copyable collapsed raw details for long errors.
- `src/features/workflows/components/GraphShortcutGuide.tsx`: shared graph mouse and keyboard shortcut guide rendered in Settings and the graph toolbar dialog.
- `src/features/workflows/components/ActionConfigEditor.tsx`: reusable action config editor dispatcher used by graph action nodes; concrete fields are split into grouped `ActionConfig*Fields.tsx` modules.
- `src/features/workflows/components/HelpDisclosure.tsx`: shared native disclosure wrapper for collapsible workflow help sections and nested help groups.
- `src/features/workflows/components/TemplateTextField.tsx`: template-aware textarea with token preview/highlighting and variable insertion from known graph variables.
- `src/features/workflows/components/VariableConfigFields.tsx`: shared Set Variables row editor used by action config and graph-node config surfaces.
- `src/features/workflows/components/WorkflowGraphInspectorFields.tsx`: structured graph node config fields used by the graph inspector.
- `src/features/workflows/lib/stepHelpContent.ts` and `src/features/workflows/lib/graphNodeHelpContent.ts`: bilingual schema-backed decision-guide action and graph-node help content rendered in shared modal layouts from the graph inspector and node context menu. These catalogs own detailed field references, required/optional/advanced grouping metadata, value guidance, field-level mistake guidance, port semantics, and select-option explanations for the help popups.
- `src/features/workflows/lib/stepHelpTypes.ts`: shared action-help field/reference types consumed by help catalogs, palettes, and modal rendering so the generated action catalog does not own cross-component type contracts.
- `src/features/workflows/lib/stepHelpFieldGuidance.ts`: shared action-help field details, option references, and locator-field helpers used by action help generation.
- `src/features/workflows/lib/graphEditorCommands.ts`: pure graph editor commands for bulk delete, duplicate, copy/paste fragments, and bounded undo/redo history.
- `src/features/workflows/lib/workflowActionDefaults.ts`: frontend default action config catalog used by graph node creation and re-exported through `workflowGraph.ts`.
- `src/features/workflows/components/RunStatusBar.tsx`: run status and errors.
- `src/lib/workflowApi.ts`: Electron bridge wrappers.
- `src/types/electron.ts`: renderer-visible bridge contract.
- `src/lib/workflowUi.ts`: pure UI helpers, labels, summaries, run-state normalization.
- `src/types/workflow.ts`: DTO and action config types.

## Belongs Here

- User interaction state.
- Form rendering and local validation display.
- Visual graph editing state before persistence.
- App-level graph autosave preference and graph save status presentation.
- Graph validation/run controls and presentation of validation issues for the selected node or selected link.
- Workflow Settings editing through list Edit and detail Settings, grouped related controls within each section, Run Policy lifecycle controls including the grouped Run from selected scope plus paused read-only batch defaults, Browser Launch, Graph link-wait authoring defaults, Environment initial variables, dialog-level saving for all dirty sections, unsaved-close confirmation, bilingual nested collapsible section help with individually collapsible field, example, related-action, and mistake guidance, and run-before-save orchestration.
- Browser Launch Reset identity uses an in-app confirmation dialog and delegates generation/persistence to `resetWorkflowBrowserIdentity`; the renderer does not create identity ids or fingerprint seeds.
- Overview is the default app screen. It calls `getOperationsOverview` with
  the operator local-day UTC range, displays backend-owned aggregate data,
  supports manual refresh, and navigates returned workflow/run/schedule
  references into existing Workflows, Runs, Schedules, and focused Evidence
  destinations.
- The app shell owns a typed in-memory Mission Control navigation target
  router. Sidebar navigation, Overview cards, Evidence links, Identity links,
  schedule history links, selected run details, command search results, and the
  Alerts shortcut route through that contract instead of passing raw strings.
  Missing durable run or schedule targets render explicit stale-target states.
- The app shell command bar searches only bounded approved read models:
  workflow summaries, run snapshots, schedule summaries, evidence list items,
  and Identity Lab summaries. It must not render raw run outputs, browser
  storage, cookies, tokens, proxy credentials, local filesystem paths, or
  arbitrary diagnostic payloads. Identity results derived from evidence route
  to read-only historical identity context with workflow/run/evidence metadata.
  Alerts focuses Overview's Attention Queue.
- Evidence owns historical evidence browsing UI state. It calls
  `listEvidenceItems`, loads selected detail through `getEvidenceDetail`,
  requests screenshot previews only through `getEvidenceScreenshotPreview`,
  delegates file reveal/export through backend commands, and navigates related
  runs/workflows back into existing destinations. Identity evidence opens
  Identity Lab as a read-only historical target carrying workflow, run, and
  evidence context.
- Workflow list direct Run, duplicate, and Workflow Package import/export interaction. List Run calls the existing `runWorkflow` command against saved workflow state and leaves the user on the list while run snapshot polling continues. Active row status, row Run disabling, and row Stop are scoped to that workflow's run id. Duplicate calls `duplicateWorkflow` so local copies preserve the saved graph and non-storage settings while receiving a fresh browser identity/profile/fingerprint. Export chooses Flow and selected Workflow Settings sections, then delegates native Save dialog and package JSON writing to the Electron backend. Import reads package JSON from the browser file input, previews available sections, always creates a new workflow, refreshes the list, and opens the imported workflow.
- Browser recorder UI orchestration. The workflow list starts a backend-owned
  new-workflow recorder session, and the workflow detail header starts a
  `replace_current_graph` recorder session for explicit graph replacement. The
  review dialog stops the session, loads a generated draft, labels the save
  action as Save Workflow or Replace Graph according to draft mode, and lets the
  renderer edit reviewed step labels, inclusion flags, and supported action
  values before calling `saveRecordingDraft`. Backend-held step timing is not
  editable in the renderer; saved recording graphs use it to create fixed
  inter-step edge delays and row-wrapped node positions for long recordings.
- Run issue summaries that route graph-backed issues back to the affected node or link. Runtime and system errors use a compact header summary with raw error details collapsed behind an explicit details control to keep the graph workspace dense.
- Run polling consumes `list_run_states` while any workflow run snapshot is running, whether the run started from the list, detail workspace, or scheduler. `get_run_state` remains a legacy/latest-state fallback. The backend updates `current_step_id`, `current_step_number`, and `completed_step_ids` on the matching snapshot from runner progress callbacks so graph nodes can show active/completed/failed state without a frontend-specific execution model.
- Runs owns the cross-workflow session monitor. It lists run snapshots, shows source/status/current step/error context, calls `stopRun(runId)` for selected active runs, and can render one bounded persisted-run detail loaded from an Overview navigation target.
- Workflow detail exposes `Run from selected` only when enabled in Workflow Settings Run Policy. It is enabled only for one selected main-path node when saved settings use Reuse login session, browser retention is `retain`, and run state reports a matching retained browser session. Run Policy scope decides whether the action runs only the selected node or continues from that node through the downstream main path.
- Selected-node port guidance for required body ports, optional no-op branches, explicit Merge fan-in, Router case/default/done ports, implicit successful continuation endings, and recovery branches that preserve failure behavior when missing.
- Canvas port tooltip copy for every graph node type. Tooltip text explains input vs output direction plus branch, continuation, terminal, retry, merge, loop, and recovery semantics before users create a link. Port handles use custom canvas tooltip rendering without native `title` tooltips, delay display by 1 second, and raise the hovered React Flow node wrapper so the tooltip stays above neighboring nodes.
- Selected-node help from the graph inspector and node context menu. Configured action nodes reuse the action guide popup with collapsible parent sections, minimum setup, grouped field and option references, output guidance, workflow examples, and safety notes; graph-native nodes use port semantics before minimum setup, grouped field references, related nodes, and workflow examples with the same nested collapsible modal structure. Individual fields, options, outputs, examples, and related-node items are collapsible. Mistake guidance belongs inside field or option detail blocks, not as a standalone top-level section.
- DTO-to-React-Flow and React-Flow-to-DTO adapter state, execution-order edge labels, selected-link delay editing, edge delay metadata, and manual auto-arrange layout, while keeping persisted `WorkflowGraph` as source of truth. Long graphs use row-wrapped auto-arrange lanes, optimized non-recursive traversal helpers, React Flow visible-element rendering above the large-graph threshold, and a minimap guard so run progress and graph edits stay responsive with many nodes.
- Action node creation from the semantic action palette, including fixed Wait and Random Wait actions in the Wait group, unconfigured `New node` draft creation from the toolbar, graph-control node creation from simplified grouped node pickers including Merge and Router, visible-canvas-centered placement for toolbar-created nodes, plus searchable type selection and config editing through the reusable action config editor.
- Variable authoring UI for Set Variables, Set JSON Variables, Repeat For Each manual/array modes, and template token insertion/highlighting in supported text fields.
- Variable picker catalogs known graph variables from Set Variables rows, Set JSON Variables keys, and output-producing action nodes when available.
- Editor-only graph selection, clipboard, and history state. These drive multi-selection summaries, bulk duplicate/delete/copy/paste, undo/redo, and graph-scoped keyboard shortcuts without changing persisted `WorkflowGraph` shape or swallowing page-level clipboard shortcuts outside the active graph workspace.
- Select-first graph canvas interaction. Empty-canvas drag performs box selection; Space temporarily enables panning through separate temporary state, and the toolbar exposes persistent select/pan modes plus undo, redo, fit view, auto arrange, and shortcuts icon controls.
- Command invocation through `workflowApi.ts` and `window.workflowApi`.
- UI-only labels, summaries, grouping, and failure suggestions.
- Settings navigation state in the app shell/sidebar, plus app-level
  diagnostics refresh, CloakBrowser install/check, and orphaned inactive
  profile cleanup command state. Settings displays environment readiness from
  sanitized diagnostics and does not expose raw binary/cache/profile/font paths.
- Overview navigation state in the app shell/sidebar and Overview refresh state.
- Evidence navigation state in the app shell/sidebar, Evidence query/detail
  state, and Overview/Runs-to-Evidence handoff state.
- Identity Lab navigation state in the app shell/sidebar, managed/historical
  identity selection state, read-model refresh state, and Evidence-to-Identity
  handoff state. Identity actions call typed backend commands; the renderer
  does not derive identity posture from raw run outputs or diagnostics.
- Schedules navigation state in the app shell/sidebar, plus schedule create/edit form state and schedule event history presentation.
- Runs navigation state in the app shell/sidebar.
- Shared switch, segmented-control, and tooltip-backed icon button presentation for user-facing settings, help language controls, editor modes, and icon-only commands. Workflow detail header commands keep Settings, Validate, and Save icon-only while Run, Stop, and Run from selected remain text commands.

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
- Keep command names centralized in `workflowApi.ts`.
