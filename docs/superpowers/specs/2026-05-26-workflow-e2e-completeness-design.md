# Workflow E2E Completeness Design

Date: 2026-05-26

## Status

Approved design for implementation planning on 2026-05-26.

## Goal

Establish an end-to-end completeness system for workflows that demonstrates
real user browser behavior through workflows, rather than only confirming that
individual action types can execute.

The system must:

- Model how users create, configure, connect, validate, run, stop, inspect, and
  rerun workflows in the desktop product.
- Model how those workflows perform observable browser behavior such as
  navigation, interaction, data entry, capture, network handling, storage,
  session continuity, control flow, and evidence production.
- Audit every current action type, graph node type, and behavior-changing field
  variant against real scenarios.
- Write executable E2E coverage when existing capabilities can express the
  scenario accurately.
- Record a concrete capability gap when existing nodes, fields, or runtime
  semantics cannot accurately express the scenario, so the operator can decide
  whether to implement the missing capability later.
- Remain maintainable by failing when new behavior-affecting capabilities are
  introduced without scenario classification.

## Context

The repository already has Playwright desktop E2E coverage for action families,
control flow, evidence, packages, batch execution, and run from selected. Its
existing coverage matrix establishes that action and graph node categories
point to evidence files. That is necessary, but it does not prove that all
meaningful field variants are exercised in workflows that correspond to real
user behavior.

This design moves the source of truth to behavior scenarios while retaining a
reverse audit over all serialized workflow capabilities.

## Scope

Included:

- User interaction with the workflow product: authoring, settings, save,
  validate, execute, stop, failures, evidence, and retained-session execution.
- Browser behavior executed by a workflow: navigation, element interaction,
  form work, keyboard/dialog behavior, capture/download, dynamic waits,
  network behavior, browser context/storage, variable-driven data flow,
  graph control flow, run outcomes, session continuity, package/batch/audit
  behavior.
- Traceability from each scenario to workflow nodes, action types, settings,
  behavior-changing field variants, tests, and recorded gaps.
- Local deterministic desktop E2E as the primary verification lane.
- Opt-in tests against explicitly authorized owned staging targets for behavior
  that local fixtures cannot fully demonstrate.

Excluded from this goal:

- Automatically implementing every capability identified as missing. A
  fully-specified gap is a valid outcome of this coverage goal; capability
  development requires a later operator decision.
- Attempting every possible input-data combination or timeout value where the
  runtime behavior is unchanged.
- Tests against targets outside owned or explicitly authorized environments.

## Chosen Approach

Use behavior-first coverage with two-way capability auditing.

Pure node-first testing makes inventory easy to enumerate but encourages
isolated technical tests that do not establish realistic workflow usage. Pure
journey-first testing reflects real use but can miss rare actions or important
configuration branches. The selected approach combines both:

1. Define real user behavior scenarios as the primary units of work.
2. Express each scenario as a workflow graph/settings configuration.
3. Map it to required actions, graph nodes, and behavior-changing field
   variants.
4. Audit the full current capability surface in reverse to ensure no action,
   node, or meaningful variant remains unclassified.

## Behavior Scenario Model

A behavior scenario is a complete activity that a user could perform on a web
page by constructing and running a workflow. Scenarios must verify observable
outcomes; they must not exist merely to invoke an action type.

Each scenario records:

| Field | Purpose |
| --- | --- |
| `id` | Stable scenario identifier. |
| `user_intent` | The real task the workflow operator is accomplishing. |
| `preconditions` | Page, account/session, fixture, staging target, and settings assumptions. |
| `workflow_authoring` | Graph nodes, links, settings, and operator operations required to create/run it. |
| `browser_behavior` | Observable browser interaction sequence. |
| `actions_and_fields` | Action/node/settings variants exercised. |
| `expected_outcomes` | Browser state, output, run state, and evidence assertions. |
| `recovery_variants` | Relevant slow, failing, retry, cancellation, or session-continuation behavior. |
| `capability_status` | `covered`, `gap`, or `not_applicable`. |
| `evidence` | Test files or capability gap entries supporting the status. |

Example scenario shape:

```text
browse_search_open_detail_return
  Navigate to a searchable listing page.
  Enter search criteria and wait for results.
  Apply a filter.
  Open one result in a new tab.
  Extract detail data and take evidence.
  Close the detail tab and confirm return to the listing state.
```

This scenario establishes meaningful use of navigation, input, wait/network,
selection, tab control, extraction, and evidence actions together.

## Per-Scenario Audit Loop

The same small loop is required for every inventory entry:

1. `Discover`: describe the browser behavior from the user's perspective.
2. `Model`: define the workflow graph and settings the user would author.
3. `Inspect`: inspect affected types, editor/defaults, backend validation,
   compiler, runner execution, and existing E2E evidence.
