# Mission Control UI/UX Upgrade Child Spec 05: Graph Builder

Date: 2026-05-29

## Status

Approved design direction, drafted for user review.

This child spec follows:

- `docs/superpowers/specs/2026-05-28-mission-control-full-product-ui-ux-upgrade-master-spec.md`
- `docs/superpowers/specs/2026-05-28-01-foundation-ui-system-child-spec.md`
- `docs/superpowers/specs/2026-05-29-02-shell-navigation-search-alerts-child-spec.md`
- `docs/superpowers/specs/2026-05-29-03-workflow-library-package-management-child-spec.md`
- `docs/superpowers/specs/2026-05-29-04-recording-review-child-spec.md`

It redesigns the Workflow Detail graph authoring workspace. Workflow Library
owns the list, create, record, import, export, duplicate, and row-run entry
points. Recording Review owns the recording modal after a recording session
starts. This spec owns what happens after an operator opens a workflow detail
and edits the visual graph.

## Brainstorming Scope

The user asked for a deep, one-spec-at-a-time `$brainstorming` process and
pre-approved the recommended decisions. This spec therefore records the
decisions explicitly instead of stopping at each question.

The goal of this brainstorming pass is not to invent a new graph product. It is
to turn the current graph editor into a polished, reliable, implementation-ready
workspace that future coding agents can build without guessing layout,
component ownership, state handling, edge cases, or tests.

## Brainstorming Decisions

### Decision 1: Redesign Strategy

Question: should Graph Builder be rewritten, visually polished only, or
redesigned through a bounded refactor?

Options considered:

- Full rewrite of the graph editor.
  - Pros: maximum freedom to redesign every interaction.
  - Cons: high regression risk, likely breaks current React Flow behavior,
    keyboard shortcuts, layout commands, run-state mapping, and tests.
- Visual-only CSS pass.
  - Pros: fast and low risk.
  - Cons: does not fix real UX issues such as inspector emptiness, issue
    routing clarity, toolbar hierarchy, palette depth, and compact layout.
- Bounded refactor plus UI redesign.
  - Pros: preserves current graph semantics while improving the actual authoring
    experience; lets agents split the crowded editor into stable components.
  - Cons: needs more careful specification and tests.

Recommended and approved: bounded refactor plus UI redesign.

Implementation must keep React Flow, `WorkflowGraph`, current graph commands,
current graph compiler semantics, current explicit port model, and current run
state contract. The redesign may add presentational helper components and pure
UI helper functions, but it must not create a new persisted graph model.

### Decision 2: Workspace Layout

Question: should the graph workspace be canvas-first, inspector-first, or
wizard-like?

Options considered:

- Canvas-first with right inspector.
  - Pros: best for visual authoring; matches existing mental model and Stitch
    graph screen.
  - Cons: needs careful compact layout.
- Inspector-first form surface.
  - Pros: easier to implement with forms.
  - Cons: weakens the visual graph as the only authoring surface.
- Wizard-like authoring.
  - Pros: beginner friendly for simple workflows.
  - Cons: fights existing graph-native concepts such as ports, branches, link
    waits, and multi-selection.

Recommended and approved: canvas-first with stable right inspector, plus
compact fallback where inspector can stack or collapse without hiding the graph.

### Decision 3: Toolbar Philosophy

Question: should toolbar controls be minimal or expose all graph authoring
primitives?

Options considered:

- Minimal toolbar with most actions hidden in context menus.
  - Pros: visually quiet.
  - Cons: slows authoring and hides important graph affordances.
- Full toolbar with grouped controls.
  - Pros: keeps high-frequency commands discoverable.
  - Cons: can become noisy without strong grouping.
- Floating toolbar only.
  - Pros: keeps top of canvas open.
  - Cons: harder to make stable and accessible.

Recommended and approved: full grouped toolbar, compact and stable, with icon
controls for graph tools and text buttons for creation commands.

### Decision 4: Palette Depth

Question: should palettes simply list actions/nodes, or become decision-guided
selectors?

Options considered:

- Simple list.
  - Pros: current pattern, easy to implement.
  - Cons: weak for large action catalogs and beginner confusion.
- Decision-guided palette.
  - Pros: search, categories, descriptions, labels, and help reduce mistakes.
  - Cons: needs metadata discipline.
- Multi-step wizard palette.
  - Pros: can guide strongly.
  - Cons: slower for expert operators.

Recommended and approved: decision-guided palette with search, categories,
short intent copy, empty state, and optional help link. Do not make it a wizard.

### Decision 5: Inspector Role

Question: should the inspector be only a form editor or the full selected-object
workspace?

Options considered:

- Form editor only.
  - Pros: simple.
  - Cons: misses link editing, selection summaries, health, issue context, and
    run failure context.
- Full selected-object workspace.
  - Pros: one place for selected node, selected link, multi-selection, issue
    details, and run context.
  - Cons: requires better component split.
- Separate drawers for issues/config/history.
  - Pros: specialized.
  - Cons: adds navigation overhead.

Recommended and approved: inspector is the selected-object workspace.

### Decision 6: Issue And Run Feedback

Question: should validation and runtime failures live in a global panel, node
decorations, or inspector?

Options considered:

- Global panel only.
  - Pros: all issues visible together.
  - Cons: weak graph context.
- Node/link decorations only.
  - Pros: visual context.
  - Cons: not enough detail and not accessible.
- Combined global issue panel plus canvas highlighting plus inspector details.
  - Pros: gives scan, location, and details.
  - Cons: requires consistent state mapping.

Recommended and approved: combined approach. `RunIssuePanel` summarizes and
routes; canvas marks affected node/link; inspector explains selected issue.

### Decision 7: Responsive Strategy

Question: should compact desktop remove panels or reflow them?

Options considered:

