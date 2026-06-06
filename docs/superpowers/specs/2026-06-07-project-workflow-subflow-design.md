# Project Workflow and Subflow Design

Date: 2026-06-07

## Status

Draft for user review.

## Scope

This design introduces a project-level authoring model with:

- Projects as the top-level container.
- Project Settings as the owner of browser environments.
- Workflows as runnable top-level automations.
- Subflows as reusable graph fragments available to workflows in the same project.
- A `Call Subflow` graph node for workflow-to-subflow reuse.

This design intentionally keeps the first implementation simple:

- No subflow versioning in the MVP.
- No `Call Workflow` feature.
- No `Module Test Context`.
- No direct standalone subflow run mode in the MVP.
- No cross-project subflow reuse in the MVP.

## Problem

Large workflow graphs become hard to manage when repeated behavior such as login, account setup, search, checkout, evidence capture, or cleanup lives directly inside every runnable workflow. Users need a way to split repeated graph logic into smaller reusable units without turning every workflow into a dependency target.

The product also needs a cleaner place for browser fingerprint, session, profile, proxy, timezone, locale, and related launch settings. These settings currently behave like workflow-owned launch configuration, but the desired model is project-centered: a project should provide shared or isolated environments that workflows can select.

## Goals

- Let one project contain many runnable workflows at the same level.
- Let workflows reuse subflows without allowing workflows to call other workflows.
- Keep reusable logic explicit through a `Call Subflow` graph node.
- Put fingerprint/session/profile/proxy configuration under Project Settings.
- Let each workflow select a project environment at creation time or from settings.
- Allow users to create ordinary test workflows that call subflows under a chosen environment.
- Keep the MVP simple by avoiding versioning and direct subflow test contexts.
- Preserve a path to add subflow versioning later if real usage requires it.

## Non-Goals

- Do not let a workflow call another workflow.
- Do not make every workflow reusable by default.
- Do not add subflow version pinning in the MVP.
- Do not add a separate module test context concept.
- Do not give subflows their own browser identity, profile, proxy, or session settings.
- Do not support subflows shared across projects in the MVP.
- Do not add parallel execution, cross-workflow orchestration, or workflow dependency scheduling.

## Product Model

### Project

A project is the top-level workspace for a related set of browser automation work.

It owns:

- Project metadata.
- Project Settings.
- Project Environments.
- Workflows.
- Subflows.
- Runs and evidence associated with workflows in the project.

### Project Settings

Project Settings is the project-level configuration area. Its first required section is Environments.

Recommended sections:

```text
Project Settings
  General
  Environments
  Defaults
```

The MVP can start with General and Environments only.

### Project Environment

A Project Environment is a reusable browser launch identity and session configuration.

It should contain:

```text
id
name
description
is_default
fingerprint identity / persona
profile/session mode
profile directory
proxy settings
timezone / locale / geoip
webrtc policy
headless
humanize / human preset
created_at
updated_at
```

Project creation should create one default environment automatically.

When a user creates a workflow, the UI should offer:

```text
Use Project Default Environment
Use Existing Environment
Create Isolated Environment
```

The selected environment is stored on the workflow as `environment_id`.

### Workflow

A workflow is a runnable top-level graph. Workflows are peers within a project.

A workflow:

- Can be run directly.
- Can be scheduled.
- Produces run history and evidence.
- Selects one project environment.
- Can contain `Call Subflow` nodes.
- Cannot be called by another workflow.
- Cannot be used as a subflow.

Users can create test workflows by convention, for example:

```text
Workflow: Test Login
  Start
  -> Call Subflow: Login
  -> Assert login_status = success
  -> End
```

This avoids a special module test context while still letting users test reusable logic in a realistic runnable graph.

### Subflow

A subflow is a reusable graph unit scoped to one project.

A subflow:

- Has its own graph.
- Has a name and optional description/tags.
- Can declare expected inputs and outputs.
- Can be called from any workflow in the same project.
- Inherits browser/session/environment/runtime context from the calling workflow.
- Does not own schedules, run history, evidence, or browser settings by itself.
- Does not run directly in the MVP.

Subflows are reusable implementation units, not runnable product scenarios. If a user wants to test a subflow, they create or open a workflow that calls it.

### Call Subflow Node

`Call Subflow` is a workflow graph node that references a subflow in the same project.

Recommended config:

```ts
type CallSubflowGraphConfig = {
  subflow_id: string;
  input_mapping: Array<{
    input_name: string;
    value: string;
  }>;
  output_prefix?: string | null;
};
```

The MVP should not include `subflow_version`.

## Runtime Semantics

When a workflow runs, the runner launches using the workflow's selected Project Environment.

When execution reaches `Call Subflow`:

1. The compiler resolves `subflow_id` within the same project.
2. The compiler validates the referenced subflow graph.
3. The compiler expands the subflow graph into executable steps.
4. The subflow steps run inside the same browser context, output store, run policy, and evidence scope as the calling workflow.
5. Run trace labels preserve nesting so users can see where the step came from.

Suggested trace label format:

```text
Checkout E2E > Login > Fill username
Checkout E2E > Login > Submit
```

Subflows must not create a new browser session when called.

## Editing Semantics Without Versioning

The MVP has no subflow versioning. A `Call Subflow` node always points to the current saved subflow graph.

This means:

- Editing and saving a subflow changes future runs for every workflow that calls it.
- Existing completed run evidence stays unchanged.
- New runs use the latest saved subflow.
- Users need visibility before making broad changes.

The UI should show usage information in the subflow editor:

```text
Used by 5 workflows
```

