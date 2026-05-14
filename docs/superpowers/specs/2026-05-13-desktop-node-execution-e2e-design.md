# Desktop Node Execution E2E Design

## Goal

Add a full desktop end-to-end test strategy focused on **real workflow
execution for visible user-authorable nodes**.

The suite should launch the Electron app, drive workflow execution through the
actual desktop/runtime boundary, run against deterministic local fixture pages,
and prove node behavior through observable page state, workflow outputs, run
status, and evidence artifacts.

This design is intentionally **not** a broad "test every app screen" proposal.
The target is workflow execution truth for the nodes users can add from the
main authoring UI.

This spec is sequenced **after**
`2026-05-12-cloakbrowser-action-settings-simplification-design.md`.
Its execution matrix must bind to the **post-simplification visible node
catalog**, not blindly preserve today's serialized action names or today's
primary palettes.

## Current Gap

The repo already has:

- frontend/component integration tests with Testing Library
- backend command and graph compiler tests
- runner behavior tests using fake browser drivers
- one opt-in real CloakBrowser smoke test

What it lacks is:

- desktop Playwright/Electron E2E coverage
- real UI/runtime verification that user-authored workflows execute correctly
  across many visible node/action families

Playwright's Electron automation API supports this shape:

- launch an Electron app with `_electron.launch(...)`
- inspect the main process if needed
- obtain the first BrowserWindow
- drive the desktop UI like a user

## Scope

### In Scope

- visible node/action types that users can add from the primary UI
- the visible node/action catalog that exists **after** the simplification
  spec has landed
- real desktop workflow execution through:
  - Electron
  - renderer
  - IPC
  - backend commands
  - SQLite-backed app state
  - CloakBrowser-backed runner
- deterministic local fixture HTML/server routes
- assertions on:
  - page state
  - workflow outputs
  - run status
  - selected evidence artifacts

### Out Of Scope

- hidden compatibility/planned nodes
- staging/production target workflows
- exhaustive UI shell coverage unrelated to runtime behavior
- duplicating every low-level validation matrix already covered by backend or
  unit tests

## Core Philosophy

1. The suite is **execution-first**, not shell-first.
2. The test unit is **node family plus meaningful runtime cases**.
3. Each case must prove real side effects, not only that a form saved.
4. Electron app state should be isolated through temporary app-data storage.
5. SQLite is part of the system under test, but the primary oracle remains
   visible runtime behavior and UI outputs.

## Runtime Architecture

### Electron Launch

Use Playwright Electron automation to launch the desktop app under test.

Each worker or test context should receive:

- unique temporary app-data root
- isolated browser profile/data directories
- deterministic fixture server base URL

The launch contract should make it possible to:

- avoid touching developer data
- relaunch the same temp app data when a test needs persistence checks
- capture Electron-window screenshots/traces on failure

### Fixture Server

Use one local deterministic fixture server instead of many unrelated ad hoc
files.

The server should expose routes for:

- base navigation page
- browser history route sequence A/B/C
- form page with inputs, selects, radios, checkboxes, submit flows
- custom dropdown and contenteditable page
- pointer interaction page:
  - click
  - double click
  - right click
  - hover
  - drag/drop
  - focus/blur
- tall scroll page
- iframe page
- dialog trigger page
- download endpoint
- request/response echo endpoint
- mockable JSON endpoint
- headers echo endpoint
- geolocation/permission-friendly page where stable

Fixture pages should expose stable markers such as:

- `data-testid` values
- status text
- event counters
- hidden/visible markers
- state summary containers

The goal is to let E2E tests assert what the workflow changed without reading
runner internals.

## Workflow Assembly Strategy

The tests are desktop E2E because the app launches and runs workflows through
the real runtime boundary.

Not every scenario must manually click through the same repeated "Add Action"
steps when that does not increase confidence in the execution behavior under
test.

Recommended split:

- keep a few cases that build workflows fully through the visible UI
- allow shared helpers to create minimal workflow graphs or seed workflows
  through app-supported pathways when the test's purpose is node execution
  rather than palette repetition

Every scenario still runs the workflow through the real app and real runner.

