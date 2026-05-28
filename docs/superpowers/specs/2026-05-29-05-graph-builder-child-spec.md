# Mission Control UI/UX Upgrade Child Spec 05: Graph Builder

Date: 2026-05-29

## Status

Approved design direction, drafted for user review.

This child spec follows the master UI/UX upgrade spec and child specs 01-04.
It owns the graph authoring workspace inside Workflow Detail.

## Brainstorming Decisions

Question: should Graph Builder prioritize visual polish, new graph features, or
operator authoring speed?

Approved answer: prioritize operator authoring speed while using the polished
Stitch graph screen for layout, density, and hierarchy. New behavior is allowed
only when it already exists in current contracts or is required to expose
existing graph capability more clearly.

Question: should the implementation rewrite the graph editor?

Approved answer: no. Keep React Flow, current graph DTOs, current command
helpers, and current backend graph semantics. The redesign should split crowded
UI into smaller components and improve authoring affordances without changing
persisted graph shape.

Question: what must be easiest to understand?

Approved answer: what is selected, what can run, what blocks run, where the
next node/link will be inserted, and how branch/continuation ports behave.

## Goal

Turn Graph Builder into a professional visual workflow authoring surface where
operators can build, validate, fix, and launch workflows without losing context.

The implementation must:

1. Preserve the visual graph builder as the only workflow authoring surface.
2. Keep the canvas primary and dense, with stable left/top command regions and
   a right inspector.
3. Make selection state explicit for node, link, multi-selection, and empty
   canvas states.
4. Improve palettes for actions, logic nodes, variables, and end nodes.
5. Make validation, runtime failure, stale issue, and save errors actionable.
6. Keep graph run state visible on nodes without overriding authoring selection.
7. Support compact desktop at `1024x768` without hiding critical actions.
8. Avoid backend semantic changes unless a narrow type/data addition is needed
   for UI correctness.

## Inputs And Sources Of Truth

Read before implementation:

- `docs/README.md`
- `docs/task-routes.md`
- `DESIGN.md`
- `docs/domain/user-visible-invariants.md`
- `docs/domain/workflow-lifecycle.md`
- `docs/domain/execution-semantics.md`
- `docs/contracts/run-state.md`
- `docs/architecture/frontend.md`
- Master UI/UX upgrade spec
- Foundation child spec

Visual reference:

- `.stitch/designs/2026-05-28-12-polished-03-graph-builder.html`
- `.stitch/designs/2026-05-28-12-polished-09-add-step-palette.html`

Primary source files:

- `src/features/workflows/pages/WorkflowDetailPage.tsx`
- `src/features/workflows/components/WorkflowGraphEditor.tsx`
- `src/features/workflows/components/WorkflowGraphToolbar.tsx`
- `src/features/workflows/components/WorkflowGraphPalettes.tsx`
- `src/features/workflows/components/WorkflowGraphInspector.tsx`
- `src/features/workflows/components/WorkflowGraphInspectorFields.tsx`
- `src/features/workflows/components/WorkflowGraphCanvasParts.tsx`
- `src/features/workflows/components/ActionConfigEditor.tsx`
- `src/features/workflows/components/RunIssuePanel.tsx`
- `src/features/workflows/components/RunStatusBar.tsx`
- `src/features/workflows/components/GraphShortcutGuide.tsx`
- `src/features/workflows/lib/graphEditorCommands.ts`
- `src/features/workflows/lib/graphLayout.ts`
- `src/features/workflows/lib/workflowGraph.ts`
- `src/lib/workflowUi.ts`
- `src/styles/workflow-graph.css`
- `src/styles/workflows.css`

Likely tests:

- `src/features/workflows/components/WorkflowGraphEditor.test.tsx`
- `src/features/workflows/components/WorkflowGraphPalettes.test.tsx`
- `src/features/workflows/pages/WorkflowDetailPage.test.tsx`
- `src/features/workflows/lib/graphEditorCommands.test.ts`
- `src/features/workflows/lib/graphLayout.test.ts`
- `src/features/workflows/lib/workflowGraph.test.ts`
- `src/AppCss.test.ts`

## Scope Boundaries

### In Scope