Before saving a subflow used by workflows, the UI should warn:

```text
This subflow is used by 5 workflows. Saving changes will affect their next run.
```

The MVP should include `Duplicate Subflow` so users can make a safe copy before risky edits.

Versioning can be added later by introducing published subflow revisions and changing `Call Subflow` from `subflow_id` to `subflow_id + revision_id`.

## Validation Rules

Project validation:

- A project must have one default environment.
- Environment names should be non-empty.
- A workflow must reference an environment in the same project.

Workflow validation:

- `Call Subflow` must reference an existing subflow in the same project.
- Workflow graphs cannot contain `Call Workflow`.
- Workflow graphs cannot reference subflows from another project.
- A workflow cannot run if a referenced subflow has blocking validation errors.

Subflow validation:

- A subflow graph uses the same graph validation rules as workflows, except it does not need its own browser environment.
- A subflow should have a valid start path.
- A subflow cannot include project or workflow launch settings.
- In the MVP, a subflow cannot call another subflow. This avoids nested dependency cycles and keeps compiler behavior simple.

Future nested subflow support can be added with depth limits and cycle detection after the first model is stable.

## UX Structure

Recommended project navigation:

```text
Project
  Overview
  Workflows
  Subflows
  Runs
  Evidence
  Settings
```

Recommended workflow list:

```text
Workflows
  New Workflow
  name
  environment
  latest run
  actions: open, run, settings, duplicate, export, delete
```

Recommended subflow list:

```text
Subflows
  New Subflow
  name
  used by
  updated
  actions: open, duplicate, delete
```

Recommended workflow creation flow:

```text
Name
Environment:
  - Use Project Default Environment
  - Use Existing Environment
  - Create Isolated Environment
```

Recommended graph authoring:

- Workflow graph palette includes `Call Subflow`.
- Subflow graph palette does not include `Call Subflow` in the MVP.
- Subflow editor shows callers and duplicate action.
- Workflow editor shows selected environment in settings or header metadata.

## Persistence Sketch

The exact schema can be refined during implementation, but the ownership should be:

```text
projects
project_environments
workflows
subflows
runs
run_steps
```

Suggested relationships:

```text
project_environments.project_id -> projects.id
workflows.project_id -> projects.id
workflows.environment_id -> project_environments.id
subflows.project_id -> projects.id
runs.workflow_id -> workflows.id
```

The workflow graph stores `Call Subflow` nodes by `subflow_id`.

The subflow graph can reuse the existing `WorkflowGraph` shape where possible:

```ts
type Subflow = {
  id: string;
  project_id: string;
  name: string;
  description: string;
  graph: WorkflowGraph;
  created_at: string;
  updated_at: string;
};
```

## Import and Export

MVP export should be project-aware.

Recommended behavior:

- Exporting one workflow should include the workflow graph and referenced subflows by default.
- Importing a workflow into a project should create missing subflows or remap to existing subflows through a preview step.
- Exporting an entire project should include workflows, subflows, and selected Project Settings sections.
- Sensitive environment fields such as proxy passwords must be sanitized in external packages.

If project export is not part of the first implementation, workflow export should block or warn when a workflow references subflows that cannot be included.

## Migration Direction

Current single-workflow installations can migrate into one default project.

Suggested migration:

- Create a default project.
- Move existing workflows into that project.
- Convert each workflow's current browser launch settings into a project environment.
- Set each migrated workflow's `environment_id` to its migrated environment.
- Do not create subflows automatically.

A later refactor tool can help users extract selected graph nodes into a new subflow.

## Implementation Phases

### Phase 1: Project and Environment Foundation

- Add Project entity.
- Add Project Settings with Environments.
- Move or mirror workflow browser launch settings into project environments.
- Let workflows select an environment.
- Keep existing workflow run behavior working through selected environment.

### Phase 2: Subflow Authoring

- Add Subflows list and editor.
- Persist subflow graphs.
- Add subflow usage lookup.
- Add Duplicate Subflow.

### Phase 3: Call Subflow Execution

- Add `Call Subflow` graph node.
- Validate subflow references.
- Compile called subflow steps into workflow run plans.
- Add nested trace labels.
- Block cross-project references and missing subflows.

### Phase 4: Import, Export, and Extraction Tools

- Include referenced subflows in workflow package export.
- Add project export/import.
- Add extract-selected-nodes-to-subflow tooling.

### Phase 5: Optional Later Versioning

Only add versioning after users need stable pinned dependencies.

Potential future shape:

```text
subflows
subflow_revisions
Call Subflow: subflow_id + revision_id
```

This is intentionally outside the MVP.

## Testing Strategy

Focused tests should cover:

- Project environment creation and default selection.
- Workflow creation with default, existing, and isolated environments.
- Workflow run uses the selected environment.
- Subflow CRUD and usage counts.
- `Call Subflow` validation for missing, cross-project, and invalid subflows.
- Compiler expansion of called subflow steps.
- Run trace labels for nested subflow steps.
- Deleting a subflow used by workflows is blocked or confirmed with clear impact.
- Export behavior for workflows that reference subflows.

## Final Decisions

- Keep workflows peer-level: all workflows in a project are peers and runnable.
- Do not allow workflow-to-workflow calls.
- Use `Subflow` for reusable graph logic.
- Use `Call Subflow` as the only reuse node in workflows.
- Put fingerprint/session/profile/proxy in `Project Settings > Environments`.
- Do not add subflow versioning in the MVP.
- Do not add `Module Test Context`.
- Test subflows through ordinary workflows created by the user.
