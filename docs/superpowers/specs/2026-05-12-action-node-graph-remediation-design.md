# Action, Node, And Graph Remediation Design

Date: 2026-05-12

## Status

Draft from the deep action/node/graph audit on 2026-05-12. This spec focuses on
the executable workflow surface: action type contracts, action fields, graph
node logic, graph links, compiler semantics, and runner behavior.

This document complements
`docs/superpowers/specs/2026-05-12-source-review-remediation-design.md`, which
covers broader repository risks such as batch lifecycle, package import
atomicity, Electron hardening, and smoke test reliability.

## Summary

The workflow system has complete type-level coverage for the current action and
graph catalogs:

- 90 serialized `ActionType` values.
- 24 `GraphNodeType` values.
- All action types have a default config.
- All action types have a runner switch case.
- All graph node types have default ports and compiler handling.

The main defect class is contract drift. UI, TypeScript DTOs, docs, compiler,
and runner all know about many fields, but the runner either ignores those
fields, approximates the behavior, or returns success for actions that did not
actually perform their promised behavior.

The remediation must make runtime truth authoritative:

- every visible action either executes the behavior its label/config promises or
  fails with an explicit unsupported error;
- every editable field either affects runtime behavior, is validated as a
  compile/runtime error, or is removed/hidden from active UI;
- graph links must compile according to the documented branch/continuation
  semantics;
- backend validation must be the authoritative guard before run;
- tests must assert the contract at the same boundaries users rely on.

## Source Files

- `src/types/workflow.ts`
- `src/lib/workflowUi.ts`
- `src/features/workflows/lib/workflowActionDefaults.ts`
- `src/features/workflows/lib/workflowStepForm.ts`
- `src/features/workflows/lib/workflowGraph.ts`
- `src/features/workflows/components/ActionConfigEditor.tsx`
- `src/features/workflows/components/ActionConfig*Fields.tsx`
- `src/features/workflows/components/WorkflowGraphEditor.tsx`
- `src/features/workflows/components/WorkflowGraphInspectorFields.tsx`
- `electron/backend/graphCompiler.ts`
- `electron/backend/runner.ts`
- `electron/backend/runner.test.ts`
- `electron/backend/graphCompiler.test.ts`
- `src/features/workflows/components/WorkflowGraphEditor.test.tsx`
- `docs/contracts/action-configs.md`
- `docs/domain/action-taxonomy.md`
- `docs/domain/execution-semantics.md`

## Goals

- Restore parity between action config fields and runtime behavior.
- Implement a single element-target resolution path that supports structured
  targets, legacy XPath, iframe targeting, constraints, waits, and timeouts.
- Prevent visible actions from silently succeeding as stubs or no-ops.
- Move launch-time settings out of normal action semantics unless they can be
  applied safely at runtime.
- Make backend validation exhaustive enough to catch bad configs before run.
- Make graph branch, loop, retry, switch, and continuation semantics explicit
  and test-covered.
- Keep saved workflow compatibility where possible.
- Update docs and tests alongside behavior changes.

## Non-Goals

- Do not redesign the visual graph UI from scratch.
- Do not remove persisted action types without a migration path.
- Do not implement parallel graph branches.
- Do not implement recursive subworkflow execution until lifecycle, run state,
  and evidence ownership are designed.
- Do not expand automation scope beyond owned or explicitly authorized targets.

## Required Invariants

- TypeScript action types, default configs, UI fields, backend validation,
  compiler output, runner execution, tests, and docs must be changed together.
- A field shown in UI must have one of these statuses:
  - implemented by runner;
  - compile/runtime validated as unsupported;
  - hidden from active UI;
  - compatibility-only and clearly isolated from primary authoring flows.
- Backend validation is authoritative. Frontend validation is ergonomic only.
- Missing optional graph branches compile to empty steps. Missing required body
  branches block compile/run.
- Continuation ports are explicit. Branch ports must not accidentally absorb
  normal continuation nodes.
- Scope guards and evidence path guards must fail before unsafe side effects.

