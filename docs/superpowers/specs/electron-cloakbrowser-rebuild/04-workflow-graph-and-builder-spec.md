# Workflow Graph And Builder Spec

## Purpose

Define the workflow graph model and builder behavior for the Electron rebuild.
The graph remains the primary authoring surface, but its compiled output should
target the new Playwright/CloakBrowser runner contract.

## In Scope

- Graph JSON model.
- Node, edge, port, and viewport semantics.
- Validation.
- Compile-to-run-plan.
- Graph editing behavior.
- Node configuration ownership.
- Debug/run selection model.

## Out Of Scope

- Exact React component implementation.
- Pixel-perfect UI layout.
- Old graph JSON compatibility.
- Rust action config compilation.
- Full action catalog field definitions.

## Product Concepts

The graph belongs to a workflow. It expresses automation logic and references
actions, control flow, variables, and terminal outcomes.

The graph does not own browser identity, proxy, profile, or global run policy.
Those belong to Identity Profile, Environment, and Run Profile.

## Technical Design

### Graph Shape

```json
{
  "schema_version": 1,
  "nodes": [],
  "edges": [],
  "viewport": {
    "x": 0,
    "y": 0,
    "zoom": 1
  },
  "metadata": {}
}
```

### Node Classes

- `start`: single workflow entry point.
- `action`: Playwright/CloakBrowser action node.
- `logic`: branch, switch, loop, retry, try/catch, fallback.
- `variable`: set variable, transform variable, assert output.
- `checkpoint`: manual approval or operator handoff.
- `terminal`: success, failure, stop.
- `subworkflow`: future nested workflow call.

### Ports

Ports must make flow intent visible:

- `in`: normal input.
- `out`: normal continuation.
- `true` / `false`: branch outputs.
- `case:<name>`: switch case outputs.
- `body`: loop body.
- `done`: continuation after control block.
- `error`: error/recovery path.
- `finally`: cleanup path.

Each output port can have at most one outgoing edge unless a future fan-out node
explicitly supports multiple outgoing paths. Each input port can have at most
one incoming edge.

### Validation

Graph validation blocks runs before runner start. It should report issues with
node id, edge id, field, severity, and message.

Validation checks:

- exactly one start node;
- no missing required configs;
- no ambiguous ports;
- no unsupported node types;
- no unreachable executable nodes unless intentionally allowed as drafts;
- loop controls only inside loop bodies;
- domain allowlist nodes or policy references are valid;
- graph compiles to at least one executable action for run.

### Compile-To-Run-Plan

The compiler converts graph JSON into a runner-native run plan, not Rust
`ActionConfig`.

Run plan shape:

```json
{
  "schema_version": 1,
  "workflow_id": "wf_...",
  "graph_version_id": "gv_...",
  "steps": [],
  "node_map": {}
}
```

Nested control flow can compile to nested plan blocks or normalized step graph,
but the runner contract must preserve node ids for event mapping.

### Draft Behavior

Users can save draft graphs with unconfigured nodes. Draft graphs cannot run
until validation passes.

### Debug Model

The new app does not need to keep old "run from beginning through selected step"
semantics. It must provide product-equivalent debugging through one or more of:

- validate selected node;
- dry-run selected node with explicit context requirement;
- run from start to selected node;
- run selected subgraph when dependencies are satisfied.

The chosen debug model must be explicit in UI/UX and Testing specs.

## Interfaces / Contracts

Graph service operations:

- `graph.loadActive(workflowId)`
- `graph.save(workflowId, graph)`
- `graph.validate(workflowId, graph)`
- `graph.compile(workflowId, graph, settingsRefs)`
- `graph.createDraft(workflowId)`

Compiler output must include:

- step ids;
- source node ids;
- action type;
- action config;
- timeout/retry override fields;
- branch/control metadata;
- evidence tags where relevant.

## Data Model

Graph data is stored as versioned JSON in `workflow_graph_versions`.

Node minimum fields:

- id
- type
- label
- position
- config
- ports
- ui metadata

Edge minimum fields:

- id
- source node id
- source port id
- target node id
- target port id
- label metadata

## Error Handling

- Invalid graph JSON returns schema error.
- Validation issues are non-terminal until run is requested.
- Compile failure blocks run and creates validation issue.
- Runtime failures are not graph validation failures, but must map back to graph
  node ids when possible.

## Security / Safety / Audit

- Graph cannot override launch identity fields such as proxy credentials or
  browser profile.
- Domain allowlist enforcement cannot rely only on graph nodes; workspace policy
  and runner checks remain authoritative.
- Manual checkpoint nodes must not be represented as automated challenge bypass.
- Graph changes should be auditable by updated graph version timestamps.

## Testing

Tests must cover:

- graph schema parsing;
- start node validation;
- port uniqueness;
- branch and loop compilation;
- draft save but run block;
- node id preservation in compiled plan;
- validation issue mapping to nodes/edges;
- debug model behavior once chosen.

## Acceptance Criteria

- New workflows can create a start-to-draft graph.
- Graphs can be saved and loaded.
- Valid graphs compile to runner plans.
- Invalid graphs block runs with clear issues.
- Compiled plans preserve node ids for run event display.
- Graph model does not carry old Rust DTO constraints.

## Dependencies

- Product Model Spec.
- Data And Storage Spec.
- Action Catalog And Locator Spec.
- CloakRunner Spec.

## Open Questions

None blocking. The exact node-debugging mode can be finalized in the UI/UX
Feature Parity Spec before implementation planning.