- Hide inspector on compact desktop.
  - Pros: simple.
  - Cons: unacceptable because config and issue details disappear.
- Reflow inspector below canvas.
  - Pros: preserves all content.
  - Cons: makes page taller.
- Collapsible inspector/drawer.
  - Pros: efficient when implemented well.
  - Cons: more state and accessibility work.

Recommended and approved: use reflow as the baseline because it is lower risk.
If the implementation already has a robust drawer pattern from Foundation, a
drawer is acceptable. The spec requires reachability, not a specific animation.

### Decision 8: Component Split

Question: should implementation split every small UI piece or keep one large
editor?

Options considered:

- Keep one large `WorkflowGraphEditor`.
  - Pros: fewer files.
  - Cons: harder for agents to safely modify.
- Split every visual fragment.
  - Pros: many small files.
  - Cons: can create noisy abstractions.
- Split by responsibility.
  - Pros: stable ownership, easier tests, less coupling.
  - Cons: requires discipline.

Recommended and approved: split by responsibility only.

## Goal

Turn Graph Builder into a professional visual workflow authoring workspace for
authorized browser automation. Operators should be able to scan graph health,
add nodes, connect ports, configure nodes, edit links, validate, fix issues,
save, and launch without losing context.

The implementation must:

1. Preserve visual graph editing as the only workflow authoring surface.
2. Preserve current graph runtime semantics and current persisted graph shape.
3. Make the canvas the primary workspace.
4. Make toolbar actions discoverable, grouped, and accessible.
5. Make palettes searchable and decision-guided.
6. Make selected node, selected link, multi-selection, and empty selection
   states explicit.
7. Make validation, runtime failure, stale issue, and save failure states
   actionable.
8. Keep run progress visible on the graph without hiding authoring selection.
9. Keep Workflow Settings and Browser Launch concerns out of graph nodes.
10. Work at `1024x768` compact desktop without critical overflow.

## Inputs And Sources Of Truth

### Required Reading Before Implementation

Follow repo workflow first:

1. `docs/README.md`
2. `docs/task-routes.md`
3. `DESIGN.md`
4. `docs/domain/user-visible-invariants.md`
5. `docs/domain/workflow-lifecycle.md`
6. `docs/domain/execution-semantics.md`
7. `docs/contracts/run-state.md`
8. `docs/contracts/workflow-types.md`
9. `docs/architecture/frontend.md`
10. Foundation child spec.
11. Shell/navigation child spec.
12. Workflow Library child spec.
13. Recording Review child spec.
14. This spec.

### Visual Baseline

Use these Stitch artifacts as visual references:

- `.stitch/designs/2026-05-28-12-polished-03-graph-builder.html`
- `.stitch/designs/2026-05-28-12-polished-09-add-step-palette.html`
- `.stitch/designs/2026-05-28-12-polished-12-workflow-settings-dialog.html`
  only for dialog density and grouped settings language; do not move Workflow
  Settings fields into the graph.

The Stitch screens are visual references, not contract truth. If a Stitch
screen implies unsupported behavior, preserve current code/docs unless this spec
explicitly requires a narrow supporting change.

### Current Source Areas

Primary files likely touched:

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
- `src/features/workflows/components/TemplateTextField.tsx`
- `src/features/workflows/components/VariableConfigFields.tsx`
- `src/features/workflows/lib/workflowGraph.ts`
- `src/features/workflows/lib/graphEditorCommands.ts`
- `src/features/workflows/lib/graphLayout.ts`
- `src/features/workflows/lib/workflowActionDefaults.ts`
- `src/features/workflows/lib/graphNodeHelpContent.ts`
- `src/features/workflows/lib/stepHelpContent.ts`
- `src/lib/workflowUi.ts`
- `src/types/workflow.ts`
- `src/styles/workflow-graph.css`
- `src/styles/workflows.css`
- `src/styles/modals.css`
- `src/styles/responsive.css`

Tests likely touched:

- `src/features/workflows/components/WorkflowGraphEditor.test.tsx`
- `src/features/workflows/components/WorkflowGraphPalettes.test.tsx`
- `src/features/workflows/components/ActionConfigEditor.test.tsx`
- `src/features/workflows/pages/WorkflowDetailPage.test.tsx`
- `src/features/workflows/lib/graphEditorCommands.test.ts`
- `src/features/workflows/lib/graphLayout.test.ts`
- `src/features/workflows/lib/workflowGraph.test.ts`
- `src/features/workflows/lib/workflowActionDefaults.test.ts`
- `src/AppCss.test.ts`

Add tests only where the current suite does not cover the new behavior.

## Current Implementation Readout

This section documents what the current code already does so implementers do
not duplicate or undo existing work.

### Workflow Detail Page

Current `WorkflowDetailPage.tsx` already owns:

- compact page header;
- Back to Workflows navigation;
- workflow name;
- graph save status metadata;
- settings icon;
- validate icon;
- save icon;
- `Run from selected`;
- `Record Replacement`;
- `Launch Run`;
- `Stop`;
- `RunIssuePanel`;
- `WorkflowGraphEditor`;
- launch confirmation dialog.

Current problem:

- The page has the right building blocks, but the information hierarchy is not
  yet strong enough. Status, blocking issues, launch preflight, graph health,
  and selected object context still feel like separate UI fragments rather than
  one graph workspace.

### Workflow Graph Editor

Current `WorkflowGraphEditor.tsx` already owns:

- React Flow conversion;
- local graph history;
- undo/redo;
- selected node and edge state;
- multi-selection;
- port connection behavior;
- palette open state;
- context menu state;
- auto arrange and arrange selection;
- shortcut handling;
- run-state mapping to graph nodes;
- validation issue mapping;
- visible-canvas-centered node insertion;
- React Flow performance guard for large graphs;
- minimap guard.

Current problem:

- It is doing orchestration and much of the UI state in one component. That is
  acceptable as a coordinator, but not as a place to keep growing presentational
  details. The spec should guide a split into smaller responsibility-based
  modules.

### Toolbar

Current `WorkflowGraphToolbar.tsx` already includes:

- Undo;
- Redo;
- Select mode;
- Pan mode;
- Fit view;
- Auto arrange;
- Arrange selection;
- New node;
- Add Action;
- Add Logic;
- Add Variable;
- Add End;
- Shortcuts.

Current problem:

- The toolbar is functionally correct, but it needs stronger grouping,
  affordance, disabled reason treatment, compact behavior, and consistency with
  Foundation icon/text button rules.

### Palettes

Current `WorkflowGraphPalettes.tsx` already includes:

- Graph node palette;
- Action node palette;
- categories;
- search;
- node descriptions;
- node context menu;
- link context menu;
- graph node help dialog.

Current problem:

- It needs richer empty states, focus handling, result metadata, beginner/expert
  scanning, and consistent help affordances. It should not become a wizard.

### Inspector

Current `WorkflowGraphInspector.tsx` already includes:

- multi-selection summary;
- selected link section;
- selected node header;
- connection summary;
- port guidance;
- selected node issues;
- selected runtime failure card;
- node config fields;
- focus action;
- delete action;
- link wait fields.

Current problem:

- Empty selection is too thin.
- Link selection lacks enough context and issue guidance.
- Multi-selection lacks enough protected/actionable detail.
- Selected node header needs graph health, status, and issue hierarchy.
- Inspector needs clearer boundaries between graph-native config, action config,
  issues, and run details.

### Canvas Parts

Current `WorkflowGraphCanvasParts.tsx` already includes:

- graph nodes;
- graph edges;
- custom graph ports;
- port tooltip metadata;
- run/issue visual classes;
- edge labels and directions.

Current problem:

- Canvas states should be documented and tested as a matrix. Selection, run
  state, validation issue, stale issue, failed runtime state, unconfigured node,
  and graph-native node type can overlap.

## Scope Boundaries

### In Scope

- Graph Builder layout.
- Workflow detail graph command region.
- Graph toolbar grouping and responsive behavior.
- Add Action, Add Logic, Add Variable, Add End palettes.
- Canvas node/edge state treatment.
- Port tooltip treatment.
- Node selection inspector.
- Link selection inspector.
- Multi-selection inspector.
- Empty selection/graph health inspector.
- Validation issue presentation and issue routing.
- Runtime failure presentation and failed-node routing.
- Stale issue state after graph edits.
- Save/autosave state presentation as it affects graph authoring.
- Shortcuts dialog entry point.
- Component and helper split required to make the graph workspace maintainable.
- Focused tests and CSS tests for changed behavior.

### Out Of Scope

- New backend graph compiler semantics.
- New persisted graph schema.
- Replacing React Flow.
- New action types.
- Batch Run UI.
- Workflow Settings internals.
- Browser Launch identity controls.
- Recording Review internals.
- Workflow Library import/export/delete/duplicate behavior.
- Unbounded run history or evidence browsing.
- Raw run output viewer.

## Non-Negotiable Invariants

Preserve these:

- Opening a workflow shows the visual graph builder as the only workflow
  authoring surface.
- New workflows have `Start -> New node`.
- Invalid graph drafts may be saved, but blocking validation/compile/run issues
  prevent execution.
- Start-only graph can be saved as draft but cannot run.
- Unconfigured action nodes can be saved as draft but block validation/compile/run.
- Graph edges connect through explicit ports.
- Each normal output port has at most one outgoing edge.
- Each normal input port has at most one incoming edge.
- Merge `in` accepts multiple incoming branch inputs.
- Reconnecting a non-Merge input replaces the previous link in the editor.
- Graph control blocks keep branch work separate from continuation work.
- Missing optional graph branches are no-ops.
- Missing continuation ports end the current path successfully.
- Missing required body ports block validation/run.
- Link waits are duration-only edge transition delays.
- New graph edges copy the saved Graph link wait at creation time.
- Changing Graph link wait default does not rewrite existing links.
- Browser identity belongs in Workflow Settings Browser Launch, not graph nodes.
- Running from graph saves visible graph first.
- Running from graph saves dirty Workflow Settings first.
- If graph save fails, run does not start.
- If settings save fails, run does not start.
- Run from selected requires settings enablement, persistent session reuse,
  browser retention `retain`, one supported selected main-path node, and matching
  retained session.
- Run from selected does not silently launch a new browser.
- Graph autosave is app-level.

## Information Architecture

The Graph Builder workspace has five visible information zones:

1. Page command header.
2. Run/validation issue panel.
3. Graph toolbar.
4. Canvas.
5. Inspector.

Each zone has one job:

- Header answers: what workflow is this, what state is it in, and what are the
  top-level commands?
- Issue panel answers: what currently blocks or failed, and where should I look?
- Toolbar answers: what graph editing operation can I do next?
- Canvas answers: what is the workflow shape and execution path?
- Inspector answers: what is selected and how can I configure/fix it?

Do not duplicate full details across zones. Instead:

- summarize in header/issue panel;
- mark location on canvas;
- show details in inspector.

## Page Header Requirements

### Header Content

The header must show:

- eyebrow: `Workflow Detail` or equivalent compact context;
- workflow name;
- graph save/autosave state;
- run status summary;
- Settings icon action;
- Validate icon action;
- Save icon action;
- `Run from selected` when relevant;
- `Record Replacement`;
- `Launch Run`;
- `Stop` only while a run is active.

### Header Hierarchy

Recommended hierarchy:

1. Workflow name and save/run status.
2. Primary run command.
3. Secondary graph commands.
4. Replacement recording.