## Workstream 1: Action Capability Registry

### Problem

The system currently infers action readiness from type/default/editor/runner
presence. That is too weak because many actions have runner cases that are
stubs or partial implementations.

Examples:

- `drag_and_drop` only hovers source and target.
- `switch_frame`, `accept_dialog`, and `dismiss_dialog` return immediately.
- `wait_for_download` writes a directory output instead of waiting for a
  download.
- `detect_challenge` always writes `false`.
- launch-time actions such as `use_proxy` and `set_user_agent` only write output
  after the browser has already launched.

### Design

Create an action capability registry, for example:

```ts
type ActionCapability =
  | "implemented"
  | "implemented_partial_requires_validation"
  | "launch_time_only"
  | "compatibility_hidden"
  | "planned_hidden"
  | "unsupported_visible_error";
```

The registry should be the source of truth for:

- primary Add Action palette visibility;
- compatibility loading of hidden actions;
- backend validation severity;
- runner unsupported errors;
- docs taxonomy.

Recommended initial classifications:

| Classification | Actions |
| --- | --- |
| `implemented` | `navigate`, duration/element `wait`, `random_wait`, basic `input_text`, basic `click`, variable actions, output assertions, simple navigation/tab actions, request/response waits, storage actions |
| `implemented_partial_requires_validation` | element actions with incomplete wait/timeout/iframe/target support until Workstream 2 lands |
| `launch_time_only` | `use_profile`, `use_proxy`, `set_user_agent`, parts of `set_viewport`, proxy/profile/session-related settings |
| `compatibility_hidden` | graph-internal configs such as `if_condition`, `switch_condition`, `while_loop`, `repeat_until`, `try_catch`, `fallback_block`, `break_loop`, `continue_loop`, `transform_variable`, `assert_output`, `run_subworkflow`, `domain_allowlist` |
| `planned_hidden` | `detect_challenge`, `pause_for_human`, `resume_when_condition`, `checkpoint`, `fallback_selector`, `retry_step` until implemented truthfully |
| `unsupported_visible_error` | any action kept visible before implementation is complete |

### Acceptance Criteria

- Primary palettes use the registry, not ad hoc hidden lists.
- Compatibility actions still deserialize and can be inspected.
- A visible unsupported action fails with a clear runtime error instead of
  succeeding as a no-op.
- `docs/domain/action-taxonomy.md` matches the registry.

### Tests

- Palette tests for visible/hidden classification.
- Runner tests for explicit unsupported errors.
- Type test or unit test asserting every `ActionType` has a registry entry.

## Workstream 2: Element Target Resolver

### Problem

`ElementTarget` supports ordered locators, locator kinds, constraints, and iframe
targets in the type contract. The runner currently resolves only the first
locator and supports only `css`, `text`, `test_id`, and `xpath`. It ignores:

- `role`;
- `label`;
- `placeholder`;
- `attribute`;
- ordered fallback locator resolution;
- `constraints.visible`;
- `constraints.enabled`;
- `constraints.contains_text`;
- `constraints.index`;
- `target.iframe`;
- most legacy `iframe_xpath` fields.

This contradicts `docs/contracts/action-configs.md`.

### Design

Introduce a resolver module, for example
`electron/backend/runner/targetResolver.ts`.

Responsibilities:

- Accept legacy `{ xpath, iframe_xpath }` and structured `ElementTarget`.
- Resolve iframe before the element locator.
- Try ordered locators until one satisfies constraints.
- Support locator kinds:
  - `test_id`;
  - `role`;
  - `label`;
  - `placeholder`;
  - `text`;
  - `css`;
  - `xpath`;
  - `attribute`.
- Apply constraints:
  - visible;
  - enabled;
  - contains text;
  - index.
- Render template strings before resolving locator values where applicable.
- Return a Playwright-compatible locator and metadata for trace output.

Locator behavior should prefer native Playwright APIs where possible:

```ts
getByTestId()
getByRole()
getByLabel()
getByPlaceholder()
getByText()
locator(cssOrXpath)
frameLocator()
```

