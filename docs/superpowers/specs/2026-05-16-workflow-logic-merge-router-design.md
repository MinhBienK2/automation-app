# Workflow Logic Merge and Router Design

Date: 2026-05-16

## Status

Draft for user review.

## Scope

This design covers the first workflow logic upgrade only:

- Add a Merge/Junction graph node for explicit fan-in.
- Add a Router/Decision Table graph node for multi-case branching.
- Preserve the existing structured graph model and one-edge-per-port default.

This design does not include reusable workflow blocks, callable subflows, graph-level parallelism, or synchronization joins.

## Problem

The current graph model is safe and easy to compile, but too limited for common workflow logic. Normal ports allow one outgoing edge and one incoming edge. Branch nodes such as `If` and `Switch` can split logic, but users cannot clearly express multiple branches returning to one shared workflow cluster without duplicating nodes or creating confusing graph shapes.

The product needs more flexible navigation while preserving auditability, validation clarity, and deterministic execution.

## Goals

- Let multiple branch paths intentionally continue into the same downstream workflow segment.
- Let users express many prioritized conditions in one node instead of nesting many `If` nodes.
- Keep graph execution deterministic and serial.
- Keep unsupported graph shapes blocked by validation before run.
- Make branch intent visible through explicit ports and node types.
- Preserve current behavior for existing workflows.

## Non-Goals

- No arbitrary multi-edge support for all nodes.
- No parallel branch execution.
- No wait-for-all or wait-for-any join semantics.
- No reusable block library or callable subflow.
- No changes to browser identity, session, or action execution semantics beyond graph control flow.

## Design Principles

- Flexible graph behavior must be explicit. If a node supports many incoming links, its type should say so.
- Compiler semantics must be obvious from the canvas.
- A saved graph should still be reproducible and explainable from run evidence.
- Validation errors should describe the graph authoring mistake, not expose compiler internals.

## Merge/Junction Node

### Purpose

Merge is an explicit pass-through node that allows many branch paths to continue into one shared downstream path.

Example:

```text
Router case_1 -> Relogin Flow      \
Router case_2 -> Refresh Flow       -> Merge -> Verify Account -> Continue
Router case_3 -> Evidence Flow     /
Router default -> Normal Flow     /
```

### User Semantics

- Merge accepts multiple incoming links.
- Merge has one outgoing `out` port.
- Merge does not evaluate conditions.
- Merge does not wait for other branches.
- Merge does not run branches in parallel.
- The path that reaches Merge continues through `out`.
- If `out` is unconnected, that path ends successfully at Merge.

Merge is intentionally not a synchronization join. A future Join node may add wait-for-all or parallel semantics, but that is out of scope.

### Ports

```text
Inputs:
  in: In

Outputs:
  out: Out
```

The persisted port list can still contain one input port named `in`; the validation exception belongs to node semantics, not to dynamic input port creation.

### Validation

Backend validation remains authoritative.

Rules:

- Merge may receive more than one edge into `in`.
- Other node input ports still reject multiple incoming edges.
- Merge output `out` may have at most one outgoing edge.
- Merge self-links are rejected.
- Merge must not participate in unsupported cycles.
- A Merge with no incoming edges is unreachable unless it is connected from Start through another path; normal reachability validation should catch this.
- A Merge with no outgoing edge is allowed and should produce a warning that the path ends successfully there.

Branch/continuation overlap validation must treat Merge as the only supported point where branch paths may intentionally converge. If a branch and a continuation both reach the same downstream node without passing through Merge, validation should still reject the graph as ambiguous.

### Compilation

Merge must compile as a graph-native no-op step, not as a browser action.

Reasons:

- Canvas run state can highlight that execution passed through Merge.
- Run evidence can show the branch convergence point.
- Compiler traversal can keep one simple `node -> nextTarget(node, "out")` shape.

Runner behavior for the no-op config must be internal and fast. It must not touch the browser page, output store, network policy, or session state.

### Run From Selected