Settings, Validate, and Save should remain icon actions with labels/tooltips.
Launch, Stop, Run from selected, and Record Replacement should remain text
actions because they are consequential.

### Header State Details

Graph save state:

- show clean/saved state quietly;
- show saving/pending state with neutral or cyan active treatment;
- show failed save with red/attention treatment and accessible text;
- do not hide failed save behind icon-only status.

Run status:

- idle/ready should not dominate the header;
- running should be visible and stable;
- success should use green only for terminal success;
- failed should use red and link to issue context;
- stopped should be neutral or amber depending on existing helper semantics.

### Launch Confirmation

The current launch confirmation dialog can remain, but it should be treated as a
light confirmation/preflight summary, not a wizard.

It should show:

- workflow name;
- graph save state;
- browser identity label if available;
- session/retention label if available;
- note that current graph and dirty settings will be saved first;
- warning if validation issues are already known.

It should not show:

- raw settings JSON;
- proxy credentials;
- profile paths;
- raw run outputs.

## Run Issue Panel Requirements

The issue panel should be dense and directive.

### Issue Types

Support at least:

- blocking validation issue;
- stale validation issue after edit;
- runtime failure;
- system/startup/save issue;
- overflow/truncated issue list.

### First-Issue Treatment

The first issue should have:

- severity badge;
- short title;
- one-sentence summary;
- primary fix action where possible;
- secondary actions where useful.

Examples:

- Validation issue: `Validate again`, `Select node`, `Select link`.
- Runtime failure: `Run again`, `Select failed node`, `Details`, `Copy details`.
- Save/system issue: `Save again`, `Details`, `Copy details`.

### Issue List Treatment

Additional issue rows should show:

- affected object type;
- affected label/id;
- short message;
- up to three suggestions;
- select/focus action.

Long details must be collapsed by default.

### Stale Issue Treatment

After graph edits, existing issue results remain visible but marked stale:

- show `Needs recheck`;
- explain that graph changed after the issue was produced;
- keep select-node/link actions;
- recommend Validate again.

Do not automatically clear all context on edit. Losing context makes fixing
large graphs harder.

## Graph Toolbar Requirements

### Toolbar Groups

Render toolbar as compact grouped controls:

- History: Undo, Redo.
- Mode: Select, Pan.
- View/Layout: Fit view, Auto arrange, Arrange selection.
- Add: New node, Add Action, Add Logic, Add Variable, Add End.
- Help: Shortcuts.

Use visual separators or spacing between groups. Do not use nested cards.

### Control Treatment

Icon controls:

- Undo;
- Redo;
- Select;
- Pan;
- Fit view;
- Auto arrange;
- Arrange selection;
- Shortcuts.

Text controls:

- New node;
- Add Action;
- Add Logic;
- Add Variable;
- Add End.

Disabled controls:

- must remain focusable only if the local component pattern supports accessible
  disabled explanations;
- otherwise provide tooltip/title/helper copy nearby.

Arrange selection disabled reason:

- no multi-node selection;
- current arrange operation running;
- selected nodes cannot be arranged if only Start is selected.

### Add Command Behavior

New node:

- creates unconfigured action node;
- places it near visible canvas center;
- selects it;
- inspector shows action type selection and config guidance.

Add Action:

- opens action palette.

Add Logic:

- opens graph node palette with Branching, Loops, Recovery.

Add Variable:

- opens graph node palette with Set Variables and Set JSON Variables.

Add End:

- opens graph node palette with End Success, End Failure, Stop Workflow.

Toolbar-created nodes must continue using visible canvas center placement with
staggering so repeated adds remain reachable.

## Palette Requirements

### Shared Palette Shell

Action and graph node palettes should share:

- dialog shell;
- header with eyebrow/title/description;
- search input;
- left category rail;
- result list/grid;
- empty state;
- footer/help affordance if useful.

Search input receives focus when opened.

### Search Behavior

Search should match:

- user-facing label;
- short description;
- serialized action type/node type when useful;
- common synonyms if existing metadata supports them.

Changing category clears search only if current pattern already does so and the
behavior is tested. Otherwise preserve query and filter within category.

### Category Behavior

Action palette categories use current `actionGroups` from `workflowUi.ts`.
Graph node palette categories use:

- Branching;
- Loops;
- Recovery;
- Variables;
- End.

Add Logic should stay beginner-focused:

- Branching includes If, Switch, Router, Merge.
- Loops includes Repeat Times, Repeat For Each, While, Repeat Until, Break Loop,
  Continue Loop.
- Recovery includes Retry. If Try/Catch and Fallback are supported in the graph
  contract and helper content, include them where current product docs allow.

### Result Row Requirements

Each result should show:

- primary label;
- one-line intent description;
- optional serialized type as muted metadata only when helpful;
- optional capability/advanced marker if existing metadata supports it.

Do not invent a broad risk taxonomy in this spec. If an action is advanced
because it uses direct JavaScript or network/session behavior, use existing help
or capability metadata to explain it.

### Empty State

Empty state should say:

- no matching action/node;
- clear search or choose another category;
- avoid long instructional text.

### Keyboard And Focus

Required:

- Escape closes palette through dialog primitive.
- Tab order: close/header controls, search, categories, results.
- Arrow-key result navigation is optional unless current component patterns
  support it cleanly.
- Enter on focused result selects it.

## Canvas Requirements

### Canvas Role

Canvas is the visual source of workflow shape. It should not become a static
preview framed inside another card.

The canvas should show:

- graph nodes;
- explicit ports;
- directed edges;
- edge order labels;
- branch/continuation/loop/recovery edge treatment;
- link wait labels;
- validation issue state;
- run state;
- selected state;
- multi-selected state;
- connection affordance.

### Node State Matrix

Node visuals must support overlapping states:

