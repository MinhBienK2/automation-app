# Graph Business Logic Semantics Design

## Status

Approved for specification on 2026-05-01.

This document defines the business semantics for workflow graph nodes, links, validation, and compile/run behavior. It complements `2026-05-01-graph-editor-link-ux-design.md`, which focuses on selection, context menus, link visibility, `New node`, and inspector UX.

## Problem

The graph editor can visually represent branching, loops, retry paths, and recovery blocks, but the core business semantics are not strict enough yet. Current backend compilation already supports many graph node types by converting them into nested `ActionConfig` values, but several graph shapes can look meaningful while compiling or running differently from user intent.

Observed risks in the current implementation:

- Multiple edges from the same source port are silently reduced by compiler traversal because `next_target` chooses one edge deterministically.
- Branch ports can be missing and compile as empty nested steps without communicating whether that is intentional.
- Logic nodes such as `if`, `switch`, and `try_catch` do not consistently expose a continuation path after their internal branch work completes.
- `break_loop` and `continue_loop` can be placed outside a loop body and only fail later during execution.
- Users may confuse graph-native logic nodes with old action-config logic variants if both are exposed as authoring choices.
- A graph can validate structurally while still being ambiguous as a workflow.

## Goals

- Make graph-native logic nodes the only user-facing way to express workflow control flow.
- Treat logic nodes as business blocks: branch ports define work inside the block, continuation ports define what happens after the block.
- Preserve draft-friendly authoring: save incomplete graphs, but block run when semantics are unsafe or ambiguous.
- Define which missing links are no-op, warning, or blocking error.
- Align frontend link prevention, backend validation, and compiler behavior.
- Ensure setup graphs run according to the visible user model.
- Keep the scoped implementation compatible with the existing runner and nested `ActionConfig` execution model.

## Non-Goals

- No graph-native runner rewrite.
- No timeline tree implementation in this scope.
- No auto-layout or subgraph grouping implementation.
- No broad action taxonomy expansion.
- No removal of existing backend `ActionConfig` variants; they may remain as compiled/internal representations.
- No mandatory explicit `End Success` node for every path.

## Approved Decisions

- Use graph-native logic nodes for user-facing control flow.
- Hide logic action configs such as `if_condition`, `repeat_times`, `repeat_for_each`, `retry_block`, and `stop_workflow` from action type selection.
- Use hybrid validation: save drafts, show warnings/errors on Validate, block Run only on errors.
- Logic blocks use continuation ports. `If`, `Switch`, and `Try/Catch` gain a `done` continuation port.
- `If.true` and `If.false` can be unconnected; missing branch means no-op.
- Unconnected action or continuation port means the workflow ends successfully at that point.
- `break_loop` and `continue_loop` are valid only inside a loop body.
- `End Success` is optional. Explicit terminal nodes are for clarity or controlled failure, not a requirement.

## Mental Model

Each graph node is either a step or a control block.

### Step Nodes

Step nodes perform one action or state transition, then continue through their `out` port if connected.

Examples:

- `action`
- `set_variable`
- `transform_variable`
- `assert_output`
- `run_subworkflow`
- `manual_approval`
- `rate_limit`
- `domain_allowlist`

If a step node has no outgoing `out` edge, the workflow ends successfully after that step.

### Control Block Nodes

Control block nodes own nested branch work. Branch ports describe what happens inside the block. Continuation ports describe where the workflow goes after the block finishes.

Examples:

- `if`
- `switch`
- `repeat_times`
- `repeat_for_each`
- `while`
- `repeat_until`
- `retry`
- `try_catch`
- `fallback`

### Terminal Nodes

Terminal nodes stop the current path.

Examples:

- `end_success`
- `end_failure`
- `stop_workflow`
- `break_loop`
- `continue_loop`

`break_loop` and `continue_loop` are terminal only inside a loop body. Outside a loop body they are semantic errors.

## Node Semantics

### Start

Ports:

- Output: `out`

Rules:

- Exactly one `start` node is required.
- `start` is the workflow entrypoint.
- `start` cannot be deleted.
- If `start.out` is unconnected, the graph is a saveable draft. Run should fail with a clear no-executable-work error.

### Action And Linear Step Nodes

Ports:

- Input: `in`
- Output: `out`

Rules:

- Action nodes must have a valid executable `ActionConfig` before Run.
- `New node` uses `config: null` and is saveable but not runnable.
- If `out` is unconnected, the workflow ends successfully after this node.

This applies to action-like data/control nodes unless a node-specific rule says otherwise.

### If

Ports:

- Input: `in`
- Outputs: `true`, `false`, `done`

Execution:

- Evaluate the configured condition.
- If true, execute the `true` branch.
- If false, execute the `false` branch.
- If the selected branch is unconnected, that branch is a no-op.
- After the selected branch finishes, continue through `done`.
- If `done` is unconnected, the workflow ends successfully.