Fallback behavior should be explicit. If a driver does not provide a required
API, the action must fail with an unsupported-driver message instead of silently
using the wrong locator.

### Acceptance Criteria

- All element-facing actions use the shared resolver.
- Structured target locators are attempted in order.
- Constraints affect locator selection.
- `iframe_xpath` and `target.iframe` work consistently.
- Trace output records the selected locator kind and whether fallback was used.

### Tests

- Unit tests for each locator kind.
- Unit tests for ordered fallback.
- Runner tests for iframe targeting.
- Runner tests for visible/enabled/text/index constraints.
- Regression test that unsupported locator APIs fail clearly.

## Workstream 3: Wait, Timeout, And Retry Semantics For Element Actions

### Problem

Many element actions expose `wait_until`, `timeout_ms`, and
`retry_interval_ms`, but the runner ignores them. This affects:

- `input_text`;
- `clear_input`;
- `click`;
- `select_option`;
- `set_checkbox`;
- `hover`;
- `double_click`;
- `right_click`;
- `focus_element`;
- `blur_element`;
- `type_sequence`;
- `paste_clipboard`;
- `check`;
- `uncheck`;
- `toggle_checkbox`;
- `select_radio`;
- `upload_file`;
- `submit_form`;
- `set_contenteditable`;
- capture actions;
- assertions.

### Design

Create a pre-action readiness helper:

```ts
await waitForElementReadiness(locator, {
  waitUntil,
  timeoutMs,
  retryIntervalMs,
  actionKind,
});
```

Semantics:

- `attached`: wait for locator attached.
- `visible`: wait for visible.
- `enabled`: wait for visible and enabled.
- `clickable`: wait for visible, enabled, and stable enough to click.
- `timeout_ms`: max time for readiness and action-specific wait.
- `retry_interval_ms`: retry interval for actions that support retry.

Apply this helper before the action-specific operation. Do not implement custom
polling where Playwright has correct built-in semantics unless required for the
fake driver tests.

### Acceptance Criteria

- Setting `timeout_ms` changes behavior for element actions.
- `wait_until` is honored before mutation/click/capture.
- Retry behavior is deterministic and cancelable.
- Unsupported readiness state fails before performing the action.

### Tests

- Runner test for timeout passed to locator wait.
- Runner test for click waits before click.
- Runner test for input waits before fill/type.
- Runner test for cancellation during readiness wait.

## Workstream 4: Implement Or Hide Stubbed Visible Actions

### Problem

Several visible actions return success without doing the advertised work.

### Required Fixes

| Action | Required behavior |
| --- | --- |
| `drag_and_drop` | Use Playwright drag/drop or mouse down/move/up. Fail if unsupported. |
| `switch_frame` | Establish frame context for following element actions, or remove as standalone visible action and rely on per-target iframe support. |
| `accept_dialog` | Register a one-shot dialog handler and accept with optional prompt text. |
| `dismiss_dialog` | Register a one-shot dialog handler and dismiss. |
| `set_download_directory` | Treat as launch/environment setting or fail at runtime after launch. |
| `wait_for_download` | Wait for a download event, save the file under run evidence, and output artifact path. |
| `detect_challenge` | Actually evaluate configured patterns or classify as planned-hidden. |
| `pause_for_human` | Pause run state with timeout/cancellation or classify as planned-hidden. |
| `resume_when_condition` | Poll until condition true or timeout, with cancellation support. |
| `checkpoint` | Capture evidence using configured name/path or classify as planned-hidden. |
| `use_profile` | Move to Workflow Settings Browser or fail as launch-time-only. |
| `save_session` / `load_session` | Implement session persistence or hide/fail. |
| `set_secret` | Integrate with a secret store or hide/fail. |
| `use_proxy` | Move to launch settings; runtime action should fail after launch. |
| `set_user_agent` | Move to launch settings or use context-level behavior only when actually possible. |

### Acceptance Criteria

