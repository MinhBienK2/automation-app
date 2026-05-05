# Run Error UX And Graph Status Color Design

## Goal

Make workflow Run failures clear enough that users know where the problem is, what happened, and what to fix without leaving the workflow detail screen.

The workflow detail screen should keep the graph as the primary troubleshooting surface. Run errors should map back to canvas nodes or links whenever the backend provides node, edge, step, or run-state context.

## Current Problems

- `RunStatusBar` can show a raw error string, but it does not give enough structure for users to understand whether the error came from graph validation, runtime execution, save failure, or system infrastructure.
- Graph colors overuse green. Default links, selection, running, and completed states can read too similarly.
- The workflow graph panel heading (`Visual Logic` / `Visual Graph`) consumes vertical space without adding useful information on the detail screen.
- A user who presses `Run` should not have to infer the fix from a generic banner or command error.

## UX Principles

- Keep the user on the workflow detail screen after a Run error.
- Separate high-level status from detailed troubleshooting.
- Prefer inline, persistent errors over transient toast messages.
- Use the canvas and inspector to show where to fix the issue.
- Do not attach system errors to graph nodes when there is no reliable node or link id.
- Make color semantic and consistent. Color should reinforce text, not replace it.

## Error Categories

### Blocking Graph Or Config Issue

This occurs before the runner starts.

Examples:

- Visible graph cannot be saved before Run.
- Start node is not connected to executable work.
- Action node is unconfigured.
- Required action field is missing.
- Link shape is ambiguous or invalid.
- Required graph logic branch is missing.
- Unsupported graph semantics prevent compile.

User-facing status:

- Header: `Run blocked`
- Panel severity: `Blocking issue`
- Canvas: affected node or link uses validation issue styling.

The Run should not start. The visible graph must remain editable.

### Runtime Failure

This occurs after the runner starts and a specific step fails.

Examples:

- XPath cannot be found.
- Element is not visible or enabled before timeout.
- Navigation fails or times out.
- JavaScript action throws.
- Runtime variable is missing or has the wrong type.

User-facing status:

- Header: `Run failed`
- Panel severity: `Runtime failure`
- Canvas: completed nodes show success styling; failed node shows runtime failure styling.

When `runState.error.step_id` is present, the UI should select and focus the failed node through panel actions.

### System Or Infrastructure Error

This occurs outside graph semantics or a specific runtime step.

Examples:

- Browser cannot launch.
- Tauri command fails without graph context.
- Database or save command fails.
- Runner infrastructure fails before step context exists.

User-facing status:

- Header: `Could not start run` or `Run failed`
- Panel severity: `System error`
- Canvas: no node or link is highlighted unless the error includes reliable graph context.

System errors should explain the operation that failed and whether the visible graph was executed.

## RunStatusBar

`RunStatusBar` remains in the workflow detail header. It should stay compact and answer one question: what is the current run state?

Recommended labels:

- `Idle`
- `Running step 2`
- `Run blocked`
- `Run failed`
- `Run succeeded`
- `Stopped`
- `Could not start run`

The status bar should not become the primary place for long error copy. It can show a short one-line summary, but detailed troubleshooting belongs in `RunIssuePanel`.

## RunIssuePanel

Add an inline `RunIssuePanel` on the workflow detail screen between `PageHeader` and `WorkflowGraphEditor`.

Layout:

```text
[PageHeader]
Workflow name      Status: Run failed       [Validate] [Run] [Save]

[RunIssuePanel]
Run failed at step 3: Fill Field
Element was not found before the 5000ms timeout.
[Select failed node] [Run again]

[WorkflowGraphEditor]
Canvas / Inspector
```

The panel is an overview and navigation surface. The inspector remains the editing surface.

### Visibility

Show `RunIssuePanel` when at least one of these is true:

- Run command rejects before runner start.
- `graphIssues` contains blocking validation errors after Validate or Run.
- `runState.status` is `failed`.
- `appError` exists and represents a save, command, or infrastructure failure.

