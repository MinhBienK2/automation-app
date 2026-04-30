# Advanced Visual Logic Graph Builder Design

## Status

Approved for specification on 2026-04-30.

This document designs a complete visual logic graph builder for Workflow Automation Manager. It is a product and architecture specification, not an implementation plan.

## Problem

The current workflow builder is centered on ordered steps. That model works for simple browser automation, but it becomes hard to understand and maintain when workflows need branching, loops, retries, recovery paths, reusable subflows, or human checkpoints.

The existing action taxonomy already includes logic actions such as `if_condition`, `repeat_times`, `repeat_for_each`, `retry_block`, and `stop_workflow`. The runner also has execution support for nested action configs. The missing product layer is an editable visual graph that lets users design, validate, debug, and run complex logic without editing JSON or mentally reconstructing nested steps from a flat form.

## Goals

- Make the Logic group usable for complex automation through an editable diagram/canvas.
- Treat the visual graph as the authoring source of truth.
- Compile the graph into an executable plan compatible with the existing runner architecture.
- Support advanced logic patterns: if/else, switch, loops, retry, try/catch/finally, fallback paths, break, continue, subworkflows, variables, and assertions.
- Provide graph validation before a run starts.
- Provide a run timeline that maps execution back to graph nodes, branches, loop iterations, and errors.
- Add safety and compliance guardrails for sensitive automation scenarios.

## Non-Goals

- Do not build CAPTCHA bypass, bot-detection evasion, anti-spam bypass, mass account creation on third-party platforms, or spam automation.
- Do not make proxy/profile features imply stealth or abuse. They are for authorized testing, network routing, and repeatable browser environments.
- Do not replace the runner with a graph-native execution engine in the first implementation. The graph compiles to an executable plan first.
- Do not require collaborative editing, cloud sync, or multi-user permissions for the first version.

## Product Model

The product model gains a graph authoring layer:

```text
Editable Workflow Graph
  -> validate graph
  -> compile to executable plan
  -> execute through runner
  -> map progress back to graph timeline
```

The graph is the user-facing source of truth. The executable plan is a generated representation used by validation, persistence compatibility, and runner execution.

## UI Structure

Workflow detail should gain a visual builder layout:

```text
Left Palette        Canvas                         Right Inspector
- Actions           Editable graph                 Node config
- Logic             Nodes and edges                Conditions
- Data              Groups and subflows            Variables
- Browser           Zoom, pan, minimap             Validation
- Session
- Network
- Reliability

Bottom Panel
- Graph errors
- Output inspector
- Run timeline
- Logs and screenshots
```

The existing workflow list/detail separation remains. The graph editor becomes the primary workflow detail authoring experience when this feature is enabled.

## Canvas Behavior

The canvas supports:

- Dragging nodes from the palette.
- Moving nodes.
- Connecting output ports to input ports.
- Deleting nodes and edges.
- Duplicating nodes.
- Multi-select.
- Grouping nodes into visual blocks.
- Collapsing and expanding groups.
- Zoom and pan.
- Minimap.
- Search by node label, action type, output name, or variable name.
- Validation badges on nodes and edges.
- Unsaved changes indicator.
- Keyboard shortcuts for common edits.

Edges display semantic labels such as `true`, `false`, `case`, `default`, `loop`, `done`, `success`, `error`, and `finally`.

## Node Model

Graph nodes use a shared shape:

```ts
type GraphNode = {
  id: string;
  type: GraphNodeType;
  label: string;
  position: { x: number; y: number };
  config: unknown;
  ports: GraphPort[];
  groupId?: string | null;
};
```

Edges connect ports:

```ts
type GraphEdge = {
  id: string;
  sourceNodeId: string;
  sourcePort: string;
  targetNodeId: string;
  targetPort: string;
  label?: string;
  condition?: WorkflowCondition | null;
};
```

The workflow stores graph metadata:

```ts
type WorkflowGraph = {
  version: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  viewport: { x: number; y: number; zoom: number };
};
```

The first graph version should be explicit, for example `version: 1`, so future migrations can evolve graph shape safely.

## Node Groups

### Start And End

- `start`: exactly one per graph.
- `end_success`: terminal success.
- `end_failure`: terminal failure with optional reason.

### Action

Action nodes wrap existing browser actions such as navigate, wait, input, click, scroll, extract, screenshot, tabs, frames, dialogs, downloads, storage, JavaScript, and network actions.

Each action node owns one `ActionConfig` variant and reuses existing config forms where possible.

### Logic

Logic nodes control flow:

- `if`: one input, `true` and `false` outputs.
- `switch`: one input, one output per case plus `default`.
- `repeat_times`: one input, `loop` and `done` outputs.
- `repeat_for_each`: one input, `item` and `done` outputs.
- `repeat_until`: one input, `loop`, `done`, and `timeout` outputs.
- `while`: one input, `loop` and `done` outputs.
- `break_loop`: exits the nearest loop.
- `continue_loop`: skips to the next loop iteration.
- `stop_workflow`: stops with success or failure.