- No visible action can be a silent no-op.
- Launch-time-only actions are not presented as ordinary in-run actions unless
  they can be applied to the active context.
- Existing saved workflows with these actions produce clear compatibility or
  unsupported messages.

### Tests

- Runner tests for each implemented action.
- Runner tests for each unsupported-visible action.
- Palette tests for hidden/planned actions.

## Workstream 5: Complete Field Semantics Matrix

### Problem

Fields are currently over-declared compared with runner behavior. This creates
false confidence and makes the builder hard to reason about.

### Design

Create and maintain a field matrix in code and docs:

```text
Action type
Field
Required?
Editable?
Default?
Validated by backend?
Compiled?
Runner behavior?
Test coverage?
Compatibility only?
```

Initial fields requiring decisions:

- `click.mode`: implement force DOM click or remove/hide.
- `click.scroll_into_view`, `block`, `inline`: implement scroll behavior.
- `click.position`, `offset_x`, `offset_y`: pass click position options.
- `clear_input.method`: implement `select_all`, `backspace`, and DOM clear, or
  collapse to one method.
- `scroll.mode`: implement page/container/into_view/until_visible.
- `scroll.target`, `xpath`, `iframe_xpath`: use target resolver for container
  and into-view modes.
- `scroll.behavior`, `block`, `inline`, `max_attempts`, `wait_ms`: implement or
  hide.
- `set_viewport.device_scale_factor`, `mobile`, `touch`: move to launch-time
  context settings or fail if runtime update cannot apply them.
- `execute_js.timeout_ms`: run through a timeout wrapper or remove the field.
- `accept_dialog.prompt_text`: pass to dialog accept.
- `transform_variable.source_name`: define source-based transform semantics or
  remove; current runner only renders `expression`.
- `run_subworkflow.input_mapping` and `output_mapping`: implement mapping or
  fail unsupported.
- `detect_challenge.patterns`: use patterns in detection or hide action.
- `checkpoint.screenshot_path`: write checkpoint artifact or remove field.

### Acceptance Criteria

- Every editable field has a documented runtime status.
- Fields with no implementation are hidden or produce explicit validation
  errors.
- Backend validation prevents invalid combinations before run.

### Tests

- Contract test that every editable field appears in the matrix.
- Runner tests for newly implemented field behavior.
- Validation tests for removed/unsupported field combinations.

## Workstream 6: Backend Validation Parity

### Problem

`validateActionConfig` validates only a small subset:

- `navigate`;
- `wait`;
- `random_wait`;
- `click`;
- `input_text`;
- `clear_input`;
- `set_variable`;
- `set_json_variables`.

Many user-visible required fields can reach the runner invalid.

### Design

Split validation into action-family validators:

- navigation/browser;
- element interaction;
- form fields;
- keyboard/clipboard;
- capture/evidence;
- variables/assertions;
- browser context/session;
- network;
- advanced JS;
- graph-internal controls.

Validation rules should include:

- required strings are non-empty after trim;
- positive numeric fields where required;
- optional positive numbers reject zero/negative unless zero has semantics;
- URL fields parse and honor domain policy where applicable;
- file/evidence paths are safe and relative;
- geolocation latitude/longitude ranges;
- viewport dimensions and device scale factor ranges;
- cookie name/value requirements;
- proxy server format;
- permission list non-empty and known where possible;
- request/mock status range;
- JSON fields parse and have required root type;
- nested action configs validate recursively.

### Acceptance Criteria

- `dry_run_validate_config` catches invalid configs for all visible actions.
- Graph validation catches invalid graph-native node configs.
- Error messages identify field names and are stable enough for tests.

### Tests

- Validation tests for every action group.
- Recursive validation tests for nested branch/loop/retry configs.
- Import/compile tests for invalid legacy configs.

## Workstream 7: Graph Branch And Continuation Semantics

### Problem

Docs state that branch ports compile to nested configs and then execution
continues from explicit continuation ports such as `done` or `success`. The
compiler currently follows a branch path until terminal. If a branch is linked
to a normal continuation node instead of using `done`, that node becomes part of
the branch only.