- Graph workspace layout.
- Toolbar hierarchy.
- Palette layout, search, groups, empty states, and keyboard focus.
- Canvas status overlays and node/link visual treatment.
- Inspector hierarchy and selected-state empty screens.
- Link wait editing experience.
- Multi-select summary and bulk action clarity.
- Run issue panel presentation and issue-to-selection routing.
- Save/autosave/validate/run status presentation.
- Compact desktop behavior.
- Component split for maintainability.

### Out Of Scope

- Replacing React Flow.
- New persisted graph schema.
- New action types.
- Backend graph compiler rewrite.
- Runner behavior changes.
- Workflow Settings internals.
- Recording Review internals.
- Batch Run UI.

## Architecture

Keep `WorkflowGraphEditor.tsx` as the orchestration component, but reduce the
amount of rendered UI it owns. It should coordinate graph state, React Flow
events, history, selection, run-state mapping, palette open state, and callbacks
from `WorkflowDetailPage`.

Recommended split:

```text
src/features/workflows/components/
  WorkflowGraphEditor.tsx
  WorkflowGraphToolbar.tsx
  WorkflowGraphCanvasParts.tsx
  WorkflowGraphPalettes.tsx
  WorkflowGraphInspector.tsx
  WorkflowGraphInspectorFields.tsx
  WorkflowGraphStatusRail.tsx
  WorkflowGraphSelectionSummary.tsx
  WorkflowGraphMiniCommandBar.tsx

src/features/workflows/lib/
  workflowGraph.ts
  graphEditorCommands.ts
  graphLayout.ts
  graphIssuePresentation.ts
```

Only add new helper files when they remove real branching complexity from the
editor. Do not move logic just to create more files.

## Layout Requirements

The graph page should render as a full workspace, not as a card-based form.

Top page header:

- Workflow name and compact metadata.
- Dirty/save/autosave state.
- Settings icon action.
- Validate icon action.
- Save icon action.
- `Launch Run` text primary action.
- `Stop` text destructive action only while the workflow has an active run.
- `Run from selected` text action only when the saved settings make it relevant.

Graph workspace:

- Top graph toolbar inside the graph region.
- Canvas takes remaining width and height.
- Inspector remains visually attached to the right side of the graph workspace.
- Run issue panel appears above or beside the graph without causing canvas jump
  during repeated validation.
- At compact desktop, inspector may become a bottom drawer or collapsible right
  panel, but selection details and blocking issues must remain reachable.

The graph page must not introduce marketing copy, hero layout, decorative
cards, or nested panels inside panels.

## Toolbar Requirements

Toolbar groups:

- History: Undo, Redo.
- Mode: Select, Pan.
- View/layout: Fit view, Auto arrange, Arrange selection.
- Add: New node, Add Action, Add Logic, Add Variable, Add End.
- Help: Shortcuts.

Icon-only controls require accessible labels and tooltip text.

Add buttons use text because they are primary authoring commands. The Add
groups must keep the existing beginner-focused grouping:

- Add Logic: Branching, Loops, Recovery/Retry.
- Add Variable: Set Variables, Set JSON Variables.
- Add End: End Success, End Failure, Stop Workflow.

Toolbar-created nodes must continue to appear near the visible canvas center,
not at a fixed graph origin. Auto arrange and arrange selection must remain in
undo history.

## Palette Requirements

Action palette:

- Search input receives focus when palette opens.
- Left category rail lists semantic action groups.
- Results show label, short intent copy, and serialized type as muted metadata
  only when useful.
- Results must distinguish safe beginner actions from advanced/direct-DOM style
  actions using existing capability/help metadata, not a new policy system.
- Empty search state suggests clearing search or browsing categories.

Graph node palette:

- Use the same visual language as Action palette.
- Explain graph-native node purpose in one short sentence.
- Keep ports/semantics guidance in help modals or inspector, not as long text in
  result rows.

Keyboard behavior:

- Escape closes palette.
- Enter chooses the focused result when focus is inside result list.
- Tab order moves search, category, results, footer/close predictably.

## Canvas Requirements

Node states must be visually distinct:

- selected;
- multi-selected;
- validation issue;
- stale issue after edit;
- running/current;
- completed;
- failed;
- unconfigured draft node;
- start/end/control/action node families.