Merge can be part of the main path only when it is reachable through the current main continuation traversal. Selecting Merge itself should not be a valid run-from-selected start unless the implementation explicitly supports graph-native no-op starts. For the MVP, run-from-selected should require an executable node and should skip Merge as a selectable start.

## Router/Decision Table Node

### Purpose

Router lets users define multiple prioritized conditions in one graph node and route to the first matching branch.

Example:

```text
Detect State -> Router
                case_1: New account      -> Warmup
                case_2: Session expired  -> Relogin
                case_3: Challenge seen   -> Capture Evidence
                default                  -> Normal Flow
                done                     -> Continue
```

### User Semantics

- Router evaluates cases from top to bottom.
- The first matching case runs.
- If no case matches, the default branch runs.
- Missing case/default branch links are no-ops.
- After the selected branch completes, execution continues through `done`.
- If `done` is unconnected, the workflow path ends successfully after the selected branch.
- Router does not run all matching cases in the MVP.
- Router does not run branches in parallel.

The MVP mode is `first_match` only. The UI should not expose a mode selector until another mode is implemented.

### Config Shape

Recommended graph node config:

```ts
type RouterGraphConfig = {
  mode: "first_match";
  cases: Array<{
    id: string;
    label: string;
    condition: WorkflowCondition;
  }>;
  default_label?: string | null;
};
```

Case `id` must be stable so renaming or reordering cases does not silently break existing edges. Ports must use `case_<id>` and must not use array indexes. Removing a case removes its case port and any edges attached to that port.

### Ports

Minimum ports:

```text
Inputs:
  in: In

Outputs:
  case_<id>: <case label>
  default: Default
  done: Done
```

`done` keeps Router aligned with existing branch block semantics. Branch work and continuation work remain separate.

### UI

The inspector should show Router cases as a compact decision table:

```text
Priority | Label | Condition
```

Required controls:

- Add case.
- Remove case.
- Move case up.
- Move case down.
- Rename case.
- Edit condition using the same condition editor pattern as existing `If`, `While`, and `Repeat Until` nodes.

The canvas should show one output port for each case, plus `Default` and `Done`. Port labels should stay readable after case rename.

### Validation

Rules:

- Router must have at least one case.
- Case ids must be unique.
- Case labels must be non-empty.
- Case conditions must be valid.
- Router ports must match config cases.
- Missing case/default links are allowed as no-op branches.
- Missing `done` link is allowed and should warn that the workflow ends successfully after Router.
- Router self-links are rejected.
- Unsupported cycles are rejected.
- Branch paths must not overlap with `done` continuation paths unless they converge through Merge.

### Compilation

Router must compile to a graph-internal action config that represents first-match conditional routing.

Recommended internal action type:

```ts
{
  type: "router_condition",
  config: {
    mode: "first_match",
    cases: [
      {
        id: string,
        label: string,
        condition: WorkflowCondition,
        steps: CompiledNestedAction[]
      }
    ],
    default_steps: CompiledNestedAction[]
  }
}
```

After appending the Router compiled step, the compiler continues from `done`.

This is preferable to overloading `switch_condition`, because Router cases can use independent condition objects instead of comparing one expression against many values.

### Runner

Runner support should evaluate Router cases in order using the same condition evaluation used by `if_condition` where possible.

Execution:

1. Evaluate case 1.
2. If true, execute case 1 nested steps and stop checking remaining cases.
3. Otherwise evaluate the next case.
4. If no case matches, execute default steps.
5. Return success to the outer compiled path so `done` continuation can run.

If condition evaluation fails, the Router step fails with the Router graph node id and case label when available.

## Combined Pattern

Router and Merge together cover the main requested flexibility:

```text
Start
  -> Detect State
  -> Router
      case_1 -> Relogin Flow      \
      case_2 -> Refresh Flow       -> Merge -> Verify -> Continue
      case_3 -> Evidence Flow     /
      default -> Normal Flow     /
```

This expresses many conditions, branch-specific work, and one common continuation without duplicating the common workflow cluster.

## Data Model Impact

`GraphNodeType` must add:

- `merge`
- `router`