## Execution Coverage Matrix

The node names below are product-intent labels unless the simplification spec
has already finalized a specific serialized DTO name. Implementation must map
this matrix onto the final post-simplification public action catalog.

### 1. Navigation

Required E2E cases:

- `navigate`: opens fixture page successfully
- `go_back` / `go_forward`: moves through route history correctly
- `reload`: resets or increments fixture reload state
- `open_new_tab` + `switch_tab` + `close_tab`: operates on the intended active
  tab

Observable proofs:

- current page marker
- active tab state marker
- final extracted page text/output

### 2. Pointer And Element Interaction

Required E2E cases:

- `click`: toggles page state
- `double_click`: only double-click path changes the marker
- `right_click`: context/right-click marker appears
- `hover`: tooltip or hover-only marker appears
- `drag_and_drop`: item enters the target zone
- `scroll`: lower-page marker becomes reachable/updated
- `focus_element` / `blur_element`: focus state changes

Observable proofs:

- fixture status region
- event counters
- final output extraction when useful

### 3. Form Inputs

Required E2E cases:

- fill-field behavior: field value updated
- clear-field behavior: populated field cleared
- `select_option`: expected option selected
- `check`
- `uncheck`
- `toggle_checkbox`
- `select_radio`
- `upload_file`: uploaded file name or metadata displayed
- `submit_form`: success marker shown
- `select_custom_option`: selected label appears
- `set_contenteditable`: rich-text content updated

Observable proofs:

- form value summaries
- checked/selected status
- submit success text
- contenteditable text

### 4. Keyboard And Clipboard

Required E2E cases:

- `press_key`: keypress drives page behavior
- `hotkey`: shortcut behavior fires
- `type_sequence`: expected text produced through keyboard sequence
- `set_clipboard` + `paste_clipboard`: field receives pasted content

Observable proofs:

- fixture key event log
- target field value
- shortcut marker

### 5. Wait And Assertion Nodes

Required E2E cases:

- `wait` duration: workflow does not advance immediately
- `wait` element/text/url condition paths
- `random_wait`: completes with a bounded observable pause
- `assert_element`: pass case
- `assert_text`: pass case
- `assert_text`: fail case that produces visible runtime failure context

Observable proofs:

- run timing markers where appropriate
- status transitions
- run issue/error display for failing assertion

### 6. Capture Data And Evidence

Required E2E cases:

- `extract_text`
- `extract_attribute`
- `extract_input_value`
- `extract_list`
- `extract_table`
- `take_screenshot`
- `wait_for_download`

Observable proofs:

- outputs rendered in run state or inspectable result payload
- screenshot/download artifact path exists when that is the contract
- download flow stores evidence-backed path

### 7. Variables And Control Flow

Required E2E cases:

- set-variable behavior: value interpolates into a later node
- set-JSON-variables behavior: nested data flattens and is reusable
- `if`: expected branch runs
- `switch`: selected branch runs
- `repeat_times`: body runs exact count
- `repeat_for_each`: iterates supplied items/array
- `while`: loop exits when condition changes
- `repeat_until`: loop stops on satisfied condition
- `retry`: first attempt fails, later attempt succeeds
- terminal success/failure/stop nodes set the expected final run outcome

Observable proofs:

- branch markers
- counters
- output accumulation
- terminal run status

### 8. Dialog Nodes

Required E2E cases:

- `accept_dialog`: confirmation or prompt path succeeds
- `dismiss_dialog`: confirmation path is canceled

Observable proofs:

- fixture page marker describing accepted/dismissed result

### 9. Browser Context And Storage Visible Actions

This group is **conditional** on the post-simplification visible action catalog.
The simplification spec removes many browser-context and storage fields from
Workflow Settings, but does not by itself finalize whether every comparable
in-run browser-context/storage action remains visible, is hidden, or is
replaced by a higher-level intent action.

If the simplification work keeps any of these behaviors as visible authorable
nodes, the E2E suite should cover them:

- viewport mutation behavior
- geolocation behavior where the browser path is stable enough
- extra-header behavior proven by the fixture server
- permission-grant behavior where stable
- cookie set/clear behavior
- local/session storage mutation behavior

