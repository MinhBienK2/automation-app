# Repository Audit Remediation Design

Date: 2026-05-07

## Status

Draft from full-repo audit on 2026-05-07. This spec captures the remediation
work needed for the security, runtime semantics, UI/UX, command-surface,
contract, and maintainability issues found during the audit.

## Summary

The product is already centered on a graph-first workflow builder with a
workflow settings surface and a Rust runner. The core graph validation and
compile path are strong, and the Rust domain tests cover a meaningful amount of
behavior.

The main gaps are not isolated syntax defects. They are contract and product
truth gaps:

- the desktop shell exposes a broader local file write surface than the product
  needs;
- several Workflow Settings fields are persisted and presented as active
  behavior, but the runner does not apply them;
- batch and duplicate command paths still rely on legacy ordered steps while
  the product model is graph-first;
- one graph editor interaction has conflicting temporary and persistent pan
  state;
- the frontend action type contract is narrower than the Rust action enum;
- large files are accumulating unrelated orchestration responsibilities.

The remediation should be staged so high-risk security and behavior-truth fixes
land first, while larger refactors happen only where they reduce risk for the
work already being changed.

## Goals

- Reduce Tauri filesystem and fixture-command risk without breaking export.
- Make Workflow Settings truthful: every visible setting either affects runtime
  behavior or is explicitly removed from the active product surface.
- Align batch, duplicate, import, and export behavior with the graph-first
  workflow model.
- Fix the pan-mode keyboard/toolbar interaction.
- Remove avoidable TypeScript/Rust action contract drift.
- Shrink high-churn files along natural ownership boundaries when touching
  those areas.
- Add focused tests for each behavioral fix.
- Keep docs accurate for changed product behavior and command contracts.

## Non-Goals

- Do not redesign the visual appearance of the app.
- Do not introduce a scheduler service in this remediation unless trigger
  settings are explicitly promoted to active behavior.
- Do not remove legacy database tables in the first pass.
- Do not rewrite the runner action system wholesale.
- Do not add new automation action types beyond contract alignment.
- Do not present proxy, browser profile, headless mode, or challenge policy as
  stealth, anti-detection, CAPTCHA bypass, spam, or account-control bypass
  features.

## Recommended Approach

Use a staged remediation plan instead of a single broad rewrite.

Option A: patch only the failing test and obvious UI issues. This is fast but
leaves product behavior misleading and security risk unchanged.

Option B: rewrite the workflow runtime and UI architecture in one pass. This can
produce cleaner boundaries, but it creates too much regression risk because the
runner, graph compiler, settings model, import/export, and UI would all move at
once.

Option C: staged remediation by risk and ownership. First lock down security and
truthful runtime behavior. Then align graph-first command paths. Then clean up
contracts and file boundaries. This is the recommended path because each slice
has clear acceptance criteria and can be tested independently.

## Workstream 1: Tauri Security Hardening

### Problem

The app currently grants `fs:allow-write-text-file` for every path and disables
CSP. The `generate_fixture` command writes an HTML fixture to any path supplied
by the frontend after only checking that the string is non-empty.

This is wider than the product needs. Normal export uses a native save dialog
and writes the selected package JSON. Fixture generation is a developer/test
utility and should not be available as an unrestricted production command.

### Design

Tighten the desktop capability model:

- Replace the global `path: "**"` write permission with the narrowest scope
  compatible with user-selected export files.
- Prefer the Tauri dialog/save flow plus scoped filesystem permission instead of
  arbitrary frontend-supplied paths.
- Reintroduce a CSP compatible with the app's local assets and Tauri runtime.
- Remove `generate_fixture` from the production invoke handler, or gate it
  behind a debug-only feature/build configuration.
- If fixture generation remains available in development, restrict output to a
  known application fixture directory and reject absolute paths, parent
  traversal, and non-HTML fixture names.

### Acceptance Criteria

- Export package still works through the native save dialog.
- Production builds cannot call `generate_fixture`.
- A compromised renderer cannot write arbitrary filesystem paths through the
  shipped default capability.