Validation:

- Missing or invalid condition is an error.
- Missing `true` or `false` branch is allowed.
- Missing `done` is allowed.

### Switch

Ports:

- Input: `in`
- Outputs: `case_1` through `case_N`, `default`, `done`

Execution:

- Read the configured expression from workflow output/variable context.
- Execute the matching case branch.
- If no case matches, execute `default`.
- If the selected case/default branch is unconnected, that branch is a no-op.
- After the branch finishes, continue through `done`.
- If `done` is unconnected, the workflow ends successfully.

Validation:

- Missing expression is an error.
- Empty case list is an error.
- Empty case value is an error.
- Missing case/default branch is allowed.
- Missing `done` is allowed.

### Repeat Times

Ports:

- Input: `in`
- Outputs: `loop`, `done`

Execution:

- Execute the `loop` branch `times` times.
- `continue_loop` skips to the next iteration.
- `break_loop` exits the loop.
- After normal completion or break, continue through `done`.
- If `done` is unconnected, the workflow ends successfully.

Validation:

- `times` must be greater than zero.
- `loop` branch is required before Run.
- `done` is optional.

### Repeat For Each

Ports:

- Input: `in`
- Outputs: `loop`, `done`

Execution:

- For each configured item, bind the item value to the configured item name.
- Execute the `loop` branch once per item.
- `continue_loop` skips to the next item.
- `break_loop` exits the loop.
- After normal completion or break, continue through `done`.
- If `done` is unconnected, the workflow ends successfully.

Validation:

- Item name is required.
- Items list must not be empty.
- `loop` branch is required before Run.
- `done` is optional.

### While

Ports:

- Input: `in`
- Outputs: `loop`, `done`

Execution:

- Evaluate the condition before each iteration.
- If condition is true, execute `loop`.
- If condition is false, continue through `done`.
- `continue_loop` skips to the next condition check.
- `break_loop` exits the loop and continues through `done`.
- If `done` is unconnected, the workflow ends successfully.

Validation:

- Condition is required.
- At least one guard is required: `max_attempts` or `timeout_ms`.
- `loop` branch is required before Run.
- `done` is optional.

### Repeat Until

Ports:

- Input: `in`
- Outputs: `loop`, `done`, `timeout`

Execution:

- Evaluate the condition before each iteration.
- If condition is met, continue through `done`.
- If condition is not met, execute `loop`.
- If max attempts or timeout is reached before condition passes, execute `timeout`.
- If `timeout` is unconnected, timeout path ends successfully but should produce a warning.
- `continue_loop` skips to the next condition check.
- `break_loop` exits the loop and continues through `done`.
- If `done` is unconnected, normal completion ends successfully.

Validation:

- Condition is required.
- At least one guard is required: `max_attempts` or `timeout_ms`.
- `loop` branch is required before Run.
- Missing `timeout` is a warning when timeout or max attempts can occur.
- `done` is optional.

### Retry

Ports:

- Input: `in`
- Outputs: `try`, `success`, `failed`

Execution:

- Execute `try` up to `max_attempts` until it succeeds.
- If `try` succeeds, continue through `success`.
- If `success` is unconnected, workflow ends successfully.
- If all attempts fail, store the last error.
- If `failed` is connected, execute the failed branch.
- If `failed` is unconnected, workflow fails with the last error.

Validation:

- `max_attempts` must be greater than zero.
- `try` branch is required before Run.
- `success` is optional.
- `failed` is optional, but missing `failed` should be explained as "retry failure will fail the workflow".

### Try/Catch

Ports:

- Input: `in`
- Outputs: `try`, `success`, `error`, `finally`, `done`

Execution:

- Execute `try`.
- If `try` succeeds, execute `success` if connected.
- If `try` fails with an action failure, store `last_error` and execute `error` if connected.
- If `error` is unconnected and `try` fails, the workflow fails with the original error.
- If `finally` is connected, execute it after success/error handling.
- If branch/finally execution does not stop or fail, continue through `done`.
- If `done` is unconnected, workflow ends successfully.

Validation:

- `try` branch is required before Run.
- `success` is optional.
- `error` is optional but missing `error` should be explained as "try failure will fail the workflow".
- `finally` is optional.
- `done` is optional.

### Fallback

Ports:

- Input: `in`
- Outputs: `primary`, `fallback`, `done`

Execution:

- Execute `primary`.
- If `primary` succeeds, skip fallback and continue through `done`.
- If `primary` fails, store `last_error`.
- If `fallback` is connected, execute fallback.
- If `fallback` is unconnected, workflow fails with the primary error.
- If fallback succeeds, continue through `done`.
- If `done` is unconnected, workflow ends successfully.

Validation:

- `primary` branch is required before Run.
- `fallback` is optional but missing fallback should be explained as "primary failure will fail the workflow".
- `done` is optional.

### Break Loop

Ports:

- Input: `in`

Execution:

- Exits the nearest enclosing loop body.

Validation:

- Must be reachable only through the `loop` branch of a loop block.
- If reachable outside loop context, Run is blocked.

### Continue Loop

Ports:

- Input: `in`

Execution:

- Skips the rest of the nearest enclosing loop body and starts the next iteration.

Validation:

- Must be reachable only through the `loop` branch of a loop block.
- If reachable outside loop context, Run is blocked.

### Stop Workflow

Ports:

- Input: `in`

Execution:

- Stops the workflow with configured success or failure status.

Validation:

- Status must be valid.
- Reason is optional for success and recommended for failure.

### End Success And End Failure

Ports:

- Input: `in`

Execution:

- `end_success` ends the workflow successfully.
- `end_failure` ends the workflow as a controlled failure with a configured or default reason.

Validation:

- Both are optional. A path can end successfully by simply having no next continuation edge.

## Link Semantics

Links represent directed execution flow.

Structural link rules:

- Source must be an output port.
- Target must be an input port.
- Self-links are invalid.
- Each input port accepts at most one incoming edge.
- Each output port emits at most one outgoing edge.
- Duplicate edges are invalid.
- Multiple branch paths require multiple named output ports, not multiple edges from one port.

Frontend behavior:

- Prevent obvious invalid links before they are persisted.
- If a user connects from or to an already-used port, replace the old edge instead of creating a parallel edge.
- Backend validation remains authoritative.

Reachability:

- All non-start nodes must be reachable from `start`.
- Nodes reachable only through branch ports are considered reachable.
- Unreachable draft nodes are errors for Run because they can mislead the user about what will execute.

Cycles:

- Free cycles are invalid.
- Loop repetition must be represented by loop node semantics, not by drawing an arbitrary cycle back to an earlier node.

## Validation Model

Validation has three layers.

### Save

Save is draft-friendly:

- Incomplete graph drafts can be saved.
- Unconfigured `New node` can be saved.
- Missing optional branches can be saved.

Save should only fail for serialization, persistence, or unsupported graph version errors.

### Validate

Validate returns errors and warnings:

- Errors block Run.
- Warnings explain behavior that may surprise users but is still executable.
- Every issue should include `node_id` or `edge_id` when possible.

### Run

Run must save the visible graph first, then perform authoritative validation/compile.

Run is blocked when any validation error exists. Run can proceed with warnings.

## Error Rules

Blocking errors:

- Unsupported graph version.
- Missing or multiple start nodes.
- Invalid node id or duplicate node id.
- Edge source/target node does not exist.
- Edge source/target port does not exist.
- Edge source port is not output or target port is not input.
- Self-link.
- Duplicate edge.
- More than one edge from the same output port.
- More than one edge into the same input port.
- Unreachable non-start node.
- Free cycle outside supported loop semantics.
- Unconfigured action node.
- Invalid action config.
- Missing required logic config: condition, expression, cases, loop guard, retry attempts, item list, workflow id, domain list, and equivalent required fields.
- Missing required body port: loop body, retry try body, try/catch try body, fallback primary body.
- `break_loop` or `continue_loop` reachable outside loop body.

Warnings:

- Missing optional `If.true` or `If.false` branch: selected branch will no-op.
- Missing optional switch case/default branch: selected branch will no-op.
- Missing continuation port such as `done` or `success`: workflow will end successfully there.
- Missing `repeat_until.timeout`: timeout path will end successfully.
- Missing retry `failed`: retry exhaustion will fail the workflow.
- Missing try/catch `error`: try failure will fail the workflow.
- Missing fallback `fallback`: primary failure will fail the workflow.
- Graph has no explicit `End Success`: allowed because implicit successful end is supported.

## Compiler Behavior

The compiler must match the visible block model.

Traversal starts from `start.out`.

Linear step nodes:

- Compile current node.
- Continue from `out`.
- If `out` is unconnected, path ends successfully.

Block nodes:

- Compile branch ports into nested action configs.
- Push one compiled action/config representing the block.
- Continue from the block's continuation port.

Required block compilation:

- `if`: compile `true` and `false` branches into `then_steps` and `else_steps`; then continue from `done`.
- `switch`: compile cases/default; then continue from `done`.
- `repeat_times`: compile `loop`; then continue from `done`.
- `repeat_for_each`: compile `loop`; then continue from `done`.
- `while`: compile `loop`; then continue from `done`.
- `repeat_until`: compile `loop` and `timeout`; then continue from `done`.
- `retry`: compile `try` and `failed`; then continue from `success`.
- `try_catch`: compile `try`, `success`, `error`, `finally`; then continue from `done`.
- `fallback`: compile `primary` and `fallback`; then continue from `done`.