| State | Meaning | Required Treatment |
| --- | --- | --- |
| Idle | no current issue/run emphasis | normal node surface |
| Selected | one selected node | cyan focus/selection treatment |
| Multi-selected | included in box/multi selection | selected treatment plus group context |
| Unconfigured | action node has no action config | draft/attention marker |
| Validation issue | issue attached to node | amber marker; still selectable |
| Stale issue | issue exists after graph edit | amber marker plus stale label in inspector/panel |
| Running/current | run is at this node | cyan active marker |
| Completed | run completed this node | green completion marker |
| Failed | last run failed at this node | red failure marker |
| Start | protected start node | distinct protected system node treatment |
| End | terminal node | terminal shape/label treatment |
| Graph-native | branch/loop/retry/merge/router | graph-control family treatment |

If states overlap, priority should be:

1. selected or multi-selected;
2. failed runtime;
3. running current;
4. validation issue;
5. completed;
6. unconfigured;
7. family/default.

Priority affects emphasis, not data loss. A selected failed node should show
both selected and failed state.

### Edge State Matrix

Edge visuals must support:

| State | Meaning | Required Treatment |
| --- | --- | --- |
| Idle | normal transition | default stroke |
| Selected | selected link | cyan selected stroke |
| Validation issue | issue attached to link | amber marker/stroke |
| Stale issue | issue after graph edit | amber plus stale detail in inspector |
| Running | active transition if inferable | cyan active treatment |
| Completed | completed transition if inferable | green treatment |
| Failed | failure relates to transition if inferable | red treatment |
| Branch | branch path | distinguish from main edge |
| Continuation | post-branch continuation | distinguish from branch |
| Loop | loop body/return path | distinguish from main edge |
| Recovery | retry/error/fallback path | distinguish from main edge |
| Has wait | edge delay configured | compact delay label |

If selected and issue overlap, issue color should remain visible and selected
state should be visible through width, glow, label, or adjacent affordance.

### Port Requirements

Every visible port:

- has accessible label;
- indicates input vs output direction;
- supports current connection drag behavior;
- exposes custom tooltip text after one second hover;
- does not use native `title` tooltip;
- renders tooltip above neighboring nodes.

Tooltip text should explain:

- port label;
- whether it receives previous flow or starts next flow;
- branch/continuation/recovery meaning where relevant;
- no-op/end behavior for optional missing links where relevant.

### Canvas Interaction

Preserve:

- select-first canvas interaction;
- empty-canvas drag for box selection;
- spacebar temporary pan;
- toolbar persistent select/pan mode;
- node dragging by body;
- edge click selection;
- context menus for node/link actions;
- copy/paste/duplicate/delete shortcuts scoped to graph workspace;
- shortcut ignore behavior for inputs, textareas, selects, dialogs, and
  action-type popovers.

### Large Graph Performance

Preserve:

- visible element rendering guard;
- minimap guard for large graphs;
- non-recursive traversal helpers where present;
- deterministic row-wrapped auto arrange for long main paths.

Do not add decorative canvas effects that risk performance.

## Inspector Requirements

The inspector is the selected-object workspace. It should never be a blank
sidebar that only says "Select a graph node" unless the graph truly has no
meaningful health/context.

### Inspector State: No Selection

Show graph health summary:

- total nodes;
- total links;
- unconfigured action nodes;
- validation issue count;
- stale issue state;
- last run status if available;
- save/autosave state if not already clear in header.

Show next actions:

- Add Action;
- Add Logic;
- Validate;
- Fit view;
- Auto arrange.

Do not duplicate all toolbar buttons. Pick the most helpful next actions.

### Inspector State: Selected Node

Header:

- node label;
- node type/family;
- status badges: selected, issue, running, completed, failed, draft;
- help action.

Sections:

- Connection summary;
- Port guidance;
- Issues for selected node;
- Runtime failure details if selected node failed;
- Node configuration fields;
- Variable/template helper fields through existing components;
- Node actions.

Node actions:

- Focus;
- Open help;
- Duplicate node if current command supports it;
- Copy node if current command supports it;
- Delete node unless Start.

Do not show delete as enabled for Start. If Start is selected, explain it is
protected.

### Inspector State: Selected Link

Header:

- source node label;
- source port;
- target node label;
- target port;
- edge kind: main, branch, continuation, loop, recovery;
- issue/stale badges if relevant.

Sections:

- Link wait editor;
- link issue list;
- connection explanation;
- delete link action.

Link wait editor:

- mode: none, fixed, random;
- fixed: duration ms;
- random: min ms, max ms;
- validate non-negative durations;
- validate random max >= min;
- explain link waits are duration-only transition delays before target node.

Do not imply link waits wait for page state. Explicit Wait and Random Wait
actions remain the user-visible page/pause actions.

### Inspector State: Multi-Selection

Show:

- selected node count;
- selected link count;
- protected Start count if selected;
- internal link count if useful;
- unavailable actions and reason.

Actions:

- duplicate selected copyable nodes;
- copy selected copyable nodes;
- delete selected deletable nodes/links;
- arrange selection when available;
- clear selection if implemented.

Rules:

- Start is never deleted, copied, pasted, or duplicated.
- Bulk duplicate/copy includes selected non-start nodes and internal links only.
- Bulk delete removes selected links and selected non-start nodes.
- If selection contains only Start, destructive/copy actions are disabled with a
  readable reason.

## Node Configuration Requirements

The inspector should keep using existing shared field components:

- `NodeConfigFields`;
- `ActionConfigEditor`;
- `TemplateTextField`;
- `VariableConfigFields`;
- action-specific field modules.

Do not duplicate action config field logic in the inspector.

### Action Nodes

Unconfigured action node:

- show action type selector/search;
- explain it can be saved as draft but blocks validation/run;
- recommend Add Action palette or action type dropdown.

Configured action node:

- show action label and serialized type where useful;
- show grouped fields through current action config editor;
- show help action;
- preserve current field defaults and validation.

Targetable action defaults:

- target locator type should default to XPath where existing invariant requires
  it.

### Graph-Native Nodes

Graph-native nodes include:

- If;
- Switch;
- Router;
- Merge;
- Repeat Times;
- Repeat For Each;
- While;
- Repeat Until;
- Retry;
- Try/Catch;
- Fallback;
- Break Loop;
- Continue Loop;
- Stop Workflow;
- Set Variables;
- Set JSON Variables;
- Transform Variable;
- Assert Output;
- Domain Allowlist;
- End Success;
- End Failure.

For each supported graph-native node, inspector should show:

- purpose;
- required fields;
- optional fields;
- port semantics;
- validation issues;
- related help.

Do not add UI for graph node types that are not supported by current
`GraphNodeType`.

## Help Requirements

Graph Builder has three help surfaces:

1. Shortcuts dialog from toolbar.
2. Node help from inspector/context menu.
3. Port tooltip.

### Shortcuts Dialog

Use shared `GraphShortcutGuide`.

It should cover:

- select;
- pan;
- box select;
- connect ports;
- node drag;
- edge select;
- copy;
- paste;
- duplicate;
- delete;
- undo;
- redo;
- fit view;
- save/validate/run shortcuts only if implemented.

### Node Help

Configured action nodes should reuse the action guide popup with collapsible
sections.

Graph-native nodes should show:

- purpose;
- when to use;
- minimum setup;
- port semantics;
- field reference;
- examples;
- related nodes;
- safety notes where relevant.

Individual fields, options, outputs, examples, and related-node items should be
collapsible, matching existing help patterns.

### Port Tooltip

Tooltip text should remain compact. Do not replace it with a modal or a large
hover card.

## Save, Validate, And Run Requirements

### Save

Manual Save:

- always available in header;
- retries failed save;
- does not clear graph draft on failure.

Autosave:

- respects app-level graph autosave setting;
- enabled by default;
- failures keep visible draft graph;
- failed autosave is visible and recoverable.

### Validate

Validate:

- validates the current graph state through current command path;
- returns node/link issues;
- does not persist graph unless current app orchestration already saves first;
- updates issue panel and canvas markers.

After edit:

- previous validation issues remain visible;
- mark as stale/needs recheck;
- next Validate clears or refreshes stale state.

### Launch Run

Launch Run:

- opens current confirmation/preflight dialog if retained;
- on confirm, graph workspace save pipeline runs;
- dirty Workflow Settings save pipeline runs;
- validation/run command pipeline runs;
- if save fails, run does not start;
- if settings save fails, run does not start;
- if validation blocks run, issue panel focuses first blocking issue;
- while running, duplicate launch clicks are blocked.

### Stop

Stop:

- appears while running;
- calls scoped stop callback from parent state;
- should name or imply the active workflow/run scope;
- does not clear graph context before backend reports terminal/stopped state.

### Run From Selected

Run from selected:

- hidden unless enabled by Workflow Settings Run Policy;
- visible but disabled if prerequisites are missing;
- disabled reason should be available through tooltip/title or helper copy;
- enabled only for one supported selected main-path node;
- Merge is not a supported selected start;
- saves graph/settings before invoking run-from-selected;
- never silently launches a fresh browser if retained session is stale.

## Context Menus

Node context menu:

- Duplicate;
- Copy;
- Help;
- Delete.

Rules:

- Start cannot be deleted.
- Context menu must close after action or when focus leaves.
- Keyboard accessibility should be improved if current menu is mouse-only.

Link context menu:

- Delete;
- optionally Edit link wait if a direct focus action is easy.

Context menus should not hide primary functions that are otherwise unavailable.
They are shortcuts, not the only path to critical actions.

## Layout And CSS Requirements

Follow `DESIGN.md`:

- dark operations theme;
- no marketing hero layout;
- no decorative cards inside cards;
- no gradient/orb decoration;
- 4px and 8px spacing rhythm;
- radius no larger than 8px for panels/controls;
- dialogs up to 12px radius;
- cyan for active/focus/selection;
- amber for validation/stale;
- red for failure/destructive;
- green only for success;
- no color-only state communication.

### Desktop Layout

Default desktop:

- header at top;
- issue panel below header only when issues exist;
- graph editor fills main workspace;
- toolbar above canvas;
- canvas and inspector side by side;
- inspector width around 300-360px, adjustable only if implementation already
  supports resizing.

Canvas height:

- should use viewport-aware clamp;
- should not require scrolling just to see the first graph row on normal
  desktop.

### Compact Desktop

At `1024x768`:

- no horizontal page overflow;
- toolbar wraps by group;
- icon buttons remain square and readable;
- text buttons wrap or shorten only where label remains clear;
- inspector stacks below canvas or becomes reachable drawer;
- issue panel remains visible but compact;
- launch confirmation fits viewport;
- palettes fit viewport with internal scroll;
- context menus stay inside viewport where practical.

### Text And Overflow

Long values must not break layout:

- workflow names;
- node labels;
- action labels;
- identity labels in launch summary;
- run errors;
- node ids;
- edge ids;
- variable names;
- locator strings.

Use truncation, wrapping, or collapsed details depending on context.

## Component Architecture

### Recommended Ownership

Keep `WorkflowGraphEditor` as coordinator.

It owns:

- graph conversion state;
- React Flow instance;
- selection state;
- history state;
- clipboard state;
- palette open/close state;
- context menu state;
- layout command orchestration;
- shortcut event binding;
- calls to `onChange`, `onSaveGraph`, `onValidateGraph`, `onRunGraph`.

Move or keep presentational parts based on complexity.

Recommended modules:

```text
src/features/workflows/components/
  WorkflowGraphEditor.tsx
  WorkflowGraphToolbar.tsx
  WorkflowGraphCanvasParts.tsx
  WorkflowGraphPalettes.tsx
  WorkflowGraphInspector.tsx
  WorkflowGraphInspectorFields.tsx
  WorkflowGraphSelectionSummary.tsx
  WorkflowGraphHealthPanel.tsx
  WorkflowGraphLinkInspector.tsx
  WorkflowGraphNodeInspector.tsx
  WorkflowGraphEmptyInspector.tsx

src/features/workflows/lib/
  workflowGraph.ts
  graphEditorCommands.ts
  graphLayout.ts
  graphIssuePresentation.ts
  graphSelectionPresentation.ts
```

Do not add every file blindly. Split only when the component is large enough
that the boundary improves readability and testing.

### Suggested Helper Functions

`graphIssuePresentation.ts` may own:

- group issues by node;
- group issues by edge;
- graph health summary;
- first fix target;
- stale issue label;
- issue count labels.

`graphSelectionPresentation.ts` may own:

- selection summary;
- copyable/deletable counts;
- protected Start explanation;
- multi-selection action enablement.

Keep pure helpers in `lib/` with tests. Keep rendering in components.

## Data Flow

### Graph Editing

1. Parent passes saved/visible `WorkflowGraph` into `WorkflowGraphEditor`.
2. Editor converts graph to React Flow nodes/edges.
3. User edits graph.
4. Editor updates local graph/history.
5. Editor calls `onChange(nextGraph)`.
6. Parent owns autosave/manual save orchestration.

The editor must not call Electron commands directly.

### Validation

1. User clicks Validate.
2. Parent invokes validation command.
3. Parent passes `GraphValidationIssue[]` back into editor and issue panel.
4. Editor maps issues to nodes/edges.
5. Canvas marks affected objects.
6. Inspector shows details for selected affected object.

### Run State

1. Parent polls run state through app orchestration.
2. Parent passes `RunState`.
3. `workflowGraph.ts` maps run status to React Flow node/edge data.
4. Canvas shows current/completed/failed states.
5. Inspector shows runtime failure only when selected node matches failure.
6. Issue panel shows run failure summary.

### Selection Request

1. Issue panel requests node or edge selection.
2. `WorkflowDetailPage` creates `GraphSelectionRequest`.
3. `WorkflowGraphEditor` applies request.
4. Canvas and inspector update.

Do not create a separate global event bus.

## State Matrix

### Page-Level States

| State | UI Response |
| --- | --- |
| graph loading | preserve page header, show stable graph loading region |
| graph loaded | render graph editor |
| graph missing/error | show readable error and safe back action |
| autosave disabled | manual Save remains prominent |
| autosave saving | compact active status |
| autosave failed | error status plus Save retry |
| validation clean | quiet success or no issue panel |
| validation blocked | issue panel + canvas markers |
| validation stale | stale marker + Validate again |
| run idle | Launch Run available |
| run launching | Launch disabled/pending |
| run running | Stop available, active graph state |
| run failed | failed node marker + issue panel |
| run stopped | stopped state visible |

### Inspector States

| Selection | Inspector Content |
| --- | --- |
| none | graph health and next actions |
| one node | node detail, config, issues, run detail |
| one link | link wait, source/target, issues |
| multiple nodes | multi-selection summary and bulk actions |
| multiple links | multi-selection summary and bulk actions |
| mixed nodes/links | combined summary and safe bulk actions |
| Start only | protected Start explanation |
| stale selected object | unavailable/stale selection fallback if object disappeared |

## Error Handling

### Save Errors

Save errors should:

- appear near graph status/header;
- optionally appear in issue panel as system issue;
- not clear draft graph;
- provide Save again action.

### Validation Errors

Validation command errors are different from validation issues.

- Command error: system problem, show command-facing message.
- Validation issue: graph problem, attach to node/link/graph.

Do not render backend stack traces.

### Runtime Errors

Runtime errors should:

- summarize failed step;
- show action type and step number where available;
- route to node if `step_id` maps to graph node;
- keep long details collapsed;
- allow copy details when useful.

### Selection Errors

If an issue references a node/link no longer present:

- show stale/unavailable target state in issue row;
- allow Validate again;
- do not crash inspector.

## Security And Sensitive Data Boundaries

Graph Builder must not expose:

- cookies;
- tokens;
- proxy passwords;
- proxy URL credentials;
- browser storage;
- raw profile contents;
- arbitrary local paths;
- unbounded raw run outputs.

Allowed technical values:

- workflow name;
- graph node labels;
- graph node ids when needed for debugging;
- graph edge ids when needed for stale/diagnostic state;
- action type labels/serialized action types;
- bounded command-facing error details;
- locator strings because graph action config already exposes operator-authored
  locators.

If a runtime error includes sensitive content, rely on backend sanitization and
keep raw details collapsed. Do not add new raw-output rendering.

## Accessibility Requirements

Required:

- Page has a clear heading.
- Graph editor region has accessible label.
- Toolbar uses `role="toolbar"` and named controls.
- Icon buttons have accessible labels and tooltip text.
- Palettes are dialogs with accessible names.
- Palette search inputs have labels.
- Result buttons have readable names.
- Canvas node buttons have accessible labels.
- Ports have accessible labels.
- Inspector has `aria-label`.
- Issue panel uses alert/status treatment for errors where appropriate.
- Dialogs trap focus through shared dialog primitive.
- Destructive buttons name the action scope where practical.

Keyboard expectations:

- Tab reaches toolbar controls.
- Tab reaches inspector fields.
- Escape closes dialogs/palettes through dialog primitive.
- Delete/backspace shortcuts do not fire while typing in inputs.
- Copy/paste shortcuts do not override normal input behavior.
- Space temporary pan does not interfere with button activation or text inputs.

## Implementation Sequence