Run state must not erase authoring state. If a selected node is also failed,
the UI must show both states through border, status strip, icon, or label.

Edges must show:

- direction;
- source and target port intent;
- selected link state;
- validation issue state;
- link wait label when configured;
- branch/continuation/loop/recovery edge type where existing helpers can infer
  it.

Canvas port tooltips must remain custom canvas tooltips with the existing one
second delay and must render above neighboring nodes.

## Inspector Requirements

Inspector states:

- No selection: show graph health summary, quick actions, and what to do next.
- Node selection: show node title, node type, status, config fields, help, and
  issue list for that node.
- Link selection: show source/target, wait mode editor, link issue list, and
  delete action.
- Multi-selection: show count by type, bulk duplicate/copy/delete actions, and
  explain protected Start behavior.

Inspector must not contain unrelated workflow settings. Browser identity,
proxy, retention, and environment defaults remain in Workflow Settings.

The action config editor remains the source for action-specific fields. Do not
duplicate action config form logic inside the inspector.

## Issues And Run Feedback

RunIssuePanel must remain compact but more directive:

- First issue shown as the main problem.
- Blocking validation issues explain why launch is blocked.
- Runtime failures show failed node, action type, and short reason.
- System/startup issues show retry/save/diagnostic direction when available.
- Long raw details stay collapsed behind explicit Details/Copy actions.
- Issue rows can select related node or link.
- After graph edits, stale issues show `Needs recheck` and clear instructions.

RunStatusBar should be folded into the page/header or status rail when possible
so status is visible without consuming too much vertical space.

## Save, Validate, And Run UX

Save:

- Manual Save should always be available.
- Autosave status must be visible and compact.
- Save failure keeps draft graph visible and offers retry.

Validate:

- Validate runs against current visible graph state where current behavior
  supports it.
- Validation results remain visible after edits and are marked stale until
  revalidated.

Launch Run:

- Launch from graph saves visible graph and dirty Workflow Settings before run.
- If graph save fails, run does not start.
- If settings save fails, run does not start.
- If validation blocks run, focus the first blocking issue.

Run from selected:

- Hide unless enabled in Workflow Settings Run Policy.
- Enable only when exactly one supported main-path node is selected and retained
  session requirements are met.
- Disabled state explains the missing requirement in tooltip or compact helper.

## CSS And Responsive Requirements

Follow `DESIGN.md`:

- dark surfaces;
- 4px/8px spacing;
- radius no larger than 8px for panels/controls;
- cyan active/focus;
- amber validation/stale;
- red failure/destructive;
- green terminal success only.

At `1024x768`:

- no horizontal page overflow;
- toolbar can wrap into compact groups;
- inspector remains reachable;
- canvas remains usable;
- command text does not overflow buttons;
- tables/lists inside inspector scroll internally.

## Tests And Checks

Required focused tests when implemented:

- Palette opens, searches, filters, selects, and handles empty state.
- Toolbar icon controls have accessible names.
- Toolbar add actions insert near visible canvas center.
- Selection transitions clear node/link state correctly.
- Link wait editing updates selected link only.
- Multi-selection protects Start node and exposes allowed bulk actions.
- Validation issues route to node/link selection.
- Runtime failure routes to failed node.
- Stale issue state appears after graph edit.
- Compact CSS invariants are covered by `AppCss.test.ts`.

Run checks:

- `npm test -- src/features/workflows/components/WorkflowGraphEditor.test.tsx`
- `npm test -- src/features/workflows/components/WorkflowGraphPalettes.test.tsx`
- `npm test -- src/features/workflows/pages/WorkflowDetailPage.test.tsx`
- `npm test -- src/features/workflows/lib/graphEditorCommands.test.ts`
- `npm test -- src/features/workflows/lib/graphLayout.test.ts`
- `npm test -- src/AppCss.test.ts`
- `npx tsc --noEmit`

## Acceptance Criteria

- Operators can understand the graph state without opening multiple dialogs.
- Add, edit, validate, save, launch, and fix flows are reachable from one
  workspace.
- Node/link/multi-selection states are unambiguous.
- Validation and runtime failures point to the affected graph object.
- Compact desktop remains usable at `1024x768`.
- No persisted graph or backend run semantics change unless explicitly covered
  by a narrow test and docs update.