This can surprise users because the visual graph may appear to show a normal
continuation, but the compiled action list changes its scope.

### Design

Choose one of two policies.

Recommended policy: enforce branch boundary.

- Branch ports may connect only to branch body nodes.
- Branch body paths must terminate at:
  - no outgoing edge;
  - terminal node;
  - loop control node where allowed;
  - explicit branch-end marker if introduced later.
- Continuation must start from the node's continuation port:
  - `if.done`;
  - `switch.done`;
  - `repeat_times.done`;
  - `repeat_for_each.done`;
  - `while.done`;
  - `repeat_until.done`;
  - `retry.success`;
  - `try_catch.done`;
  - `fallback.done`.
- If a node is reachable from both a branch path and a continuation path, graph
  validation should report an ambiguous branch boundary error.

Alternative policy: document current behavior and add UI affordances that make
branch scope visible. This is less safe and not recommended.

### Acceptance Criteria

- Ambiguous branch-to-continuation graphs fail validation.
- Compiler output matches the visual/validation model.
- Existing valid graphs still compile.

### Tests

- Graph compiler test for branch path accidentally absorbing continuation.
- Graph compiler test for valid branch plus `done` continuation.
- UI graph validation test displaying the ambiguity error.

## Workstream 8: Switch Case Port Integrity

### Problem

The switch editor rebuilds ports from case text. Backend `expectedPorts` keeps
the max of config cases and existing `case_*` ports, which helps compatibility,
but changing/removing cases can leave stale case edges that no longer correspond
to the intended case list.

### Design

- When switch cases are edited, reconcile edges:
  - preserve edges for unchanged case positions when possible;
  - remove edges for deleted case ports after explicit user confirmation or with
    clear validation warning;
  - update port labels to include case values.
- Backend validation should warn or error when a case port exists only because
  of stale saved ports and has no matching case value.

### Acceptance Criteria

- Removing a switch case cannot silently keep an executable stale branch.
- Validation identifies stale case edges.
- Port labels make case mapping visible.

### Tests

- UI test for deleting a switch case with an attached edge.
- Compiler validation test for stale `case_N` port/edge.

## Workstream 9: Loop Timeout And Resume Semantics

### Problem

`while`, `repeat_until`, and `resume_when_condition` expose `timeout_ms`, but
runner loop execution only honors max attempts.

### Design

Update loop execution to accept both max attempts and deadline:

```ts
executeLoop({
  steps,
  maxAttempts,
  timeoutMs,
  predicate,
  timeoutSteps,
});
```

Semantics:

- If both max attempts and timeout are set, whichever hits first stops the loop.
- `repeat_until.timeout_steps` run when the predicate is still false after max
  attempts or timeout.
- `while` exits successfully when predicate becomes false.
- Timeout should be cancelable and should not wait longer than the current
  action's cancellation behavior allows.
- `resume_when_condition` polls until condition true or timeout, then fails with
  a clear timeout reason unless a product decision says timeout means continue.

### Acceptance Criteria

- `timeout_ms` affects loop behavior.
- Timeout path can be tested without sleeping real wall-clock durations.
- Existing max-attempt behavior remains compatible.

### Tests

- Runner test for `while_loop.timeout_ms`.
- Runner test for `repeat_until.timeout_steps` after timeout.
- Runner test for `resume_when_condition` success and timeout.
- Cancellation test during loop polling.

## Workstream 10: Variable Options And Template Field Context

### Problem

`WorkflowGraphInspectorFields` passes `variableOptions` into
`ActionConfigEditor`, but `ActionConfigEditor` drops the prop and calls
`ActionFields` without it. Template text fields therefore cannot show/use
variable options from the graph inspector.

### Design

- Forward `variableOptions` through `ActionConfigEditor`.
- Add tests around action fields that use `TemplateTextareaField`.
- Verify action editor paths for both workflow step forms and graph inspector.

### Acceptance Criteria

