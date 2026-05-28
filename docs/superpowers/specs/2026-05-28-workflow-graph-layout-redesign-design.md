# Workflow Graph Layout Redesign Design

Date: 2026-05-28

## Status

Draft for user review.

## Scope

This design covers a complete UX and technical redesign of graph layout and
link readability in the workflow graph editor.

Included:

- Replace the current manual depth-based auto-arrange algorithm with a
  deterministic layered layout engine.
- Add graph-aware execution lanes for main flow, branches, continuations,
  merges, loops, and recovery paths.
- Replace default React Flow edge drawing with workflow-specific edge routing
  that reduces visual crossing and avoids running links through node bodies.
- Improve visual hierarchy for main-path, branch, continuation, loop, selected,
  validation, running, completed, and failed links.
- Add focused arrange operations for the whole graph and selected graph
  fragments.
- Preserve persisted workflow graph compatibility.
- Add tests and documentation gates so future graph-node changes cannot regress
  layout readability silently.

Excluded:

- No graph execution semantics changes.
- No persisted `WorkflowGraph` schema change unless implementation proves it is
  unavoidable.
- No new graph node types.
- No parallel execution, wait-for-all join, or branch synchronization semantics.
- No change to browser automation behavior, runner behavior, evidence output,
  validation rules, or Workflow Settings.

## Problem

The current graph editor can create and run complex workflows, but auto-arrange
does not make complex graphs readable enough. The current implementation in
`src/features/workflows/lib/graphEditorCommands.ts` derives execution order,
assigns a depth, then places nodes into fixed columns, rows, and wrapped lanes.
That is deterministic and fast for a linear `Start -> A -> B -> End` flow, but
it does not optimize edge crossings, port order, branch grouping, merge points,
loop back-edges, or recovery branches.

The visible result is that links can cut diagonally across unrelated nodes or
across each other. Users then lose the ability to scan execution order from the
canvas, especially in graphs using `If`, `Switch`, `Router`, `Merge`, loop
nodes, `Retry`, `Try/Catch`, and `Fallback`.

The product needs graph authoring to feel like an operations-grade workflow
builder: predictable, dense, explainable, and easy to inspect under run
pressure.

## Goals

- Make auto-arranged graphs readable by default for both linear and branching
  workflows.
- Minimize link crossing using a real layout algorithm, not hand-tuned depth
  placement.
- Keep the main execution path visually stable and easy to follow left to
  right.
- Keep branch work visually separate from continuation work.
- Route loop, retry, recovery, and back-reference links in predictable gutters
  instead of across node bodies.
- Preserve existing saved workflows and manual node positions until the user
  explicitly arranges.
- Keep auto-arrange deterministic for the same graph input.
- Make layout part of undo/redo history.
- Keep graph rendering responsive for large graphs.
- Preserve the existing Supabase-inspired dark Mission Control design system.

## Non-Goals

- Do not make auto-arrange infer or change business logic.
- Do not reorder Router cases, Switch cases, branch priority, or execution
  semantics.
- Do not auto-connect or delete links.
- Do not add animated decorative effects.
- Do not make the graph a marketing-style visual surface; it remains a dense
  work surface.
- Do not rely on color alone to identify link meaning.

## Current Evidence

- `docs/domain/user-visible-invariants.md` already requires auto-arrange to
  place nodes into deterministic execution lanes and wrap long main paths.
- `docs/architecture/frontend.md` identifies `WorkflowGraphEditor.tsx`,
  `WorkflowGraphCanvasParts.tsx`, `workflowGraph.ts`, and
  `graphEditorCommands.ts` as the frontend-owned graph editing boundary.
- `DESIGN.md` requires dark, dense, stable desktop operations UI with cyan
  focus/active states, green only for success, amber for validation, and red for
  failure.
- `WorkflowGraphEditor.tsx` currently calls `arrangeWorkflowGraph` synchronously
  from the Auto arrange toolbar command.