- CSP is no longer `null`.
- Tests cover fixture path rejection or verify the command is unavailable in
  production builds.

### Tests And Checks

- Frontend export package test for successful save-dialog write.
- Rust command test for fixture path validation when the command is compiled.
- `npm test -- --run`
- `npm run build`
- `cd src-tauri && cargo test`
- `cd src-tauri && cargo clippy --all-targets --all-features`

## Workstream 2: Workflow Settings Runtime Truth

### Problem

Workflow Settings contains fields that users reasonably expect to change run
behavior:

- maximum workflow duration;
- browser retention;
- browser headless default;
- batch concurrency limit;
- batch headless default;
- stop batch on first failed row;
- trigger mode and trigger policies.

The audit found that several of these are persisted and validated but not
applied by the runner or command paths. This makes the UI misleading and creates
business risk because operators can believe a workflow is headless, duration
capped, scheduled, or closing browsers when it is not.

### Design

Classify every Workflow Settings field as either active now or planned later.

Active now:

- `execution.default_action_timeout_ms`
- `execution.default_retry_attempts`
- `execution.default_retry_interval_ms`
- `execution.max_workflow_duration_ms`
- `execution.browser_retention`
- `execution.batch_concurrency_limit`
- `execution.batch_headless`
- `execution.batch_stop_on_first_failed_row`
- `browser.headless`
- current browser launch fields already applied by `WorkflowBrowserConfig`

Planned later:

- trigger scheduling modes and policies, unless a scheduler service is added in
  the same implementation slice.

For active fields, wire settings into the backend run path:

- Load workflow settings before building runner options.
- Extend browser launch config or runner options with headless/headed behavior.
- Apply maximum workflow duration through the same cancellation path as manual
  stop, while returning a clear timeout failure.
- Apply browser retention as the default terminal policy, with terminal graph
  nodes allowed to override when they explicitly declare close/retain behavior.
- Apply batch defaults when the batch request omits explicit values.
- Implement batch stop-on-first-failed-row.
- Implement concurrency only if the runner/session model can safely support
  parallel rows. If not safe in the first pass, remove or disable the setting
  until the runner can isolate browser/session state per row.

For planned-later trigger fields:

- Do not present them as active scheduling behavior.
- Either hide the Triggers section or label it as disabled/planned in a way that
  cannot be mistaken for active scheduling.
- Keep persisted trigger data only if the product intentionally wants forward
  compatibility.

### Runtime Flow

```text
run_workflow(workflow_id)
  -> load workflow metadata
  -> load workflow graph
  -> load workflow settings
  -> validate graph and settings together
  -> compile graph
  -> build runner options from settings
  -> start cancellation timer when max duration is set
  -> launch browser using browser settings
  -> execute compiled graph
  -> resolve terminal retention policy
  -> finish run state
```

Batch flow:

```text
run_batch_workflow(workflow_id, request)
  -> load graph and settings
  -> resolve batch options from request overrides and settings defaults
  -> run rows sequentially or concurrently according to supported isolation
  -> stop early when stop-on-first-failed-row is active
  -> return per-row status and summary
```

### Acceptance Criteria

- Headless workflow setting changes the browser launch mode.
- Maximum workflow duration cancels a long-running workflow with a clear timeout
  message.
- Browser retention closes or retains the browser according to settings when no
  terminal node overrides it.
- Batch defaults affect batch command behavior.
- Trigger UI is either implemented by a scheduler or clearly not active.
- Help text and docs describe the real behavior, not intended future behavior.

### Tests And Checks

- Rust tests for settings-to-runner option mapping.
- Rust tests for max-duration cancellation.
- Rust tests for browser retention default and terminal override precedence.
- Rust tests for batch stop-on-first-failed-row and batch default resolution.
- Frontend tests confirming planned trigger settings are not shown as active
  controls if no scheduler exists.
- Existing command API tests updated for changed behavior.

## Workstream 3: Graph-First Command Surface

### Problem