- Variable options appear in action fields when editing graph action nodes.
- No regression for non-graph action editor usage.

### Tests

- Component test for graph action editor variable options.
- Component test for `navigate` or `set_variable` template field using options.

## Workstream 11: Domain Guard Before Navigation

### Problem

`domain_allowlist` checks the current page hostname only when that node runs.
A workflow can navigate to a disallowed domain before reaching the allowlist
node.

### Design

Use the run-scope domain guard from
`2026-05-12-source-review-remediation-design.md`, and connect it directly to
action execution:

- resolve allowed domains from Workflow Settings and/or compiler-derived
  allowlist nodes;
- enforce before `navigate` and `open_new_tab`;
- validate rendered URLs after template interpolation;
- fail before `page.goto`.

### Acceptance Criteria

- Disallowed navigation fails before browser navigation.
- Runtime `domain_allowlist` remains available as an assertion.

### Tests

- Runner test that fake page records no `goto` for blocked domain.
- Command/compile test for resolved domain policy.

## Workstream 12: Evidence, Downloads, Screenshots, And Checkpoints

### Problem

Screenshot paths can write outside app-owned evidence roots, and download or
checkpoint outputs can claim evidence that was not actually collected.

### Design

Use run-scoped evidence paths:

```text
evidence/
  runs/
    <run_id>/
      screenshots/
      downloads/
      checkpoints/
```

Rules:

- `take_screenshot.path` is an artifact name, not an arbitrary absolute path.
- Reject absolute paths, `file:` URLs, parent traversal, and empty unsafe names.
- `wait_for_download` waits for a download event and stores the saved file under
  run evidence.
- `checkpoint` either captures screenshot/metadata evidence or is hidden/fails
  unsupported.
- Outputs include both backward-compatible simple paths and structured
  `__evidence` entries.

### Acceptance Criteria

- No action can write evidence outside app-owned directories.
- Downloads/checkpoints are not reported unless collected.
- Failure screenshots do not overwrite previous runs.

### Tests

- Runner tests for safe screenshot paths.
- Runner tests for rejected `file:` and absolute paths.
- Runner tests for real download event behavior through fake driver.
- Evidence metadata persistence test.

## Workstream 13: Launch-Time Browser Context Actions

### Problem

Some actions are presented as in-run actions but only make sense before browser
launch:

- `use_profile`;
- `use_proxy`;
- `set_user_agent`;
- parts of `set_viewport`;
- session restore/load behaviors.

Executing them after the browser has launched currently only writes outputs,
which misleads users.

### Design

- Move launch-time controls to Workflow Settings Browser/Environment.
- Keep action types for compatibility where needed.
- At runtime, launch-time actions should:
  - fail with a clear message if executed after launch; or
  - be compiled into settings prelude only if they can be safely applied before
    launch.
- Update action palette to avoid presenting launch-time settings as ordinary
  steps.

### Acceptance Criteria

- Users cannot add no-op launch-time actions from primary action picker.
- Existing saved workflows receive clear compatibility errors or migration
  guidance.
- Browser launch options remain controlled by settings.

### Tests

- Palette tests.
- Runner unsupported tests for in-run launch-time actions.
- Settings prelude tests for supported launch-time behavior.

## Workstream 14: Hidden Graph-Internal Action Config Editing

### Problem

Graph-internal action configs are valid `ActionConfig` variants and can exist in
saved workflows, but ordinary action-node editing cannot edit them. The graph
node editor supports graph-native nodes, not arbitrary legacy action nodes that
contain graph-internal configs.

Affected configs include:

- `switch_condition`;
- `while_loop`;
- `repeat_until`;
- `try_catch`;
- `fallback_block`;
- `break_loop`;
- `continue_loop`;
- `transform_variable`;
- `assert_output`;
- `run_subworkflow`;
- `domain_allowlist`.

### Design

Choose a compatibility strategy:

Recommended:

