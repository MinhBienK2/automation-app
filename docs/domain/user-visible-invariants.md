# User-Visible Invariants

Preserve these unless the task explicitly changes them.

## Workflow Editing

- Blank workflow names are rejected.
- Opening a workflow shows the visual graph builder as the only workflow authoring surface.
- New workflows have a default graph.
- Running from the graph workspace saves the visible graph before execution.
- Graph edges are connected through explicit ports so branch intent is visible.
- Graph validation issues are shown before graph execution. Unsupported graph semantics must be reported clearly.
- Manual approval and rate-limit graph nodes are safe control points; the app must not present them as CAPTCHA, anti-bot, spam, or account-creation bypass tools.

## UI Behavior

- Workflow list and detail remain separate screens.
- User-facing layout and styling changes follow `DESIGN.md`.
- Command errors are shown as readable messages.
- Running a graph shows status in the page header and reflects graph progress through canvas node state.

## Command Boundary

- Tauri command errors serialize as `{ message, field }`.
- TypeScript invoke payload keys match Rust command parameters.
- TypeScript and Rust DTO shapes remain compatible.

## Runner Behavior

- Full runs execute the compiled saved graph.
- Stop returns a stopped state immediately; active-run ownership clears after the runner finishes cancellation.
- Browser sessions remain open after success, failure, and stop.
- Failures identify the failed step when possible.
- Graph runs use the same run-state contract as workflow runs. When compiled graph node ids are present in run state, the canvas reflects current/completed/failed nodes.

## Persistence

- Workflow summaries include the legacy `step_count` field until the summary contract is renamed.
- Saved workflow graph JSON is keyed by workflow id.
- Graph saves touch the parent workflow `updated_at`.