- `graphEditorCommands.ts` currently uses fixed constants:
  `arrangeColumnGap = 260`, `arrangeRowGap = 120`, `arrangeLaneGap = 180`, and
  `arrangeColumnsPerLane = 8`.
- React Flow edges currently use default edge rendering, with CSS styling
  layered on `.react-flow__edge-path`.

## Approaches Considered

### Option A: Improve The Existing Manual Layout

Keep `arrangeWorkflowGraph` synchronous and add more local heuristics for
branch ordering, merge placement, and loop routing.

Pros:

- Small dependency footprint.
- Lower implementation risk.
- Easier to keep current tests mostly intact.

Cons:

- Still becomes fragile as graph semantics grow.
- Hard to prove edge-crossing improvement.
- Every new graph node type will need another custom heuristic.
- Does not solve the root problem for complex branch/merge/loop graphs.

### Option B: Use Dagre For Layered Layout

Add Dagre and compute left-to-right layered node positions.

Pros:

- Simple, mature, and common with React Flow examples.
- Better than the current manual depth layout.
- Lower complexity than ELK.

Cons:

- Weaker support for explicit ports and compound routing needs.
- Branch lane semantics need extra custom logic around Dagre.
- Loop and recovery routing remain mostly our problem.

### Option C: Use ELK Layered Layout With Workflow Hints

Add `elkjs` and translate the workflow graph into an ELK layered graph with
explicit port constraints, edge priorities, spacing, and direction hints.
Post-process positions into the app's stable coordinate grid.

Pros:

- Strong support for layered layout, ports, edge crossing minimization, and
  spacing constraints.
- Fits explicit graph ports already present in the product model.
- Gives the best path to a long-term "do it once properly" solution.
- Lets branch and loop behavior be encoded as layout hints without changing
  execution semantics.

Cons:

- Adds a dependency.
- Auto-arrange becomes asynchronous.
- Requires a translation layer and more robust tests.

Decision: use Option C.

The goal is not just to make current graphs a little nicer. The product needs a
layout foundation that can survive more graph-native nodes and larger workflows.
ELK is the right tradeoff for a complete fix.

## UX Design

### Toolbar Commands

The graph toolbar keeps the existing icon-first command style.

Commands:

- `Auto arrange graph`: arrange all nodes.
- `Arrange selection`: arrange only the selected nodes when at least two nodes
  are selected.
- `Fit view`: unchanged.
- `Undo` and `Redo`: include arrange operations.

`Arrange selection` appears as an icon-only toolbar action with tooltip text and
an accessible label. It is disabled when fewer than two nodes are selected or
while a run is active.

When auto-arrange is running, the arrange controls show a disabled busy state.
The canvas remains stable until the new layout is ready, then positions update
in one committed graph change.

### Auto-Arrange Behavior

Whole-graph arrange:

- Includes every node in the saved graph.
- Preserves all nodes, edges, configs, ports, labels, group ids, edge delays,
  and viewport metadata.
- Updates only node positions.
- Keeps long main paths reachable by wrapping them into deterministic rows when
  a single horizontal lane would exceed the readable canvas width.
- Calls `fitView` after the layout is committed.
- Pushes one undo history entry.

Selection arrange:

- Includes selected nodes plus internal edges between selected nodes.
- Preserves non-selected node positions.
- Treats incoming and outgoing edges to outside nodes as anchors so the selected
  subgraph remains near its existing context.
- Pushes one undo history entry.
- Does not call full `fitView`; it recenters on the arranged selection.

Manual movement remains valid. Auto-arrange is an explicit user command, not an
autosave-side normalization pass.

### Execution Lanes

The canvas should communicate graph intent through placement.

Main lane:

- `Start`, normal action chain, graph utility nodes, `Merge`, and terminal
  continuation nodes sit on the primary horizontal lane where possible.
- Main lane reads left to right.
- Main-path edges use the most direct horizontal routing.
- Long main paths wrap into the next row using the same left-to-right reading
  direction per row. Do not use a snake direction that reverses the reading
  order on alternating rows.

Branch lanes:

- `If.true`, first Router/Switch cases, and success-like branch ports prefer
  the lane below the decision node.
- `If.false`, default cases, failure/recovery/error ports, and timeout-like
  ports prefer a separate lane above or below, chosen to minimize crossings.
- Branch work should not be interleaved with continuation work.
- Branches that rejoin must visually converge at `Merge` or a continuation
  node after `done`.

Continuation lane:

- `done`, `success`, and equivalent continuation ports should route back to the
  main lane after branch work.
- Continuation links should not cross through branch clusters.

Loop and retry lanes:

- Loop body links route into a body lane.
- Loop completion links route forward to continuation.
- Back-edges or repeated-body visual hints route through a reserved gutter.
- Retry failure/recovery links use a recovery lane distinct from success.

Unreachable or disconnected nodes:

- Place after reachable execution lanes in a separate "Unconnected" row.
- Keep deterministic order by existing node order and node id.
- Do not hide them or silently connect them.

### Link Routing

Default diagonal Bezier links are replaced with workflow-specific routed links.

Routing rules:

- Edges leave output ports horizontally, then turn through a gutter, then enter
  input ports horizontally.
- Main-path links prefer short horizontal paths.
- Branch links use vertical gutters around the branch cluster.
- Back-edges and loop-like links use an outer gutter so they do not cross
  through nodes.
- Links must not pass through node bodies when avoidable.
- Edge labels should sit on the clearest horizontal segment, not in the middle
  of a dense crossing cluster.

The implementation may use a custom React Flow edge component backed by
`getSmoothStepPath` or a custom SVG path generator. The chosen implementation
must keep edge selection, context menu, labels, markers, interaction width,
runtime status classes, validation issue classes, and selected-link delay
editing intact.

### Visual Hierarchy

Keep the existing dark theme and semantic colors.

Link classes:

- `graph-edge-main`: primary execution path.
- `graph-edge-branch`: conditional or case branch.
- `graph-edge-continuation`: `done`, `success`, and continuation ports.
- `graph-edge-loop`: loop body or loop-related return path.
- `graph-edge-recovery`: error, failed, timeout, fallback, catch, or recovery
  path.

Visual treatment:

- Main path: slightly stronger neutral/cyan-tinted stroke.
- Branch path: neutral stroke with dashed or lower-opacity treatment.
- Continuation path: neutral stroke with a distinct label/marker treatment.
- Loop/recovery path: subtle patterned stroke, not a loud warning color.
- Selected/running/completed/failed/issue states override link-kind styling
  using the existing semantic colors.

State priority:

1. Failed
2. Validation issue
3. Running
4. Selected
5. Completed
6. Link kind
7. Idle

Green remains reserved for successful terminal/completed states. Amber remains
validation/warning. Red remains failure.

### Canvas Framing

After whole-graph arrange, `fitView` should use padding so node labels,
handles, edge labels, minimap, and controls do not feel clipped.

For large graphs:

- Keep the minimap guard already present for very large node counts.
- Keep React Flow visible-element rendering for large graphs.
- Layout computation may be async, but UI should not freeze for common graphs.
- Very large graph layout failures should show a contained error and leave
  existing positions unchanged.

## Technical Design

### New Layout Module

Add a pure frontend module:

```text
src/features/workflows/lib/graphLayout.ts
```

Responsibilities:

- Convert `WorkflowGraph` into an ELK graph.
- Attach node dimensions and port constraints.
- Classify edges by workflow intent.
- Apply layered layout options.
- Convert ELK output positions back to `WorkflowGraph` node positions.
- Support whole-graph and selected-subgraph layout modes.
- Return metadata needed by edge styling, if that metadata can be derived
  without changing persisted graph shape.

Public API:

```ts
export type GraphLayoutMode =
  | { type: "full" }
  | { type: "selection"; nodeIds: string[] };

export type GraphLayoutResult = {
  graph: WorkflowGraph;
  edgeKinds: Map<string, WorkflowGraphEdgeKind>;
};

export async function layoutWorkflowGraph(
  graph: WorkflowGraph,
  mode: GraphLayoutMode,
): Promise<GraphLayoutResult>;
```