- Keep these hidden from the action picker.
- When an action node contains a graph-internal config, show a compatibility
  panel:
  - action type label;
  - read-only JSON preview;
  - migration suggestion to convert to graph-native node;
  - delete/replace action controls.
- Do not silently render an empty editor.

Optional later migration:

- Add a command to convert legacy graph-internal action nodes into graph-native
  nodes and ports where feasible.

### Acceptance Criteria

- Legacy graph-internal action configs are inspectable.
- Empty editor states are eliminated.
- Users get a safe migration path instead of accidental config loss.

### Tests

- Component test for legacy `while_loop` action node inspector.
- Component test for replace/delete compatibility controls.

## Workstream 15: Test Coverage Contract

### Problem

Current tests cover some compiler structure, runner basics, and graph editor
behavior, but they do not cover most field-level semantics or stub/no-op
regressions.

### Design

Add a contract test suite with these layers:

1. Inventory coverage:
   - every `ActionType` has registry classification;
   - every visible action has editor support;
   - every visible action has backend validation;
   - every implemented action has at least one runner behavior test.

2. Field matrix coverage:
   - every editable field has validation and runtime status.

3. Graph coverage:
   - every `GraphNodeType` has ports;
   - compiler handles each graph node;
   - validation rejects missing required branches;
   - branch boundary semantics are tested.

4. Runner truth coverage:
   - visible actions cannot silently no-op;
   - unsupported actions throw explicit errors;
   - timeouts and cancellation are honored.

### Acceptance Criteria

- Adding a new action without registry/default/validation/editor/runner status
  fails tests.
- Adding a new graph node without compiler/port/validation status fails tests.
- Stub actions cannot be added to the visible palette without explicit tests.

### Tests

- `electron/backend/actionRegistry.test.ts`
- `electron/backend/actionValidation.test.ts`
- `electron/backend/runner.action-contract.test.ts`
- `electron/backend/graphCompiler.test.ts`
- `src/features/workflows/components/WorkflowGraphEditor.test.tsx`

## Implementation Order

1. Add action capability registry and align palette visibility.
2. Add explicit unsupported errors for current no-op/stub visible actions.
3. Implement backend validation parity for all visible action configs.
4. Build shared element target resolver.
5. Wire wait/timeout/retry semantics into element actions.
6. Fix variableOptions forwarding in `ActionConfigEditor`.
7. Fix loop timeout and `resume_when_condition` semantics.
8. Fix graph branch boundary validation.
9. Fix switch case port/edge reconciliation.
10. Implement or hide download/dialog/frame/checkpoint/challenge/session actions.
11. Add pre-navigation domain guard.
12. Add run-scoped evidence path handling.
13. Add inventory/field/runner contract tests.
14. Update docs and README smoke checklist where user-visible behavior changes.

## Verification Matrix

Run focused checks while implementing:

```text
npm test -- electron/backend/graphCompiler.test.ts
npm test -- electron/backend/runner.test.ts
npm test -- src/features/workflows/components/WorkflowGraphEditor.test.tsx
npx tsc --noEmit
npm run build:electron
```

Before merging a completed remediation slice:

```text
npm test
```

When browser smoke behavior changes:

```text
npm run test:smoke
```

## Documentation Updates

Update these docs with each implementation slice:

- `docs/contracts/action-configs.md`
- `docs/domain/action-taxonomy.md`
- `docs/domain/execution-semantics.md`
- `docs/domain/user-visible-invariants.md`
- `docs/architecture/runner.md`
- `docs/contracts/run-state.md`
- `docs/task-routes.md`
- `README.md` smoke checklist when commands or behavior change

## Open Decisions

- Should launch-time actions be migrated automatically into Workflow Settings or
  only hidden/fail with guidance?
- Should `switch_frame` survive as a standalone action once per-target iframe
  support exists?
- Should `run_subworkflow` be implemented in this remediation pass or remain
  explicitly unsupported until nested run lifecycle is designed?
- Should branch boundary validation be strict immediately, or introduced as a
  warning first for existing saved graphs?
- Should unsupported compatibility actions fail at validation time or runtime?