Implement in this order to reduce risk:

1. Add pure presentation helpers for graph health, issue grouping, and
   selection summary if needed.
2. Improve inspector states without changing graph DTO.
3. Improve toolbar grouping and disabled reason presentation.
4. Improve palettes: focus, result metadata, empty state, responsive layout.
5. Improve canvas state styling and edge/node overlap rules.
6. Improve issue panel routing and stale issue details if missing.
7. Harden responsive CSS.
8. Add/adjust tests.
9. Run focused checks.
10. Update docs only if behavior/contracts changed.

Do not start by changing graph compiler or Electron commands.

## Test Plan

### Unit Helper Tests

Add or update tests for pure helpers:

- graph health summary counts nodes/edges/unconfigured/issues;
- stale issue labels;
- selected node/link issue lookup;
- multi-selection copyable/deletable counts;
- Start protection;
- link wait validation labels;
- disabled reason strings.

Likely files:

- `src/features/workflows/lib/workflowGraph.test.ts`
- `src/features/workflows/lib/graphEditorCommands.test.ts`
- new `src/features/workflows/lib/graphIssuePresentation.test.ts`
- new `src/features/workflows/lib/graphSelectionPresentation.test.ts`

### Component Tests

Graph editor:

- renders toolbar groups and accessible labels;
- New node inserts near visible canvas center;
- Add Action opens palette;
- Add Logic opens grouped palette;
- Add Variable opens grouped palette;
- Add End opens grouped palette;
- palette search filters and empty state appears;
- selected node shows node inspector;
- selected link shows link inspector;
- no selection shows graph health;
- multi-selection shows selection summary;
- Start selection disables delete;
- link wait edits selected link only;
- issue panel selection request selects node/link;
- runtime failed node can be selected from issue panel;
- stale issues show `Needs recheck`.

Workflow detail:

- Save icon calls save;
- Validate icon calls validate;
- Launch Run opens confirmation;
- confirm launch calls run;
- Launch disabled while running;
- Stop visible while running;
- Run from selected hidden/visible/disabled/enabled according to props.

CSS:

- no fixed min-width causing workflow detail overflow;
- palette/dialog max sizes fit compact viewport;
- inspector/canvas stack at compact breakpoints if implemented.

### Integration Checks

Run:

- `npm test -- src/features/workflows/components/WorkflowGraphEditor.test.tsx`
- `npm test -- src/features/workflows/components/WorkflowGraphPalettes.test.tsx`
- `npm test -- src/features/workflows/components/ActionConfigEditor.test.tsx`
- `npm test -- src/features/workflows/pages/WorkflowDetailPage.test.tsx`
- `npm test -- src/features/workflows/lib/graphEditorCommands.test.ts`
- `npm test -- src/features/workflows/lib/graphLayout.test.ts`
- `npm test -- src/features/workflows/lib/workflowGraph.test.ts`
- `npm test -- src/AppCss.test.ts`
- `npx tsc --noEmit`

If Electron command behavior changes unexpectedly, also run:

- `npm test -- src/lib/workflowApi.test.ts`
- `npm test -- electron/backend/commands.test.ts`
- `npm run build:electron`

Those Electron checks should not normally be needed for this spec because the
target change is frontend UI/UX.

## Manual QA Checklist

Verify on desktop and compact desktop:

- open Workflow Library;
- open Workflow Detail;
- see graph editor as the only authoring surface;
- open Add Action and search;
- open Add Logic and add If;
- select Start and verify protected delete;
- select action node and edit config;
- select link and edit link wait;
- multi-select nodes and verify summary;
- run Validate and route to issue;
- create stale issue state by editing after validation;
- open Shortcuts;
- run or open Launch confirmation;
- verify Stop when running if a run can be started in test environment;
- resize to `1024x768`;
- confirm no horizontal overflow;
- confirm inspector still reachable;
- confirm palette and launch dialog fit viewport.

## Documentation Requirements

Update docs if implementation changes current truth:

- `docs/architecture/frontend.md` if component ownership changes materially.
- `docs/domain/user-visible-invariants.md` if graph behavior changes.
- `docs/contracts/run-state.md` if run-state shape or mapping changes.
- `docs/contracts/workflow-types.md` if graph DTO changes.
- `docs/task-routes.md` if required checks/routes change.
- `README.md` smoke checklist if graph workflow smoke changes.

If implementation is presentation/component-only and preserves behavior, note in
final implementation response that docs did not need updates beyond this spec.

## Acceptance Criteria

Graph Builder is complete when:

- The graph remains the only workflow authoring surface.
- React Flow and current graph DTO are preserved.
- Header commands are clear and accessible.
- Toolbar is grouped and usable.
- Palettes are searchable, categorized, and responsive.
- Canvas communicates node/link/run/issue/selection states.
- Port tooltips remain custom and useful.
- Inspector supports no selection, node, link, and multi-selection states.
- Link wait editing is clear and scoped to the selected link.
- Validation and runtime failures route to affected graph objects.
- Stale issues remain visible and prompt recheck.
- Start node protection is clear in single and multi-selection.
- Run from selected is visible/enabled only under correct conditions.
- Compact desktop at `1024x768` remains usable.
- Sensitive data boundaries are preserved.
- Focused tests cover changed behavior.

## Agent Handoff Notes

For the coding agent implementing this spec:

- Start with tests for the changed UI behavior.
- Do not rewrite graph compiler or backend run semantics.
- Do not move Workflow Settings fields into graph nodes.
- Prefer pure helpers for issue/selection presentation.
- Keep `WorkflowGraphEditor` as coordinator, not as a dumping ground for every
  visual detail.
- Use shared UI primitives from Foundation.
- Read `DESIGN.md` before touching CSS.
- Keep final response explicit about tests, docs updates, and DESIGN.md
  consultation.