The product is graph-first, but some command paths still operate on legacy
ordered steps. `run_batch_workflow` builds `ActionConfig` values from
`detail.steps`. Duplicate uses legacy export/import and then separately copies
the graph. This preserves some behavior today, but it keeps two sources of truth
alive and makes future workflow behavior harder to reason about.

### Design

Make graph data the command source of truth for user-visible workflow behavior.

- `run_workflow` and `run_batch_workflow` should both compile the saved graph.
- Duplicate should use the graph-compatible package export/import path or a
  dedicated backend duplicate command that copies workflow metadata, settings,
  and graph together.
- Legacy ordered-step commands may remain internally for migration and tests, but
  they should not be the product path for graph workflows.
- Command docs should mark legacy paths as compatibility-only when they remain
  registered.

### Acceptance Criteria

- Batch execution runs the same graph that normal Run executes.
- Duplicating a workflow copies graph and settings through one graph-first
  backend path.
- No user-visible command depends on legacy `workflow_steps` as the source of
  truth for graph workflows.
- Import/export docs describe which package path is current and which legacy
  path remains for compatibility.

### Tests And Checks

- Command API test proving batch compiles the graph.
- Duplicate test proving copied workflow has identical graph and selected
  settings while getting a new workflow id/name.
- Package import/export tests for graph and settings preservation.
- Migration compatibility tests for workflows that still have legacy step rows.

## Workstream 4: Graph Editor Pan Mode And Test Flake

### Problem

The graph editor has one state variable for both persistent toolbar pan mode and
temporary Space-key pan mode. Releasing Space always sets pan mode to false,
which can disable persistent toolbar pan mode.

The full frontend test suite also timed out once in the graph editor context
actions test, while the same test passed when rerun alone. That points to a
suite-load timing issue or insufficient async stabilization.

### Design

Separate pan intent into two states:

```text
isToolbarPanMode
isSpacePanActive
isPanMode = isToolbarPanMode || isSpacePanActive
```

Toolbar select mode clears only `isToolbarPanMode`. Space keyup clears only
`isSpacePanActive`. This preserves both interaction models without hidden
coupling.

For the flaky test, make the assertion wait on the user-visible state that
actually matters. Avoid relying on incidental canvas timing or overlay absence
unless that absence is the direct product contract. If the overlay absence is
the contract, assert it with a bounded `waitFor` after the context actions are
visible.

### Acceptance Criteria

- Turning on pan mode from the toolbar remains active after pressing and
  releasing Space.
- Holding Space temporarily enables pan mode when toolbar pan mode is off.
- Selecting pointer/select mode disables persistent pan mode.
- The graph editor context action test passes in the full suite repeatedly.

### Tests And Checks

- Frontend unit/integration tests for toolbar pan, temporary Space pan, and the
  combined case.
- Rerun the full frontend suite at least twice locally after fixing the flaky
  test.

## Workstream 5: TypeScript And Rust Action Contract Alignment

### Problem

The frontend `ActionType` union does not include every action type present in
the Rust `ActionType` enum and TypeScript `ActionConfig` union. This has not
broken typecheck because current UI paths avoid some graph-internal action
types, but it makes shared DTOs fragile.

### Design

Create one frontend type model that distinguishes product palette actions from
all executable action config variants:

- `ActionType` should represent every serialized action type that can cross the
  Tauri boundary.
- `PaletteActionType` or an equivalent narrower type should represent the subset
  shown in the user action palette.
- Graph node types should remain separate from action types.
- Tests should verify the known action strings used by fixtures and command
  responses are accepted by TypeScript helpers.

### Acceptance Criteria

- TypeScript can represent every Rust action config variant that may be
  serialized.
- Palette filtering remains explicit and does not accidentally expose advanced
  graph-internal actions.
- Contract docs list the distinction between serialized action types, palette
  actions, and graph node types.

### Tests And Checks

- `npx tsc --noEmit`
- Type-level or fixture-based frontend test for action config coverage.
- Rust serialization test remains compatible with frontend fixture shape.

## Workstream 6: Code Organization Boundaries

### Problem