If simplification removes or hides any of these behaviors from the visible
authoring surface, they should be removed from the desktop visible-node E2E
matrix and covered only at lower layers or in compatibility-specific suites.

Observable proofs, when applicable:

- page-side inspection text
- server request logs
- extracted output values

### 10. Network And JavaScript

Required E2E cases:

- `wait_for_request`
- `wait_for_response`
- `block_request`
- `mock_response`
- `execute_js`

Observable proofs:

- request/response fixture markers
- visible fallback when a request is blocked
- mocked body/status result
- JavaScript output available to later steps or run outputs

## Failure Coverage Philosophy

Desktop E2E should include failure cases when the failure itself is part of the
product behavior users need confidence in.

Recommended failure cases:

- assertion failure
- retry recovery
- one representative wait timeout if run-state/UI failure reporting needs to
  be verified at the desktop layer
- invalid tab index if the product surfaces that failure as a user-facing run
  issue

Do not move every numeric validation or serializer edge case into desktop E2E.
Those belong in lower-level suites.

## Scenario Tiers

### Tier 1: Core Execution

Run in normal CI.

Should include the highest-value visible runtime behaviors:

- navigate
- click
- fill/clear/select field behavior
- extract text/value/attribute
- wait condition basics
- assert pass/fail
- variables and interpolation
- `if`
- `repeat_times`
- `retry`
- screenshot/download
- request/response/mocking/blocking

### Tier 2: Extended Visible Coverage

Run nightly or pre-release.

Should include:

- double click
- right click
- hover
- drag/drop
- focus/blur
- scroll
- upload/custom select/contenteditable
- clipboard/hotkey/type sequence
- tab actions
- dialogs
- switch/repeat_for_each/while/repeat_until
- any browser-context/storage behaviors that remain visible after simplification

### Tier 3: Slow Or Environment-Sensitive

Opt-in only.

Use for:

- permission/geolocation flows that are browser-environment sensitive
- long combined scenarios
- any future staging-owned execution lanes, kept separate from deterministic
  local fixture tests

## Completeness Criteria

Every visible user-authorable node must be in one of these states:

1. has a dedicated desktop E2E happy path
2. is covered inside a grouped desktop E2E flow where its side effect remains
   independently observable
3. is explicitly documented as lower-level-only coverage with justification

No visible node should remain uncategorized.

The source of truth for "visible user-authorable node" is the public catalog
after the simplification design is implemented. The E2E suite must not retain
coverage obligations for nodes or action forms intentionally removed from that
catalog.

Every desktop E2E scenario must declare:

- fixture route
- workflow graph under test
- node(s) under test
- observable proof of success/failure
- reason this scenario belongs at desktop E2E depth

## Suggested Test File Organization

- `navigation.e2e.ts`
- `pointer-actions.e2e.ts`
- `form-actions.e2e.ts`
- `keyboard-actions.e2e.ts`
- `wait-assertion-actions.e2e.ts`
- `capture-actions.e2e.ts`
- `control-flow.e2e.ts`
- `dialog-actions.e2e.ts`
- `browser-context-actions.e2e.ts`
- `network-actions.e2e.ts`

Shared support:

- Electron launch fixture
- temporary app-data fixture
- deterministic fixture server
- workflow creation/run helpers
- evidence inspection helpers
- request log helpers

## Artifacts And Debuggability

On failure, capture:

- Electron window screenshot
- Playwright trace if enabled
- runner-visible run status/error text
- fixture-server request log when relevant
- artifact paths for screenshot/download scenarios

The goal is fast diagnosis of whether the failure belongs to:

- workflow assembly
- app IPC/persistence
- runner execution
- fixture expectation

## Decision Summary

The repo should add a desktop E2E program whose primary concern is:

> visible workflow nodes run correctly through the real Electron and
> CloakBrowser execution path against deterministic local fixtures.

This strategy complements, rather than replaces:

- backend graph/compiler tests
- runner unit tests
- current component integration tests
- real CloakBrowser smoke tests
