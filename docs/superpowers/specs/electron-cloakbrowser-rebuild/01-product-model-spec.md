# Product Model Spec

## Purpose

Define the canonical product concepts for the Electron/CloakBrowser rebuild.
Every other child spec must use these names and boundaries.

The new app preserves product intent from the existing system while replacing
the implementation model. The product is an internal authorized browser
automation lab for company-owned production and staging systems. It must support
realistic browser execution, explicit operator control, reproducible identity
settings, and durable run evidence.

## In Scope

- Workspace, Workflow, Workflow Graph, Run Profile, Identity Profile,
  Environment, Variables, Run, Run Event, Artifact, Evidence, and Operator
  Control concepts.
- Ownership boundaries between workflow logic, launch identity, environment
  setup, run policy, and audit output.
- Product-level precedence rules.
- Product-level lifecycle from authoring to execution to evidence review.

## Out Of Scope

- Old SQLite schema compatibility.
- Tauri commands and Rust DTOs.
- Detailed UI layout.
- Detailed database columns.
- Playwright implementation code.
- Cross-platform packaging mechanics.

## Product Concepts

### Workspace

A workspace is the local product container. It owns workflows, reusable identity
profiles, artifacts, run history, app preferences, and local policy settings.

The first release can support one local workspace. The model should not prevent
future multi-workspace support.

### Workflow

A workflow is a named automation definition. It contains product metadata, a
workflow graph, workflow-scoped settings, and references to reusable profiles.

A workflow answers: what business or test process should run?

### Workflow Graph

The workflow graph is the primary authoring surface. It stores nodes, edges,
ports, viewport/editor metadata, node configs, and graph validation state.

The graph answers: which actions and logic run, in what order, under which
branches or loops?

### Run Profile

A run profile is the execution policy for a workflow run. It owns timeout,
retry, retention, concurrency, evidence, logging, and debugging policy.

Run Profile answers: how should the workflow be executed and observed?

### Identity Profile

An identity profile is the coherent browser identity bundle. It owns browser
engine selection, persistent profile path, device class, user agent family,
viewport, locale, timezone, proxy binding, headed/headless policy, and related
browser identity controls.

Identity Profile answers: who or what browser identity is running?

### Environment

Environment is the run setup applied after browser launch and before workflow
logic. It owns permissions, geolocation, download directory, cookies, storage,
headers, and initial variables.

Environment answers: what page/runtime state should exist before graph actions?

### Variables

Variables are named runtime values that can be seeded before a run, mutated by
graph actions, used in templates, and captured in outputs.

Variables are part of the run context, not browser identity.

### Run

A run is one execution instance of a workflow. It has immutable start metadata,
terminal status, references to profiles used, event history, artifacts, and
evidence.

### Run Event

A run event is an append-only event emitted by main process or runner process.
Events include lifecycle, step progress, action traces, issues, artifact
creation, fingerprint verdicts, cancellation, and terminal outcome.

### Artifact

An artifact is file-backed output. Screenshots, downloads, Playwright traces,
videos, logs, and exported evidence packages are artifacts. SQLite stores
metadata and paths; large payloads remain on disk.

### Evidence

Evidence is compact audit metadata suitable for security, trust, anti-abuse, and
production teams. It includes run id, workflow id, allowed target summary,
identity profile id, probe verdict, sanitized proxy label, action trace summary,
artifacts, operator, and timestamps.

### Operator Control

Operator control includes domain allowlists, named test accounts, manual
approval/checkpoint behavior, stop/cancel controls, and export sanitization.

## Technical Design

### Product Ownership Boundaries

```text
Workflow
  -> Graph: automation logic
  -> Run Profile: execution policy
  -> Identity Profile reference: browser/network/session identity
  -> Environment: run setup
  -> Variables: initial runtime values
  -> Evidence Policy: capture and export expectations
```

Identity Profile and Environment must not blur:

- Identity Profile controls browser identity and launch context.
- Environment controls runtime setup inside the browser context.

Run Profile and Workflow Graph must not blur:

- Run Profile controls execution policy.
- Workflow Graph controls automation logic.

### Precedence

```text
App Preference < Workspace Policy < Workflow Defaults < Run Override < Graph Action
```

App preferences affect local editing or presentation. They should not change run
results.

Workspace policy can enforce constraints such as allowed domains and maximum
concurrency.

Workflow defaults define normal behavior for a workflow.

Run overrides are temporary and do not mutate saved workflow settings.

Graph actions override behavior only when the capability is safe and valid at
runtime. Launch-level identity fields are not graph-action concerns.

### Lifecycle

```text
Create/Edit Workflow
  -> validate graph and settings
  -> compile graph to run plan
  -> create run record
  -> start runner process execution
  -> stream run events
  -> create artifacts and evidence
  -> persist terminal status
  -> inspect or export evidence
```

## Interfaces / Contracts

All child specs should use these canonical terms:

- `workspace`
- `workflow`
- `workflow_graph`
- `run_profile`
- `identity_profile`
- `environment`
- `variable`
- `run`
- `run_event`
- `artifact`
- `evidence`
- `operator_policy`

Public API names may use camelCase in TypeScript, but the concept names must map
one-to-one.

## Data Model

The Product Model spec defines concept ownership only. The Data And Storage Spec
owns table names, columns, indexes, JSON shape, migrations, and file layout.

Minimum durable entities:

- Workspace metadata.
- Workflows.
- Workflow graph versions.
- Run profiles.
- Identity profiles.
- Environments.
- Runs.
- Run events.
- Artifacts.
- Evidence records.

## Error Handling

Product errors should be categorized as:

- `validation`: graph, settings, profile, environment, or policy is invalid.
- `startup`: app, storage, runner, or browser cannot start.
- `runtime`: an action or page operation fails during execution.
- `policy`: allowlist, identity coherence, or operator control blocks the run.
- `cancellation`: operator or timeout stops execution.
- `system`: unexpected app, OS, filesystem, or process failure.

Every error shown to users must include a readable message and enough context to
locate the workflow, node, profile, or run area that failed.

## Security / Safety / Audit

- The product is scoped to owned or explicitly authorized targets.
- Sensitive workflows must be bounded by domain allowlists and operator policy.
- Identity and evidence records must avoid raw proxy passwords, secrets, and
  unnecessary storage values.
- Manual checkpoints and challenge handling are handoff/evidence points, not
  automated challenge solving.
- Evidence must be reproducible enough for internal security and production
  teams to investigate detection gaps.

## Testing

Tests for product model should cover:

- Concept serialization.
- Precedence merge behavior.
- Boundary validation between run profile, identity profile, and environment.
- Error category mapping.
- Evidence sanitization at the product model level.

## Acceptance Criteria

- All child specs use the same product concept names.
- No child spec redefines identity, environment, or run profile ownership.
- Product precedence is used by Storage, Runner, UI, and Testing specs.
- Feature parity matrix maps old capabilities into these concepts.
- No implementation plan starts before Product Model conflicts are resolved.

## Dependencies

- Master spec.

## Open Questions

None blocking. Future multi-workspace support can be designed after the
single-workspace rebuild reaches parity.