### Error Handling

Error handling nodes model recovery:

- `try_catch`: `try`, `error`, and optional `finally` paths.
- `retry`: attempts a connected path multiple times.
- `fallback`: tries multiple paths until one succeeds.

### Data

Data nodes manage variables and outputs:

- `set_variable`.
- `transform_variable`.
- `assert_output`.
- `map_output`.
- `merge_data`.
- `return_value`.

### Subworkflow

Subworkflow nodes allow reuse:

- `run_subworkflow`: calls another workflow.
- Input mapping binds parent variables, outputs, row data, or secrets into child workflow inputs.
- Output mapping copies child outputs back to parent variables or outputs.

### Session, Profile, And Network

These nodes expose existing authorized environment controls:

- `use_profile`.
- `save_session`.
- `load_session`.
- `set_cookie`.
- `clear_cookies`.
- `set_secret`.
- `use_proxy`.
- `set_user_agent`.
- `set_viewport`.
- `set_geolocation`.
- `set_extra_headers`.
- `grant_permission`.

The UI copy and validation must describe these as testing and environment controls, not evasion controls.

### Human Verification And Guardrails

Human verification nodes support compliant interruption:

- `detect_challenge`: detects configured challenge text/patterns.
- `pause_for_human`: pauses and surfaces instructions.
- `resume_when_condition`: resumes after a condition is met.
- `manual_approval`: requires user confirmation before continuing.
- `rate_limit`: enforces delay and max action counts.
- `domain_allowlist`: restricts the workflow to allowed domains.

## Condition Builder

All condition-driven nodes use one shared condition builder.

The builder follows this structure:

```text
When [Source] [Field] [Operator] [Value] [Timeout]
```

Supported sources:

- Page: URL, title, visible text.
- Element: XPath, visibility, existence, enabled/disabled state, text, count.
- Output: named output, existence, emptiness, equality, contains, regex match.
- Variable: named variable, string comparison, numeric comparison, regex match.
- Loop: item value, index, number, total.
- Previous step: success, failure, error reason.
- Time: elapsed time, current time window.
- Network: request seen, response seen, status code.

Operators:

- exists.
- does not exist.
- visible.
- hidden.
- equals.
- not equals.
- contains.
- not contains.
- matches regex.
- greater than.
- greater than or equal.
- less than.
- less than or equal.
- empty.
- not empty.
- changed.

The condition builder must emit structured data, not raw JavaScript.

## Loop Variables

Loop nodes expose scoped variables:

- `{{loop.index}}`: zero-based index.
- `{{loop.number}}`: one-based iteration number.
- `{{loop.total}}`: total count when known.
- `{{item}}`: current item value for `repeat_for_each`.
- `{{item.index}}`: item index.
- `{{item.value}}`: current item value.

Variables from inner loops shadow outer loop variables only inside the nested scope. The output inspector should show current scope during execution.

## Graph Validation

Validation runs before save and before run.

Required validation:

- Exactly one start node.
- All non-terminal nodes have at least one valid outgoing edge unless their semantics allow terminal behavior.
- Every connected port exists on its source or target node.
- No unreachable nodes unless explicitly disabled.
- No cycles except through loop nodes.
- Loop nodes require a max attempt count, timeout, or bounded source.
- `while` and `repeat_until` require a stop condition and a max attempts or timeout guard.
- `break_loop` and `continue_loop` must appear inside a loop scope.
- Subworkflow references must point to an existing workflow.
- Subworkflow input/output mappings must reference valid names.
- Required action config fields must pass existing domain validation.
- Sensitive nodes such as manual approval, rate limit, and domain allowlist must be valid when required by templates or policy.

Validation should produce node-level and graph-level errors. The UI should block execution on errors and allow saving drafts with warnings when safe.

## Graph Compiler

The compiler converts graph structure into an executable plan.

Compilation responsibilities:

- Topologically traverse from `start`.
- Convert action nodes to existing `ActionConfig` variants.
- Convert `if` to `IfCondition` where possible.
- Convert `repeat_times`, `repeat_for_each`, and `retry` to existing nested action configs where possible.
- Represent advanced nodes such as `switch`, `repeat_until`, `try_catch`, `fallback`, `break_loop`, `continue_loop`, and `run_subworkflow` in a new executable plan layer when existing `ActionConfig` cannot represent them cleanly.
- Preserve node ids in compiled metadata so run progress can map back to the diagram.
- Emit compile errors for ambiguous graph paths.

The compiler should be deterministic. The same graph should always produce the same executable plan.

## Runner Integration