The returned graph must preserve every non-position field by reference or value
equivalence. The function must never mutate its input.

### Compatibility Wrapper

Replace or adapt the current synchronous `arrangeWorkflowGraph` call.

Recommended migration:

- Keep `arrangeWorkflowGraph` as a small compatibility wrapper only for tests
  that need deterministic sync fixtures, or remove it after call sites migrate.
- Update `WorkflowGraphEditor.tsx` so `autoArrangeGraph` is async.
- Add `isArrangingGraph` UI state.
- On layout success, call `commitGraphChange`.
- On layout failure, show a compact non-blocking graph issue toast/banner or
  inline toolbar error and keep existing positions.

### ELK Configuration

Base ELK options:

```text
algorithm: layered
direction: RIGHT
spacing.nodeNode: 80
layered.spacing.nodeNodeBetweenLayers: 120
layered.crossingMinimization.strategy: LAYER_SWEEP
layered.nodePlacement.strategy: NETWORK_SIMPLEX
portConstraints: FIXED_SIDE
```

The implementation may tune exact numbers, but the tests should assert
relative layout properties rather than brittle pixel-perfect values except for
small deterministic fixtures.

Long-path wrapping:

- ELK computes the layered structure and crossing minimization.
- A post-processing step wraps long single-lane main paths into deterministic
  rows when the number of sequential main-path columns exceeds the configured
  readable column limit.
- Wrapped rows always read left to right. Row-to-row continuation links route
  through an outer gutter.
- Branch clusters stay attached to the row containing their decision node when
  possible; if a branch cluster is taller than one row, it may reserve
  additional vertical space before the next main-path row.

Node size:

- Start/action/utility/end nodes default to the existing `160 x 64`.
- Nodes with many output ports get additional height or port spacing metadata
  so ELK does not stack links too tightly.
- The visual component should continue to render within stable dimensions.

Port side:

- Inputs: left.
- Outputs: right.
- Multi-output ports preserve the logical order already used by
  `orderedOutputPortIds`.

### Edge Classification

Edge kind is derived from source node type and source port.

Main:

- `start.out`
- `action.out`
- utility node `out`
- `merge.out`

Branch:

- `if.true`
- `if.false`
- `switch.case_*`
- `switch.default`
- `router.case_*`
- `router.default`
- `fallback.primary`

Continuation:

- `if.done`
- `switch.done`
- `router.done`
- `try_catch.done`
- loop `done`
- `retry.success`
- `fallback.done`

Loop:

- `repeat_times.loop`
- `repeat_for_each.loop`
- `while.loop`
- `repeat_until.loop`

Recovery:

- `retry.try`
- `retry.failed`
- `try_catch.try`
- `try_catch.error`
- `try_catch.finally`
- `fallback.fallback`
- `repeat_until.timeout`

The classification is editor-only. It must not be persisted unless a later
implementation proves that computed edge kind is too expensive or unstable.

### Edge Rendering Module

Add or extend:

```text
src/features/workflows/components/WorkflowGraphCanvasParts.tsx
```

with a custom edge component:

```ts
export function WorkflowGraphEdge(props: EdgeProps<WorkflowFlowEdge>) { ... }
```

The edge component must support:

- Selection.
- Context menu.
- Keyboard/accessibility labels already provided through React Flow edge data.
- Marker color/state updates.
- Edge labels and execution-order labels.
- Link wait metadata display if present.
- Interaction width large enough for easy selection.

`toReactFlowGraph` should set:

```ts
type: "workflow"
data: {
  kind: WorkflowGraphEdgeKind;
  ...
}
```

The editor should register:

```ts
const edgeTypes = { workflow: WorkflowGraphEdge };
```

### Persisted Data

No persisted schema change is required.

The saved `WorkflowGraph` remains:

- `version`
- `nodes`
- `edges`
- `viewport`