Branch paths are inside the block. They must not accidentally fall through into an unrelated outer continuation. The compiler should use explicit traversal context so nested branch compilation can detect loop context and block boundaries.

If a graph shape cannot be represented safely in the current nested `ActionConfig` model, compile must return a blocking validation error rather than silently producing a surprising execution plan.

## Runtime Behavior

The existing runner can continue executing compiled nested `ActionConfig` values.

Runtime must preserve these semantics:

- No next edge means successful path end.
- Failure paths fail unless an explicit recovery branch handles them.
- `last_error` is stored for retry, try/catch, and fallback recovery branches where supported.
- Loop variables remain scoped to loop execution.
- `break_loop` and `continue_loop` affect only the nearest loop body.

Graph run progress can keep using top-level compiled node ids in this scope. A richer branch timeline is useful later but is not required for this implementation.

## UX Guardrails

The UI should help users understand setup requirements before they run.

Logic palette groups:

- Branching: `If`, `Switch`
- Loops: `Repeat Times`, `Repeat For Each`, `While`, `Repeat Until`
- Recovery: `Retry`, `Try/Catch`, `Fallback`
- Control: `Break`, `Continue`, `Stop`
- Safety: `Manual Approval`, `Rate Limit`, `Domain Allowlist`

Node detail should show a port checklist:

- Required missing port: error state.
- Optional missing branch: no-op explanation.
- Missing continuation: "workflow ends successfully here".
- Recovery port missing: explain resulting failure behavior.

Help content should explain:

- What the node does.
- Which ports are required.
- Which ports are optional.
- What happens if an optional port is missing.
- Common setup mistakes.

Connection view should use business language rather than raw ids:

- `If true branch -> Fill login form`
- `After if done -> Take screenshot`
- `Retry failed -> Capture error`
- `Loop body -> Process item`

When adding a logic node, the node should become selected immediately so the inspector explains required links and config.

## Compatibility

Existing graphs should load. When existing graphs violate the new semantics, validation should show clear issues instead of failing deserialization.

Existing Rust `ActionConfig` logic variants remain valid as internal compiled representations and for compatibility. They are not user-facing action picker options in the graph-native builder.

Existing Start-only graphs remain saveable drafts but cannot run because they produce no executable work.

Legacy linear workflow graph generation can continue producing `Start -> action nodes -> End Success`.

## Testing

Frontend tests should cover:

- Logic action configs are hidden from action type selection.
- Logic palette creates graph-native logic nodes.
- `If` exposes `true`, `false`, and `done` ports.
- `Switch` exposes case/default and `done` ports.
- `Try/Catch` exposes `try`, `success`, `error`, `finally`, and `done` ports.
- Node detail shows required/optional/missing port guidance.
- Missing optional branch is shown as no-op, not as blocking UI error.
- Missing continuation is shown as successful end.
- Invalid link attempts are prevented or replace existing link.

Rust/domain tests should cover:

- Multiple edges from one output port are validation errors.
- Multiple edges into one input port are validation errors.
- Self-links and duplicate edges are validation errors.
- Unconfigured action nodes are validation errors for Run/compile.
- `If` can compile with missing `true` or `false` branch and continues through `done`.
- `Switch` compiles branch steps and continues through `done`.
- Loop body ports are required before compile.
- Retry `try` is required; missing `failed` means runtime failure on exhaustion.
- Try/catch `try` is required; missing `error` means runtime failure on try failure.
- Fallback `primary` is required; missing `fallback` means runtime failure on primary failure.
- `break_loop` and `continue_loop` outside loop context are validation errors.
- Unconnected continuation compiles as successful path end.
- Existing Start-only and legacy linear graphs keep expected draft/compatibility behavior.

Command tests should cover:

- `validate_workflow_graph` returns node/edge-specific issues for semantic errors.
- `compile_workflow_graph` rejects graphs with blocking semantic errors.
- `run_workflow` does not start runner when graph validation/compile fails.

Docs updates during implementation:

- `docs/domain/product-model.md`
- `docs/domain/user-visible-invariants.md`
- `docs/domain/workflow-lifecycle.md`
- `docs/domain/execution-semantics.md`
- `docs/architecture/domain.md`
- `docs/contracts/workflow-types.md`
- `docs/contracts/action-configs.md` if internal compiled logic config wording changes.

## Rollout Discipline

Implement this after or alongside the UX/link spec, but keep commits focused.

Recommended phase order:

1. Update graph ports and frontend helpers for `done` continuation ports.
2. Add backend validation for structural link rules.
3. Add backend semantic validation by node type.
4. Update compiler traversal to use block continuation semantics.
5. Update UI guardrails and help text.
6. Update tests and source-of-truth docs.

Do not proceed to implementation until this spec is reviewed and an implementation plan is approved.
