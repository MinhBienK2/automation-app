# High-Fidelity Interaction Runner Design

## Goal

Upgrade workflow action execution so user-facing action nodes can run through the most realistic browser interaction path available in owned or explicitly authorized test environments.

The goal is not to make every node look like a user action. The goal is to separate real user behavior simulation from setup, observation, assertion, and control-flow work, then make the user behavior path consistent, auditable, and testable.

## Product Scope And Safety

This design is for authorized adversarial browser automation testing against company-owned production and staging systems. High-fidelity mode must preserve operator control and auditability.

High-fidelity runs must keep these boundaries:

- Run only on allowlisted domains or explicitly authorized targets.
- Use named test accounts and reproducible browser profile settings where account state matters.
- Record action mode, target, timing, fallback behavior, and failure evidence.
- Treat challenge and manual verification nodes as detection, pause, and handoff points. They must not become automated challenge bypass tools.
- Keep direct DOM and setup actions visible in trace output so test evidence does not misrepresent them as user input.

## Current Problems

- User-facing nodes use inconsistent execution paths. Some clicks use browser mouse events, while hover, drag/drop, keyboard, text input, scroll, and many form actions still dispatch DOM events or mutate values directly.
- `input_text` defaults to direct value setting, which is fast and stable but not realistic for sites that depend on focus, key, selection, composition, or autocomplete behavior.
- Action modules each implement their own waiting, target checks, and event behavior, which makes fidelity hard to reason about across the action catalog.
- Timing is split between explicit wait nodes, random wait nodes, global wait-between-nodes, and per-action fields. There is no shared interaction timing model for pointer travel, press duration, key cadence, or post-action settle.
- Evidence currently reports success/failure at the step level, but not enough detail to distinguish browser-level input from direct DOM fallback.

## Recommended Approach

Introduce a shared `InteractionEngine` below `execute_action`.

```text
ActionConfig
  -> execute_action
    -> InteractionEngine
      -> TargetResolver
      -> PointerController
      -> KeyboardController
      -> ScrollController
      -> TimingProfile
      -> ActionTrace
```

Action modules should translate action config into engine calls instead of building one-off DOM scripts for user-facing behavior. DOM scripts remain useful for target discovery, assertions, extraction, storage, and explicit direct-mode fallback.

## Fidelity Model

Every action execution should be classified into one of these modes:

- `browser_input`: Uses browser-level pointer, keyboard, wheel, or page commands. This is the default for user-facing high-fidelity actions.
- `assisted_browser_input`: Uses JavaScript only to resolve target geometry or state, then performs interaction through browser-level input.
- `direct_dom`: Uses DOM mutation or DOM-dispatched events. This is allowed only for setup, internal control, or explicit fallback.
- `observer`: Reads page state or captures output without pretending to be a user action.
- `manual`: Pauses or hands off to a human operator.

High-fidelity workflow settings should prefer `browser_input` and `assisted_browser_input`. If an action falls back to `direct_dom`, the trace must say so.

## Interaction Engine Components

### TargetResolver

`TargetResolver` resolves XPath and frame context into an actionable target.

Responsibilities:

- Resolve XPath in the current document or selected frame.
- Validate attachment, visibility, enabled state, readonly state where relevant, and occlusion.
- Return stable bounding box and target point candidates.
- Support center, corner, and configured offset strategies.
- Wait for layout stability before pointer or keyboard actions.
- Return structured failure reasons that can be shown in run issues.

### PointerController

`PointerController` owns high-fidelity mouse behavior.

Responsibilities:

- Move pointer to coordinates through browser-level input.
- Support hover, click, double click, right click, press, release, and drag/drop primitives.
- Apply timing for pre-hover, pointer movement, press duration, double-click gap, drag hold, and post-action settle.
- Let action config choose target point strategy while keeping defaults realistic and stable.
- Never silently replace a failed pointer action with DOM click. Fallback must be explicit and traced.

### KeyboardController

`KeyboardController` owns high-fidelity keyboard and text entry behavior.

Responsibilities:

- Focus targets through pointer or focus primitive before typing.
- Send key down/up sequences through browser-level input.
- Type text character by character with configurable cadence.
- Support clear behavior through select-all/backspace/delete paths before falling back to value mutation.
- Support hotkeys, paste, and press-key actions.
- Verify expected value or focused element when the action provides enough information.

### ScrollController

`ScrollController` owns high-fidelity scrolling.

Responsibilities:

- Prefer browser-level wheel or gesture-style scrolling over `window.scrollBy`.
- Support page, container, into-view, and until-visible behaviors.
- Resolve scrollable containers consistently.
- Retry until target visibility or timeout.
- Keep DOM `scrollIntoView` as an explicit direct helper, not the default high-fidelity path.

### TimingProfile

`TimingProfile` provides structured interaction timing.

Initial fields:

```text
pre_action_delay_ms
post_action_settle_ms
pointer_move_duration_ms
pointer_press_duration_ms
double_click_gap_ms
drag_hold_ms
drag_step_count
key_delay_min_ms
key_delay_max_ms
scroll_step_delay_ms
retry_interval_ms
```

The first implementation can use conservative fixed defaults with optional random ranges. Timing values must be logged in action traces for reproducibility.

### ActionTrace

`ActionTrace` records how an action actually ran.

Minimum trace fields:

```text
node_id
action_type
mode
target_xpath
iframe_xpath
target_point
timing_profile
fallback_used
started_at
completed_at
failure_reason
failure_screenshot_path
```

Trace output should be suitable for run evidence and debugging. It does not need to be exposed as a large UI feature in the first slice, but the backend should make the data available for later UI work.

## Action Migration Plan

### Pointer Actions

Affected actions:

- `click`
- `double_click`
- `right_click`
- `hover`
- `drag_and_drop`

New behavior:

- Resolve target through `TargetResolver`.
- Move pointer through `PointerController`.
- Use browser-level press and release for click family.
- Implement drag/drop as pointer down, movement steps, hover over target, and pointer up.
- Keep `force_dom` click as explicit advanced fallback, with trace marking `direct_dom`.

### Keyboard And Input Actions

Affected actions:

- `input_text`
- `type_sequence`
- `press_key`
- `hotkey`
- `clear_input`
- `paste_clipboard`
- `set_contenteditable`

New behavior:

- Default high-fidelity `input_text` should focus and type through `KeyboardController`.
- Preserve direct value setting as `direct_dom` mode for compatibility and setup cases.
- `type_sequence` should become the high-fidelity text-entry path rather than a separate synthetic DOM script.
- `press_key` and `hotkey` should use browser-level keyboard events.
- Clear should prefer select-all plus delete/backspace through keyboard input.

### Scroll Actions

Affected action:

- `scroll`

New behavior:

- Page and container scroll should use browser-level wheel or gesture primitives.
- Until-visible should perform repeated realistic scroll steps and visibility checks.
- Into-view can use a hybrid approach: resolve target first, then scroll through wheel steps toward the target where practical.

### Form Actions

Affected actions:

- `select_option`
- `set_checkbox`
- `check`
- `uncheck`
- `toggle_checkbox`
- `select_radio`
- `select_custom_option`
- `submit_form`

New behavior:

- Checkbox and radio actions should click the input or associated label through pointer primitives.
- Select actions should prefer pointer and keyboard interaction where practical, then explicit direct select fallback if needed.
- Submit should prefer pointer click on a submit control when a target is provided. `requestSubmit` remains a direct-mode fallback.

### Browser Navigation Actions

Affected actions:

- `navigate`
- `go_back`
- `go_forward`
- `reload`
- `open_new_tab`
- `switch_tab`
- `close_tab`

New behavior:

- Keep current browser-level APIs as default because they are reliable and semantically correct for workflow setup.
- Add optional high-fidelity variants later if there is a concrete test need, such as typing into the address bar or using browser hotkeys.

### Observer And Control Actions

Affected groups:

- waits
- assertions
- extraction
- screenshots
- variables
- network
- storage
- session
- control flow
- manual approval
- challenge detection