4. `Assess`: determine whether current capabilities accurately represent the
   behavior and relevant real variants.
5. `Classify`: mark the scenario `covered`, `gap`, or `not_applicable`.
6. `Test`: for `covered`, add or refine E2E assertions through Electron,
   graph compilation, the runner, and the browser runtime.
7. `Record Gap`: for `gap`, document the missing node/field/semantic and the
   E2E scenario it prevents.
8. `Trace`: update forward and reverse coverage mappings in the same change.
9. `Verify`: run focused checks for the scenario and coverage guard.
10. `Advance`: process the next unclassified scenario until no pending entry
    remains.

A test mentioning an action does not by itself satisfy the loop. For example,
`scroll.mode = "until_visible"` is covered only by a scenario that requires
finding content outside the viewport and asserts the resulting interaction or
captured output.

## Behavior Inventory

The behavior catalog must evaluate at least these user workflow domains:

| Domain | Behaviors to classify |
| --- | --- |
| Workflow authoring | Create workflow, configure fields, connect graph, save, validate, run, stop, inspect result/evidence, run from selected. |
| Page navigation | Navigate, history, reload, transition after interaction, domain allowlist block. |
| Element interaction | Click, double/right click, hover, focus/blur, drag/drop, page and target scrolling. |
| Form completion | Fill/clear, native/custom selection, checkbox/radio, rich text, upload, submit. |
| Keyboard/dialog | Key sequence, hotkey, clipboard/paste, prompt/confirm accept or dismiss. |
| Content capture | Text/value/attribute/list/table extraction, screenshot, download. |
| Dynamic behavior | Loading/wait states, URL/text/element changes, request/response timing, disabled or disappearing elements. |
| Network behavior | Extra headers, request block, response mock, request/response observation. |
| Browser context | Cookies, storage, viewport, geolocation, permissions. |
| Data flow | Typed variables, JSON variables, templates, extracted data reused later. |
| Decisions and recovery | If, switch/router, loops, retry, loop control, failure/recovery blocks available in the runtime. |
| Run outcome | Success, failure, validation block, stop, timeout, failure evidence. |
| Session continuity | Persistent profile, retained browser, run from selected. |
| Package/batch/audit | Package import/export, data-row batch execution, persisted run evidence. |

The catalog can contain multiple scenarios per domain when distinct runtime or
failure behavior needs proof.

## Reverse Capability Inventory

The reverse audit is generated or maintained against current source contracts,
not historical planning documents. It covers:

- Every `ActionType` in `src/types/workflow.ts`.
- Every `GraphNodeType`.
- Every setting that changes execution, browser launch/session behavior, or
  run/evidence semantics.
- Every action/node field or enum alternative that changes browser behavior,
  validation branches, runtime paths, outcomes, evidence, session state, or
  audit/security behavior.

Examples of behavior-changing variants requiring explicit classification:

| Capability | Variants |
| --- | --- |
| `wait.condition` | duration, relevant element states, text, URL, and page load. |
| `select_option.match_by` | label and value. |
| `scroll.mode` | page, into view, until visible. |
| `assert_element.state` | attached, visible, hidden, enabled, disabled. |
| `assert_text.match_mode` | contains, equals, and meaningful failure behavior. |
| `ElementTarget` | locator resolution/fallback and supported constraints; iframe behavior when actually supported. |
| `stop_workflow` | success/failure and browser-close behavior where observable. |
| `repeat_for_each` | manual items and array-variable input. |
| `wait_for_response.status` | status-filtered and unfiltered handling. |
| Session/run policy | temporary/persistent, retain/close, and run-from-selected eligibility. |

The reverse inventory must avoid combinatorial testing without behavioral
value. Variants that change only arbitrary sample data and do not exercise a
different semantic branch need not each produce separate E2E tests.

## Traceability Model

Traceability is required in both directions:

```text
scenario
  -> authored workflow nodes/settings
  -> action types and behavior-changing variants
  -> expected outcome and recovery assertions
  -> E2E test file or capability gap entry
```

```text
action / graph node / setting / field variant
  -> behavior scenario
  -> covered, gap, or not_applicable status
  -> concrete evidence
```

`not_applicable` entries require a specific reason, such as being outside the
authorized target scope or intentionally not part of the product contract.

## Capability Gap Register

When a scenario cannot be represented accurately, implementation records a
gap rather than silently weakening the scenario or expanding product behavior
without operator approval.

Each gap includes:

| Field | Purpose |
| --- | --- |
| `gap_id` | Stable identifier. |
| `scenario_id` | Scenario blocked by the limitation. |
| `user_behavior` | Browser behavior the operator needs to model. |
| `current_limitation` | Missing or incorrect node, field, validation, compiler, or runtime semantic. |
| `proposed_capability` | Specific action, field, or semantic change to consider. |
| `blocked_e2e` | Expected E2E verification after capability implementation. |
| `risk_or_value` | Why the behavior matters. |
| `decision_status` | Initially `proposed`; later capability work is a separate approved goal. |

A gap entry means the scenario has been audited, not that browser support has
been demonstrated.

## Implementation Artifacts

Implementation planning must select concrete paths consistent with existing
repository conventions. Expected artifact roles are:

| Artifact | Purpose |
| --- | --- |
| Behavior catalog | Source-of-truth scenario inventory and classifications. |
| Traceability matrix | Forward and reverse action/node/field evidence map. |
| Capability gap register | Product capability proposals for unrepresentable real behavior. |
| Fixture server additions | Deterministic pages and states for local browser behavior. |
| Playwright E2E suites | Executable evidence for representable scenarios. |
| Coverage guard | Machine-checkable detection of unclassified capabilities/scenarios. |
| Documentation updates | Maintainer workflow, commands, and current coverage policy. |

The existing `tests/e2e/support/coverageMatrix.ts` and
`tests/e2e/coverage-matrix.e2e.ts` are natural integration points, but the
implementation plan must decide whether to extend them or split behavior
catalog and field-level mappings into focused supporting modules.

## Verification Tiers

### Local Deterministic Desktop E2E

Local desktop E2E is mandatory for every representable scenario that can be
demonstrated reliably using local fixture pages. It executes through the
desktop bridge, saved graph, compiler, runner, browser runtime, and observable
outcomes/evidence.

### Authorized Staging Opt-In

Opt-in staging tests apply only to behaviors that require authorized
production-like account/session/integration surfaces that local fixtures cannot
establish. Targets must remain allowlisted and accounts named according to
existing repository policy.

Staging does not replace deterministic local coverage. Conversely, local
fixtures must not be used as proof of target-specific behavior that exists only
on owned staging or production-like systems.

## Coverage Guard

The current coverage guard must evolve from action-file presence to
classification completeness. It must fail when:

- A visible action has no real behavior scenario.
- A graph node has neither an appropriate scenario nor an explicit justified
  coverage decision.
- A behavior-changing field or enum branch has no `covered`, `gap`, or
  justified `not_applicable` classification.
- A `covered` scenario does not reference existing test evidence.
- A `gap` scenario does not reference an existing gap entry.
- Any inventory entry remains pending at completion time.

The guard proves inventory completeness, not semantic correctness. Semantic
proof comes from browser-visible E2E assertions, run-state/evidence assertions,
and focused review of each capability mapping.

## Error Handling And Evidence Expectations

- Scenarios that expect failure must assert failed run state and the
  user-relevant failure reason or failed-step identity when available.
- Scenarios that produce evidence must assert the relevant output or structured
  evidence metadata, not merely terminal success.
- Scenarios involving cancellation, timeout, browser retention, or continued
  sessions must assert the corresponding run/session behavior.
- Gaps must not be masked by a test that only exercises a weaker substitute
  behavior.
- Authorized-target requirements remain explicit for any staging-only proof.

## Completion Criteria

This coverage goal is `DONE` only after a final audit confirms all of the
following against actual artifacts and verification output:

1. A behavior catalog exists and contains no pending scenario.
2. Every current visible action, graph node, and behavior-changing field
   variant has traceability evidence.
3. Each traceability entry ends in `covered`, `gap`, or justified
   `not_applicable`.
4. Every `covered` scenario has E2E assertions that observe browser behavior,
   run state, or evidence, rather than only successful action dispatch.
5. Every `gap` scenario has a complete gap record sufficient for an operator
   to decide on later capability development.
6. The coverage guard detects newly introduced unclassified action, node,
   setting, or behavior-changing field surface.
7. Required focused tests and applicable full local E2E checks pass; staging
   requirements and verification status are explicitly recorded where local
   execution cannot prove the behavior.
8. Current docs, contracts, and the test matrix agree for the touched coverage
   and verification surface.
9. A final prompt-to-artifact audit maps the original request to concrete
   catalog entries, traceability entries, tests, gap records, guards, commands,
   and verification results.

Known, concrete capability gaps do not block this goal from completion because
the intended outcome is to expose missing capability for later operator
decision. An unassessed or vaguely documented gap does block completion.

## Process And Gates

- This document is the approved design artifact.
- Implementation must begin with a detailed implementation plan.
- Behavior-changing code and test-harness changes follow repository TDD and
  docs-sync requirements.
- The implementation must remain scoped to owned or explicitly authorized
  targets and preserve auditability.
- The goal must remain active until implementation and the completion audit
  meet the criteria above; producing this design alone does not complete it.