`WorkflowGraph` stays on the current version for this feature. Router and Merge are additive node types, and no existing graph shape needs migration. If an implementation later discovers persisted Router drafts with mismatched case ports, normalize only those Router nodes and add graph migration notes for the changed paths.

`GraphEdge` shape can remain unchanged.

`ActionConfig` must add an internal runner-facing variant for `router_condition` and a no-op graph-control variant for Merge. If the project already has a suitable internal no-op action, reuse it instead of adding a duplicate variant.

## Frontend Impact

Expected touched areas:

- `src/types/workflow.ts`
- `src/features/workflows/lib/workflowGraph.ts`
- `src/features/workflows/components/WorkflowGraphInspectorFields.tsx`
- `src/features/workflows/components/WorkflowGraphPalettes.tsx`
- `src/features/workflows/lib/graphNodeHelpContent.ts`
- focused graph editor tests and help/config tests

The Add Logic palette should include:

- Merge under branching or flow-control wording.
- Router under branching.

The UI should preserve the existing Supabase-inspired dark design system when styling changes are needed.

## Backend Impact

Expected touched areas:

- `electron/backend/graphCompiler.ts`
- `electron/backend/graphCompiler.test.ts`
- `electron/backend/runner.ts`
- focused runner tests for `router_condition`

Compiler changes:

- Add expected ports for Merge and Router.
- Add validation exceptions for Merge multi-incoming.
- Add branch/continuation overlap handling that allows explicit convergence through Merge.
- Compile Merge as no-op/pass-through.
- Compile Router into nested first-match case steps, then continue through `done`.

Runner changes:

- Execute no-op Merge configs without browser side effects.
- Execute `router_condition` first-match semantics.

## Documentation Impact

Update current docs when implementation happens:

- `docs/domain/product-model.md`
- `docs/domain/user-visible-invariants.md`
- `docs/domain/execution-semantics.md`
- `docs/architecture/runner.md`
- `docs/contracts/workflow-types.md`

README smoke checklist only needs updates if the visible workflow smoke steps change.

## Test Plan

Compiler tests:

- Merge accepts multiple incoming edges.
- Non-Merge nodes still reject multiple incoming edges.
- Merge with one outgoing edge compiles to continuation path.
- Merge with missing outgoing edge warns and ends path.
- Router compiles cases, default, and done continuation.
- Router missing optional branches compiles no-op nested steps.
- Router rejects empty cases and invalid conditions.
- Branch paths may converge through Merge.
- Branch paths still cannot overlap with continuation without Merge.

Runner tests:

- Router runs first matching case only.
- Router runs default when no case matches.
- Router continues after nested case steps.
- Router failure includes useful case/node context.
- Merge no-op does not change outputs or browser state.

Frontend tests:

- Add Logic can create Merge and Router nodes.
- Router inspector can add, remove, rename, and reorder cases.
- Router ports update consistently when cases change.
- Connecting multiple edges to Merge input preserves all links.
- Connecting multiple edges to normal inputs still replaces/rejects as before.

## Rollout Plan

Phase 1: Merge

- Add `merge` node type, ports, palette entry, help text, validation, compilation, and tests.
- Preserve existing one-edge rule except for Merge input.

Phase 2: Router

- Add `router` node type, config UI, dynamic ports, compiler support, runner support, and tests.
- Use first-match semantics only.

Phase 3: Polish

- Improve validation messages for convergence mistakes.
- Add examples to graph node help.
- Verify combined Router -> Merge workflow with focused tests.

## Acceptance Criteria

- Users can route multiple branch paths into one shared downstream path through Merge.
- Users can author a first-match multi-case Router without nesting many If nodes.
- Existing workflows continue to validate and compile unchanged.
- Backend validation rejects ambiguous convergence unless it passes through Merge.
- Runner progress and failures remain attributable to graph node ids.
- Merge appears as an internal no-op graph step in run progress/history without browser side effects.
- Router case ports use stable case ids, not array indexes.
- No reusable block/subflow behavior is included in this scope.