The first implementation should avoid rewriting the browser runner.

Execution path:

```text
Graph
  -> compiled executable plan
  -> existing runner action execution
  -> progress events with graph node metadata
```

Existing runner action modules remain responsible for browser interaction. New orchestration semantics can live above action dispatch, where the current runner already handles inline steps for logic actions.

Progress events should include graph metadata when present:

- graph node id.
- edge id or branch label.
- loop id.
- iteration index.
- parent execution path.
- output changes.

## Run Timeline

The run timeline is a tree that mirrors graph execution:

```text
Start
Navigate success
If logged_in == false -> true
  Input username success
  Input password success
  Click login success
Repeat For Each posts
  item 1 success
  item 2 success
  item 3 failed
Try/Catch -> error
  Screenshot success
  Stop failure
```

The canvas should also show live execution state:

- Current node highlight.
- Completed node state.
- Failed node state.
- Taken branch highlight.
- Loop iteration badge.
- Error badge with short reason.

The timeline should link back to the node inspector and output inspector.

## Output Inspector

The output inspector shows:

- Current variables.
- Captured outputs.
- Loop scope.
- Secrets as redacted values.
- Output changes by node.
- Template autocomplete candidates for fields that support `{{variable}}`.

Templates should remain explicit. The UI should not silently infer variable names.

## Safety And Compliance

The product should support authorized automation and actively avoid abuse-oriented flows.

Required safeguards:

- Human verification nodes pause for user action; they do not bypass challenges.
- Proxy/profile copy describes authorized testing and environment routing only.
- Domain allowlist node can restrict sensitive workflows to approved domains.
- Rate limit node can enforce safe pacing.
- Manual approval node can require confirmation before sensitive actions.
- Audit logs record graph runs, branches, approvals, and failures.
- Templates for account creation, commenting, messaging, or social activity must be limited to owned systems, test environments, or user-authorized accounts.
- The UI should not provide stealth, anti-detection, CAPTCHA bypass, spam, or mass-account wording.

## Persistence

Persist graph data separately from existing step rows or behind a versioned graph field. The chosen implementation must preserve existing workflows.

Migration requirement:

- Existing linear workflows can be represented as a graph with `start -> step nodes -> end_success`.
- Existing workflow steps remain readable.
- Graph workflows compile into executable plans without requiring users to manually rebuild old workflows.

## Testing Strategy

Frontend tests:

- Graph reducer/store operations: add, move, connect, delete, duplicate, group.
- Node inspector updates config correctly.
- Condition builder emits structured conditions.
- Validation reports node and graph errors.
- Compiler output is deterministic.
- Existing workflows render as linear graphs after migration.
- Run timeline renders branch, loop, and failure paths.

Rust/domain tests:

- Executable plan validation.
- Compiler-compatible payload serde.
- Runner orchestration for advanced logic semantics.
- Progress metadata serialization.
- Existing command API compatibility.

End-to-end/manual checks:

- Build a workflow with if/else.
- Build a loop with loop variables.
- Build retry and try/catch recovery.
- Run and verify canvas highlights current node.
- Verify timeline points to the failing nested node.
- Verify secrets are redacted in summaries and output inspector.
- Verify human verification pauses instead of bypassing.

## Phased Delivery

The complete product is large, so implementation should be staged while preserving the final architecture.

1. Add graph schema, storage strategy, and migration from linear steps.
2. Build editable canvas shell with palette, nodes, edges, minimap, zoom, and inspector.
3. Support action nodes and config editing.
4. Support `if`, `switch`, and the shared condition builder.
5. Support loop nodes and loop variables.
6. Support retry, try/catch/finally, and fallback.
7. Build graph validation and compile-to-plan.
8. Map runner progress to graph timeline and canvas highlights.
9. Add output inspector and template autocomplete.
10. Add subworkflow node and input/output mapping.
11. Add profile/proxy/session manager surfaces for authorized testing.
12. Add human verification, manual approval, rate limit, domain allowlist, and audit log.
13. Add templates and guided examples for safe, authorized automation.

## Implementation Defaults

Implementation planning should start from these defaults:

- Store graph JSON in a versioned persistence shape that is separate from existing `workflow_steps` rows. A dedicated graph table is preferred so existing linear workflow persistence remains compatible.
- Keep canonical graph validation and compile-to-plan behavior on the Rust side, close to commands, domain validation, and runner execution. TypeScript can mirror fast client-side validation for UX, but backend validation remains authoritative.
- Use a proven React graph/canvas library unless implementation planning finds a blocking mismatch with the design system or Tauri runtime. Building a custom graph engine is not the default.
- Keep the current step list concept as an outline/timeline surface, not the primary editor. The canvas is the primary authoring surface.

The design assumes the graph editor is the primary authoring surface and the existing runner remains the browser execution engine.