Several files have grown large enough that unrelated responsibilities are mixed:

- `src/App.tsx` owns navigation, workflow CRUD, graph autosave, run state,
  settings dialogs, duplicate, import, and export.
- `WorkflowSettingsDialog.tsx` owns dialog shell, section layout, field parsing,
  help flow, and every section form.
- `workflow_graph.rs` owns graph DTOs, validation, compile, and port behavior.
- `action_config.rs` owns the action enum, config variants, validation, labels,
  and serialization behavior.
- `runner/actions/mod.rs` owns dispatch plus substantial helper logic.

The goal is not a style-only refactor. The goal is to reduce regression risk
while implementing the workstreams above.

### Design

Refactor only along touched ownership boundaries:

- Extract frontend workflow orchestration from `App.tsx` into hooks/services
  when changing duplicate, package, run, settings, or autosave behavior.
- Split Workflow Settings sections into section components or modules when
  wiring runtime truth for those settings.
- Split Rust graph logic into modules for types, validation, compile, and ports
  when changing graph-first command behavior.
- Split runner action helpers by action family only when changing those families.

Recommended frontend boundaries:

- `useWorkflowSelection`
- `useGraphPersistence`
- `useWorkflowRunState`
- `useWorkflowSettingsState`
- `WorkflowPackageDialogs`

Recommended Rust boundaries:

- `domain/workflow_graph/types.rs`
- `domain/workflow_graph/validation.rs`
- `domain/workflow_graph/compiler.rs`
- `domain/workflow_graph/ports.rs`
- `runner/actions/<family>.rs` for action families already implied by the
  existing taxonomy

### Acceptance Criteria

- No refactor lands without behavior tests around the changed boundary.
- Public command payloads remain serializable and backwards compatible unless a
  migration note is added.
- Large-file reductions happen as part of behavior work, not as unrelated churn.
- New modules have clear ownership and do not create circular dependencies.

## Documentation Updates

Update docs when implementation changes behavior:

- `docs/contracts/tauri-commands.md` for command registration, production-only
  command surface, batch behavior, and legacy compatibility notes.
- `docs/contracts/run-state.md` for max-duration timeout and browser retention
  outcomes.
- `docs/contracts/workflow-types.md` and `docs/contracts/action-configs.md` for
  action type contract alignment.
- `docs/architecture/runner.md` for settings-to-runner flow.
- `docs/architecture/frontend.md` for extracted hooks/dialog boundaries.
- `docs/domain/execution-semantics.md` for batch, timeout, retention, and
  trigger behavior.
- `docs/domain/workflow-lifecycle.md` for duplicate/import/export behavior.
- `README.md` smoke checklist if user-visible workflow run behavior changes.

## Implementation Order

1. Tauri security hardening.
2. Workflow Settings runtime truth for headless, max duration, retention, and
   batch defaults.
3. Trigger UI truth: hide/disable planned controls or implement scheduler.
4. Graph-first batch and duplicate command paths.
5. Pan mode fix and graph editor test stabilization.
6. TypeScript/Rust action contract alignment.
7. Targeted code organization extractions while touching the related areas.

This order prioritizes shipped risk first, then user-visible correctness, then
developer maintainability.

## Overall Acceptance Criteria

- The shipped app no longer exposes unrestricted arbitrary file writes.
- Every visible Workflow Settings control has accurate runtime behavior or is
  clearly not active.
- Batch, duplicate, import, export, and run flows use graph-first semantics.
- The graph editor pan controls behave predictably with both keyboard and
  toolbar input.
- Frontend and Rust action contracts can represent the same serialized action
  variants.
- The full frontend and Rust checks pass, with any intentionally ignored browser
  spike tests documented.
- Docs match the implemented behavior.

## Self-Review

This spec intentionally separates security, runtime truth, command migration,
UI interaction, type contracts, and maintainability because each area has a
different risk profile and test strategy. It avoids requiring a full rewrite,
does not depend on adding a scheduler unless trigger settings are promoted to
active behavior, and has no unresolved gaps.