Only `node.position` changes when the user explicitly arranges. Edge kind,
layout metadata, route points, and ELK internals remain computed view state.

### Dependency

Add:

```text
elkjs
```

Use the browser-compatible bundle in renderer code. Keep imports isolated inside
`graphLayout.ts` so the dependency does not leak into unrelated graph helpers.

## Error Handling

If layout fails:

- Do not commit any graph change.
- Keep current positions.
- Show a compact message: `Could not arrange graph. Existing positions were kept.`
- Log no secrets, URLs, action configs, or raw graph payloads to the UI.
- Tests should simulate a rejected layout promise and assert positions are
  unchanged.

If selected-subgraph layout has no internal edges:

- Arrange selected nodes into a clean compact row near their current selection
  bounding box.
- Keep outside nodes unchanged.

If selected-subgraph layout would overlap outside nodes:

- Prefer shifting the arranged selection to preserve at least one node-width
  gutter.
- If overlap remains, still commit deterministic positions; do not delete or
  move outside nodes.

## Accessibility

- Arrange toolbar buttons must have accessible labels and tooltip text.
- Busy state must be exposed with disabled controls and readable status text for
  assistive tech.
- Edge labels and edge `ariaLabel` behavior must not regress.
- Link selection must remain possible by pointer through a large interaction
  width.
- State must not rely on color alone; line pattern, stroke weight, label, and
  selection affordance carry meaning too.

## Performance

Targets:

- 50 nodes / 80 edges: arrange perceptibly under normal interaction latency.
- 300 nodes: layout can take longer, but the UI must remain responsive and show
  busy state.
- Above the current minimap guard threshold, keep visible-element rendering.

Implementation notes:

- Run ELK layout only on explicit arrange commands.
- Do not run layout on every drag, connect, config edit, autosave, validation,
  or run-state update.
- Memoize only computed edge kind where useful; avoid caching positions that can
  become stale after graph edits.

## Testing Strategy

### Unit Tests

Add focused tests for `graphLayout.ts`:

- Linear graph remains left-to-right.
- Long linear graph wraps into deterministic left-to-right rows without using a
  reversed snake row.
- `If` graph places branch nodes in separate lanes and `done` continuation
  after the branch cluster.
- `Router` with multiple cases preserves case order and avoids all cases being
  stacked on the main lane.
- `Merge` converges branches after branch work.
- `Repeat Times` or `While` separates loop body from done continuation.
- `Retry` separates try, success, and failed/recovery paths.
- Disconnected nodes are placed in a deterministic unconnected area.
- Layout preserves all non-position graph fields.
- Layout is deterministic for identical input.
- Selection layout moves only selected nodes.
- Layout failure leaves graph unchanged.

Update existing tests:

- Replace pixel-perfect expectations in `graphEditorCommands.test.ts` where
  they encode the old manual algorithm.
- Keep tests that verify edge/node preservation and undo/redo behavior.
- Update `WorkflowGraphEditor.test.tsx` so Auto arrange awaits async layout,
  commits one graph change, persists new positions, and disables arrange while
  running.

### Component Tests

Add or update tests for:

- Toolbar exposes `Auto arrange graph` and `Arrange selection`.
- `Arrange selection` is disabled until at least two nodes are selected.
- Arrange controls are disabled while graph layout is pending.
- Arrange controls are disabled while a workflow run is active.
- Layout errors are contained and do not overwrite positions.
- Custom edge component renders labels, marker, selection class, issue class,
  running/completed/failed classes, and click/context-menu selection.

### CSS Tests

Update `src/AppCss.test.ts` if CSS invariants cover graph colors or edge state.

CSS assertions should protect:

- Semantic colors stay aligned with `DESIGN.md`.
- Green is not used for idle branch styling.
- Link kind classes exist.
- Selected/running/issue/failed classes override link kind styling.

### Manual Smoke

Update the README smoke checklist if implementation changes the user-visible
graph workflow. Manual smoke should include:

- Arrange a simple graph.
- Arrange a graph with `If -> true/false -> Merge -> Continue`.
- Arrange a Router with at least three cases and default.
- Arrange a loop graph.
- Select a subset of nodes and arrange only that selection.
- Undo and redo an arrange.
- Save, reopen, and confirm positions persist.

## Acceptance Criteria

The feature is complete when all of the following are true:

- Whole-graph auto-arrange uses ELK-backed layout or an equivalent layered
  engine, not the old fixed-depth algorithm.
- Branch-heavy graphs have visibly fewer crossings than the current layout.
- Main path, branch path, continuation path, loop path, and recovery path are
  visually distinguishable without relying only on color.
- Links avoid passing through node bodies in common graph shapes.
- Auto arrange and arrange selection are both part of undo/redo history.
- Auto arrange preserves graph data except node positions.
- Arrange selection preserves non-selected node positions.
- Layout failure leaves positions unchanged and shows a contained message.
- Existing saved workflows load without migration.
- Graph validation, compilation, run progress, selected-link editing, edge
  waits, context menus, and issue selection still work.
- Focused unit/component/CSS tests pass.
- `docs/domain/user-visible-invariants.md`, `docs/architecture/frontend.md`,
  and README smoke checklist are updated if implementation changes the current
  user-visible contract.

## Implementation Phases

Phase 1: Layout foundation

- Add `elkjs`.
- Add `graphLayout.ts`.
- Implement full-graph layout.
- Make `autoArrangeGraph` async with busy/error state.
- Update tests for deterministic layout and graph preservation.

Phase 2: Workflow edge rendering

- Add edge kind classification.
- Add custom workflow edge component.
- Add CSS classes for main/branch/continuation/loop/recovery styling.
- Preserve edge selection, labels, markers, context menu, and runtime state.

Phase 3: Selection arrange

- Add `Arrange selection` toolbar action.
- Implement selected-subgraph layout with external anchors.
- Add tests for selected-only movement and undo/redo.

Phase 4: Polish and guardrails

- Tune ELK spacing for compact desktop density.
- Add failure handling and large-graph busy state.
- Update docs and README smoke checklist.
- Run focused test suite and typecheck.

## Risks And Mitigations

Risk: ELK output is deterministic but not pixel-stable across version updates.

Mitigation: Tests assert relative ordering, lane separation, and field
preservation. Pin dependency version through `package-lock.json`.

Risk: Async layout introduces race conditions with graph edits.

Mitigation: Capture a graph revision when arrange starts. Commit only if the
current graph still matches that revision, or explicitly rerun layout against
the latest graph before commit.

Risk: Edge routing becomes hard to select.

Mitigation: Preserve or increase `interactionWidth` and add component tests for
edge click/context menu behavior.

Risk: Visual styling becomes too noisy.

Mitigation: Use neutral strokes and subtle pattern/weight differences for link
kinds. Reserve semantic colors for state, matching `DESIGN.md`.

Risk: Large graphs freeze the renderer.

Mitigation: Layout only on explicit commands, show busy state, and keep
large-graph rendering guards. If profiling shows blocking, move layout into a
Web Worker in a follow-up without changing persisted graph data.

## Open Decisions For Implementation

- Exact ELK spacing values should be tuned with screenshots after Phase 1.
- The custom edge path can use React Flow `getSmoothStepPath` first; if it
  still crosses node bodies too often, replace it with a stricter orthogonal
  route generator.
- Whether `Arrange selection` should be visible disabled or hidden until
  multi-selection. Recommendation: visible disabled for discoverability.

## Documentation Impact

When implemented, update:

- `docs/domain/user-visible-invariants.md`: describe ELK-backed deterministic
  layout, arrange selection, and workflow edge kinds if they become part of the
  product contract.
- `docs/architecture/frontend.md`: document `graphLayout.ts` and custom edge
  ownership.
- `README.md`: update the desktop smoke checklist for arrange selection and
  branch-heavy layout verification.

No backend docs should change unless implementation changes persisted graph
contracts, validation, compilation, or run behavior.