Do not show the panel for normal idle, running, success, or stopped states unless there is an unresolved error message.

### Content Model

Each issue should include:

- `severity`: `blocking`, `runtime`, or `system`
- `title`: concise problem summary
- `message`: concrete explanation of what happened
- `node_id`, when available
- `edge_id`, when available
- `step_number`, when available
- `action_type` or action label, when available
- `suggestions`, when useful
- `actions`, derived from context

Suggested actions:

- `Select node`
- `Select link`
- `Select failed node`
- `Validate again`
- `Run again`
- `Save again`

For large validation results, show the first 3 to 5 issues and summarize the rest:

```text
Showing 5 of 12 issues. Run Validate to inspect all highlighted nodes.
```

Do not turn the panel into a full log console.

### Blocking Issue Copy

Example:

```text
Run blocked
Fix 2 issues before running this workflow.

New node is not configured
Select an action type before running.
[Select node]

Start is not connected
Connect Start to the first action.
[Select node]
```

### Runtime Failure Copy

Example:

```text
Run failed at step 3: Fill Field
Element was not found before the 5000ms timeout.

What to check:
- XPath may be wrong.
- The page may not have loaded yet.
- The element may be inside an iframe.

[Select failed node] [Run again]
```

### System Error Copy

Example:

```text
Could not start run
The graph could not be saved, so the visible changes were not executed.

[Save again]
```

## Inspector Integration

The inspector should show issue details for the selected node or selected link.

For selected nodes:

- Existing validation issues remain visible.
- If `runState.error.step_id` matches the selected node, show a `Last run error` section.
- Runtime error details should include step number, action label, and reason.

For selected links:

- Link-specific validation issues remain visible.
- Link errors should explain source, target, and port context when available.

The intended user flow is:

```text
Run
-> Run blocked or failed
-> Read RunIssuePanel
-> Select node/link from panel
-> Inspector opens the relevant item
-> User fixes config or graph structure
-> Validate again or Run again
```

## Graph Color Semantics

Use neutral graph colors by default. Reserve green for successful execution only.

Recommended semantic map:

| State | Node Treatment | Link Treatment | Meaning |
| --- | --- | --- | --- |
| Default | Neutral gray border | Neutral gray stroke | Graph structure only |
| Selected | Cyan/teal focus ring | Cyan/teal stroke | User is editing this item |
| Running | Cyan/blue outline, optional subtle pulse | Cyan/blue active path | Runner is currently here |
| Completed | Green border/check badge | Green stroke | Runner passed through successfully |
| Validation issue | Amber border/badge | Amber stroke | Fix before Run |
| Runtime failed | Red/tomato border/badge | Red/tomato stroke | Runner failed here |
| System error | No graph styling unless context exists | No graph styling unless context exists | Failure is outside graph item context |

Suggested token roles:

- Neutral/default: existing dark border scale, such as `#363636` and `#4d4d4d`
- Selected: cyan/teal accent, compatible with existing Supabase green but visually distinct from success
- Running: cyan/blue active state
- Completed/success: existing Supabase green, such as `#3ecf8e` or `#00c573`
- Validation issue: amber/yellow, such as `#fbbf24`
- Runtime failure: tomato/red, such as `#ff7b72` or `#f87171`

### Priority

When a node or link has multiple states, apply visual priority in this order:

```text
Runtime failed > Validation issue > Running > Selected > Completed > Default
```

Selection can still be visible as a secondary ring when another semantic state wins.

Examples:

- Selected failed node: red failure styling plus a thin selected ring.
- Selected validation issue: amber issue styling plus a thin selected ring.
- Selected completed node: green completed styling plus a thin selected ring.
- Running node: running styling wins over completed styling until the step completes.

### Accessibility

Color must not be the only signal.

Use at least one non-color cue for important run states:

- `Running` badge or active indicator
- Check icon or `Passed` badge for completed nodes
- `Issue` badge for validation errors
- `Failed` badge for runtime failures
- Textual error details in `RunIssuePanel`
- Matching details in the inspector

## Layout Cleanup

Remove the visible graph panel heading that currently shows:

- `Visual Logic`
- `Visual Graph`

The graph editor should keep an accessible region label such as `Visual Graph`, but it does not need a visible heading inside the panel because the workflow detail header already establishes context.

This increases vertical space for the canvas without changing graph behavior.

## Component Boundaries

Recommended frontend boundaries:

- `RunStatusBar`: compact run state summary in the page header.
- `RunIssuePanel`: error summary, suggestions, and navigation actions.
- `WorkflowDetailPage`: owns panel placement between header and graph editor.
- `WorkflowGraphEditor`: owns graph selection, canvas focus, and inspector state.
- `WorkflowGraphInspector`: owns selected node/link issue details.
- `workflowUi.ts`: owns pure helpers for formatting run labels, action labels, and issue copy.

Backend validation remains authoritative. Frontend helpers may organize and label errors, but they must not replace Rust graph validation or runner error state.

## Data Flow

### Run Blocked Before Execution

```text
User clicks Run
-> UI saves visible graph
-> save fails OR run_workflow rejects during validation/compile
-> RunStatusBar shows Run blocked or Could not start run
-> RunIssuePanel shows blocking/system issue
-> Canvas highlights node/link issues when graph context exists
```

### Runtime Failure

```text
User clicks Run
-> UI saves visible graph
-> run_workflow starts runner
-> polling updates RunState
-> runner finishes failed with RunState.error
-> RunStatusBar shows Run failed
-> RunIssuePanel shows failed step/action/reason
-> Canvas highlights completed path and failed node
-> Inspector shows Last run error when failed node is selected
```

### Validate

```text
User clicks Validate
-> validate_workflow_graph returns issues
-> RunIssuePanel shows validation issue summary if errors exist
-> Canvas highlights affected nodes and links
-> Inspector shows selected item issues
```

## Testing Strategy

Frontend tests should cover:

- `RunStatusBar` maps run states to concise labels.
- `RunIssuePanel` renders blocking validation issues with node/link actions.
- `RunIssuePanel` renders runtime failures from `RunState.error`.
- `RunIssuePanel` renders system errors without selecting a node.
- Selecting an issue from the panel updates graph selection and inspector context.
- Graph default links are neutral, completed links are green, failed links are red, validation links are amber, and selected links remain distinguishable.
- The visible `Visual Logic` / `Visual Graph` heading is removed while the editor keeps its accessible region label.

Rust tests should be added only if command or run-state contracts change. This design can start as a frontend presentation change using existing command and run-state shapes.

## Documentation Updates During Implementation

If implemented, update current docs that describe user-visible Run behavior:

- `docs/domain/workflow-lifecycle.md`
- `docs/domain/user-visible-invariants.md`
- `docs/contracts/run-state.md` if run-state shape or labels change
- `docs/architecture/frontend.md` if component ownership changes
- `DESIGN.md` only if shared color tokens or design-system rules change

## Out Of Scope

- Full log console.
- Modal-based run error flow.
- Toast-only error handling.
- Changing Rust run-state shape unless implementation discovers missing context.
- Adding logout or authentication behavior.
- Changing runner execution semantics.
- Replacing backend validation with frontend validation.

## Acceptance Criteria

- Pressing `Run` from workflow detail clearly distinguishes blocked graph/config issues, runtime failures, and system errors.
- Users can navigate from an issue summary to the relevant node or link when context exists.
- Runtime failures show step number, action label, and reason when available.
- System errors do not falsely highlight graph items.
- Default graph structure no longer uses success green.
- Success green is reserved for completed Run state.
- Runtime failure, validation issue, running, selected, and completed states are visually distinct.
- Important states include text or badges, not color alone.
- The visible `Visual Logic` / `Visual Graph` heading is removed to increase usable graph height.