New behavior:

- Do not force these into user-like behavior.
- Classify them as `observer`, `direct_dom`, `manual`, or control-flow actions in trace output.
- Keep manual/challenge actions as operator control points, not automated challenge solving.

## Workflow Settings

Add workflow-level interaction settings under the Execution or Browser section.

Recommended shape:

```text
interaction_fidelity: "standard" | "high"
direct_dom_fallback: "disabled" | "explicit" | "allowed_with_trace"
timing_profile: "balanced" | "slow_realistic" | "custom"
```

For the high-fidelity project direction, new high-fidelity workflows should use:

```text
interaction_fidelity: "high"
direct_dom_fallback: "explicit"
timing_profile: "slow_realistic"
```

Existing workflows should retain current behavior until explicitly migrated or until compatibility defaults are changed in a planned release.

## Error Handling

High-fidelity action failures should include:

- target resolution failure reason.
- whether the target was hidden, disabled, covered, detached, unstable, or outside the viewport.
- which input primitive failed.
- whether fallback was available, used, or blocked by settings.
- failure screenshot path when available.

Retries should rerun target resolution because layout and focus state may change between attempts.

## Testing Strategy

Add a local event-recorder test page for runner tests. It should record:

- mouse events and coordinates.
- keyboard events.
- input, change, focus, blur, paste, submit, and scroll events.
- event order and timing windows.
- final DOM state.

Test categories:

- Unit tests for script builders that remain.
- Rust runner tests for interaction primitives.
- Integration tests against the event recorder page.
- Regression tests for existing workflows that rely on direct DOM compatibility.
- Failure tests for hidden, disabled, covered, detached, and moving targets.

Success should be measured by event sequence, not only final DOM state.

## Phased Implementation

### Phase 1: Engine Skeleton And Trace

- Add `InteractionEngine` types.
- Add `TargetResolver` with current XPath/frame behavior.
- Add `ActionTrace` data model behind backend-only storage or run-state extension.
- Keep existing action behavior while wiring trace classification.

### Phase 2: Pointer Migration

- Move click family to `PointerController`.
- Rebuild hover and drag/drop through browser-level pointer primitives.
- Keep explicit direct DOM fallback.

### Phase 3: Keyboard Migration

- Move `press_key`, `hotkey`, `type_sequence`, and high-fidelity `input_text` to `KeyboardController`.
- Add compatibility mode for existing `set_value` input workflows.

### Phase 4: Scroll And Form Migration

- Move scroll to `ScrollController`.
- Move checkbox, radio, custom option, select, and submit actions to pointer/keyboard-first behavior.

### Phase 5: Settings, UI, And Evidence

- Add workflow interaction fidelity settings.
- Expose trace summaries in run details.
- Add user-facing warnings when an action uses direct fallback during high-fidelity runs.

## Documentation Impact

Update these docs during implementation:

- `docs/architecture/runner.md`
- `docs/contracts/workflow-types.md`
- `docs/domain/user-visible-invariants.md`
- `README.md` smoke checklist if user-visible workflow behavior changes

Docs should clearly distinguish user interaction actions from setup, observer, network, storage, and control-flow actions.

## Out Of Scope

- Automated challenge solving.
- Unbounded target domains.
- Automatic proxy rotation or account rotation.
- Device fingerprint spoofing beyond existing explicit workflow browser configuration.
- Rewriting the graph editor UI in the first slice.
- Replacing every direct DOM helper immediately.

## Acceptance Criteria

- User-facing high-fidelity pointer actions use browser-level pointer primitives.
- User-facing high-fidelity keyboard actions use browser-level keyboard primitives.
- Scroll has a browser-level high-fidelity path.
- Form actions prefer pointer/keyboard paths before direct fallback.
- Direct DOM fallback is explicit and visible in traces.
- Observer/control/setup nodes are not mislabeled as user behavior.
- Tests verify event sequences for migrated action groups.
- Runs remain bounded to allowlisted or explicitly authorized targets.
