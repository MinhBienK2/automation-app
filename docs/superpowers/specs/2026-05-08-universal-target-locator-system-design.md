# Universal Target Locator System Design

## Status

Proposed on 2026-05-08. This spec is docs-only and is not yet approved for implementation.

## Problem

Many current browser actions identify elements through `xpath`, `iframe_xpath`, or action-specific variants such as `source_xpath`, `target_xpath`, and `trigger_xpath`. XPath remains useful, but XPath-only authoring is brittle for production-like pages where DOM structure changes by account state, A/B tests, responsive layout, hydration timing, ads, virtualized lists, or challenge/friction flows.

The current model also makes logic nodes less expressive than the workflow domain needs. Conditions such as "element is visible", "URL changed", "network response returned 200", "output variable equals value", or "page contains text" should use one shared condition model instead of being tied to a single XPath field.

The upgrade should make element targeting stable and explainable without breaking existing workflows.

## Goals

- Replace XPath-only authoring with a universal element target model.
- Keep all existing workflows compatible. Existing `xpath` fields must continue to deserialize, validate, render, and execute.
- Let users choose locator type in the UI instead of always entering XPath.
- Support a primary locator plus ordered fallback locators.
- Apply the target model consistently across all element actions, capture actions, wait actions, assertion actions, and element-based logic conditions.
- Add a shared runner resolver that converts a target into the concrete element used by an action.
- Preserve current runner semantics, cancellation behavior, browser retention, progress reporting, and graph compile behavior unless explicitly changed here.
- Produce useful evidence when a target cannot be resolved: attempted locators, match counts when available, failure reason, and the action/node id already carried by run state.

## Non-Goals

- Do not remove XPath.
- Do not force migration of persisted workflow JSON in a database migration.
- Do not rewrite every browser action script from scratch in the first implementation pass.
- Do not introduce third-party automation APIs or external browser services.
- Do not change the product safety boundary for authorized owned targets.
- Do not add CAPTCHA solving or hidden bypass behavior.

## Product Concept

Users configure an action target through an "Element target" editor rather than a raw XPath-only field.

Example authoring model:

```text
Element target
Primary locator
Type: Role + name
Role: button
Name: Log in

Fallback locators
- Test id: login-button
- CSS: button[type="submit"]
- XPath: //*[@id='login']

Constraints
[x] Wait until visible
[x] Must be enabled
Timeout: 8000 ms
```

The action still has the same user intent: "Click", "Fill Field", "Extract Text", and so on. The difference is that the action references a durable target object instead of only a DOM path.

## Data Model

Add shared TypeScript and Rust DTOs for target selection.

```ts
type ElementLocatorKind =
  | "test_id"
  | "role"
  | "label"
  | "placeholder"
  | "text"
  | "css"
  | "xpath"
  | "attribute";

type ElementLocator = {
  kind: ElementLocatorKind;
  value: string;
  role?: string | null;
  attribute?: string | null;
  exact?: boolean | null;
};

type ElementTargetConstraints = {
  visible?: boolean | null;
  enabled?: boolean | null;
  contains_text?: string | null;
  index?: number | null;
};

type ElementTarget = {
  locators: ElementLocator[];
  constraints?: ElementTargetConstraints | null;
  iframe?: ElementTarget | null;
};
```

Rust should mirror this shape with serde-compatible structs and enums:

```rust
pub enum ElementLocatorKind {
    TestId,
    Role,
    Label,
    Placeholder,
    Text,
    Css,
    Xpath,
    Attribute,
}

pub struct ElementLocator {
    pub kind: ElementLocatorKind,
    pub value: String,
    pub role: Option<String>,
    pub attribute: Option<String>,
    pub exact: Option<bool>,
}

pub struct ElementTargetConstraints {
    pub visible: Option<bool>,
    pub enabled: Option<bool>,
    pub contains_text: Option<String>,
    pub index: Option<usize>,
}

pub struct ElementTarget {
    pub locators: Vec<ElementLocator>,
    pub constraints: Option<ElementTargetConstraints>,
    pub iframe: Option<Box<ElementTarget>>,
}
```

### Compatibility Rule

For any action that currently has `xpath`, `iframe_xpath`, `source_xpath`, `target_xpath`, or `trigger_xpath`, add the corresponding optional `target` field while preserving legacy fields:

- `target` for the main element.
- `source_target` and `target_target` for drag and drop.
- `trigger_target` for custom select.
- `iframe` nested in `ElementTarget` for new configs, while `iframe_xpath` remains supported.

Existing serialized configs remain valid:

```json
{
  "type": "click",
  "config": {
    "xpath": "//*[@id='login']"
  }
}
```

New configs may use target-first shape:

```json
{
  "type": "click",
  "config": {
    "xpath": "",
    "target": {
      "locators": [
        { "kind": "role", "role": "button", "value": "Log in" },
        { "kind": "xpath", "value": "//*[@id='login']" }
      ],
      "constraints": {
        "visible": true,
        "enabled": true
      }
    }
  }
}
```

The legacy `xpath` field may stay empty when a valid `target` is present.

## Scope By Node Type

### Element Actions

Add target support to:

- `input_text`
- `clear_input`
- `click`
- `scroll` for `into_view`, `until_visible`, and container scrolling
- `select_option`
- `set_checkbox`
- `hover`
- `double_click`
- `right_click`
- `drag_and_drop`
- `focus_element`
- `blur_element`
- `type_sequence`
- `paste_clipboard`
- `check`
- `uncheck`
- `toggle_checkbox`
- `select_radio`
- `upload_file`
- `submit_form`
- `select_custom_option`
- `set_contenteditable`

### Capture And Assertion Actions

Add target support to:

- `extract_text`
- `extract_attribute`
- `extract_input_value`
- `extract_table`
- `extract_list`
- `assert_element`
- `assert_text` when scoped to an element
- `wait` when condition is element-based

### Browser Context Actions

`switch_frame` should support a frame target, but it may remain compatible with `xpath` as the first implementation. New iframe targeting should share the same resolver instead of a separate XPath-only path.

### Logic Nodes

Extend `WorkflowCondition` so element-related conditions can use `ElementTarget`:

```ts
type WorkflowCondition =
  | { kind: "output_equals"; name: string; value: string }
  | { kind: "output_contains"; name: string; value: string }
  | { kind: "text_visible"; text: string }
  | { kind: "url_contains"; value: string }
  | { kind: "element_visible"; xpath?: string | null; target?: ElementTarget | null }
  | { kind: "element_exists"; target: ElementTarget }
  | { kind: "element_enabled"; target: ElementTarget }
  | { kind: "element_text_contains"; target: ElementTarget; text: string };
```

The first pass may only add `target` to existing `element_visible`; follow-up work can add the new condition kinds once the resolver is stable.

## Resolver Design

Add a shared runner-side target resolver. Its job is to resolve `ElementTarget` to a concrete DOM node.

Resolution order:

1. Use each locator in `target.locators` in array order.
2. For each locator, query all matching candidates.
3. Apply constraints: visible, enabled, contains text, and index.
4. Return the first passing candidate.
5. If no candidate passes before timeout, return a structured failure reason.

Locator behavior:

- `test_id`: match `[data-testid="value"]`, `[data-test="value"]`, and `[data-qa="value"]`.
- `role`: match explicit `[role="role"]` and common native equivalents where practical; compare accessible-ish name through text, `aria-label`, `title`, or `value`.
- `label`: find form controls associated with a matching `<label>`.
- `placeholder`: match form controls by placeholder.
- `text`: match visible text content.
- `css`: use `querySelectorAll`.
- `xpath`: use `document.evaluate`.
- `attribute`: match `[attribute="value"]`; requires `attribute`.

The resolver should support iframe lookup through:

- New `target.iframe` when present.
- Legacy `iframe_xpath` fallback when present.
- Current session frame state from `switch_frame`.

## First Implementation Strategy

Implement this as a compatibility layer instead of a full runner rewrite.

1. Add domain and TypeScript target DTOs.
2. Add optional target fields to all affected configs.
3. Add validation helpers:
   - If `target` is present, it must have at least one locator.
   - Each locator must have a non-empty `value`.
   - `attribute` locator must have a non-empty `attribute`.
   - Element actions accept either a valid `target` or the legacy required XPath.
4. Add frontend target editor and updater.
5. Add runner resolver that returns an XPath-like handle for existing scripts in the first pass.
6. Keep existing action scripts mostly intact, but feed them the resolved XPath when `target` is present.

The first runner pass can generate a temporary runtime XPath for the resolved element. This keeps click, input, form, wait, and extraction scripts reusable. A later refactor can pass opaque element handles or inline resolver code into every action script if needed.

## UI Design

Use one shared `ElementTargetFields` component for all element-targeted action editors.

Fields:

- Locator type select.
- Locator value input.
- Optional role select/input for role locator.
- Optional attribute name input for attribute locator.
- Exact match toggle for text-like locators.
- Add fallback locator.
- Remove fallback locator.
- Reorder fallback locators.
- Constraints: visible, enabled, contains text, nth match/index.
- Advanced iframe target section.

Default UX:

- New action configs should default to one XPath locator for compatibility until recorder/suggestion support is upgraded.
- The visible label should be "Element target", not "XPath".
- The XPath option should be available under locator type.
- Existing configs with only `xpath` should display as a target row of type XPath.

The design system remains the existing Supabase-inspired dark theme. Use current inputs, selects, switches/checkboxes, segmented controls, and compact buttons. Do not introduce a new visual language for the target editor.

## Recorder And Builder Assist

Update selector suggestion and recorded event normalization to emit multiple locator candidates.

For a clicked or typed element, suggested order should prefer:

1. Stable test id attributes.
2. Role plus accessible-ish name.
3. Label or placeholder for form fields.
4. Stable semantic attributes such as `name`, `type`, `href`, or `aria-label`.
5. CSS selector.
6. XPath fallback.

Recorded events should keep legacy fields for compatibility but include `target`:

```json
{
  "type": "click",
  "xpath": "//*[@id='save']",
  "target": {
    "locators": [
      { "kind": "test_id", "value": "save-button" },
      { "kind": "role", "role": "button", "value": "Save" },
      { "kind": "xpath", "value": "//*[@id='save']" }
    ]
  }
}
```

## Migration And Backward Compatibility

No destructive migration is required.

On load or edit:

- If `target` exists, render and save it.
- If `target` is missing and legacy XPath exists, render a synthetic target row in the UI without mutating persisted JSON until the user saves.
- When the user edits target fields, persist both:
  - `target` as source of truth for new behavior.
  - legacy `xpath` with the first XPath locator when one exists, or an empty string for compatibility with current enum shapes.

On run:

- Prefer `target` when present and valid.
- Fall back to legacy XPath when `target` is absent.

On export/import:

- Preserve both `target` and legacy fields.
- Do not strip target locator metadata.

## Validation Semantics

For element actions:

- A valid target satisfies the element requirement.
- Without target, existing XPath validation remains unchanged.
- Empty target locators fail with field `target`.
- Blank locator values fail with field `target`.
- Attribute locator without attribute name fails with field `target`.
- Invalid timeout, click count, option text, files, output name, and other existing validations remain unchanged.

For logic conditions:

- Existing `{ kind: "element_visible", xpath }` remains valid.
- `{ kind: "element_visible", target }` is valid when the target is valid.
- Blank XPath with no target remains invalid.

## Runner Semantics

Target resolution should respect current action behavior:

- Timeouts still come from action config or workflow execution defaults.
- Cancellation remains responsive between actions and during long waits where currently supported.
- Action failures still become failed runner outcomes.
- Failure messages should identify target resolution failure clearly.
- Existing failure screenshot behavior remains unchanged.

Recommended failure reasons:

- `Target not found`
- `Target matched no visible elements`
- `Target matched no enabled elements`
- `Target locator value is required`
- `Iframe target not found`

Where possible, include the locator kind in diagnostic detail:

```text
Target not found after trying role(button, "Log in"), css("button[type='submit']"), xpath("//*[@id='login']")
```

## Documentation Updates Required During Implementation

Update current source-of-truth docs when code changes:

- `docs/domain/action-taxonomy.md`
- `docs/domain/execution-semantics.md`
- `docs/domain/user-visible-invariants.md`
- `docs/contracts/action-configs.md`
- `docs/contracts/workflow-types.md`
- `docs/architecture/domain.md`
- `docs/architecture/runner.md`
- `docs/architecture/frontend.md`
- `README.md` smoke checklist if user-visible run/build behavior changes.

## Testing Plan

Follow TDD for implementation.

Rust/domain tests:

- Element action with valid `target` and blank `xpath` validates.
- Element action with blank `xpath` and no target still fails.
- Empty `target.locators` fails.
- Blank locator value fails.
- Attribute locator without `attribute` fails.
- `WorkflowCondition::ElementVisible` accepts target or legacy XPath.
- Serde round-trip preserves legacy configs and target configs.

Frontend tests:

- `ActionConfig` TypeScript shapes accept target fields.
- `workflowStepForm` updates locator kind, value, role, attribute, exact, fallback rows, constraints, and iframe target.
- Existing XPath edits still work.
- Defaults remain valid.
- Action summaries show a readable target summary instead of only "No XPath".
- Action editor renders target fields for all affected action groups.

Runner tests:

- Resolver script finds by test id.
- Resolver script finds by role/name.
- Resolver script finds by label.
- Resolver script finds by placeholder.
- Resolver script finds by CSS.
- Resolver script falls back to XPath.
- Resolver applies visible/enabled constraints.
- Runner falls back to legacy XPath when target is absent.
- Runner reports clear failure when no locator matches.

Command/import/export tests:

- Recorded events normalize to target plus legacy XPath.
- Import/export preserves target fields.
- Dry-run validation returns field-addressable target errors.

## Rollout Plan

### Phase 1: Schema And Validation

Add shared target DTOs to Rust and TypeScript. Add optional target fields to affected configs. Update validation so target or legacy XPath can satisfy element targeting.

### Phase 2: Frontend Authoring

Replace raw XPath-only UI with shared Element Target editor. Keep XPath as a locator type. Update summaries and help content.

### Phase 3: Runner Resolver

Add resolver and route target-backed actions through it. Reuse existing action scripts with resolved XPath/runtime handle for the first pass.

### Phase 4: Recorder And Suggestions

Upgrade selector suggestions and recorded event normalization to produce ordered locator candidates.

### Phase 5: Logic Conditions

Add target-backed element conditions and update graph-native condition fields.

### Phase 6: Cleanup

After target-backed execution is proven, reduce duplicated XPath-specific UI code. Do not remove legacy serde fields unless a separate migration spec is approved.

## Open Decisions

- Whether new configs should persist an empty legacy `xpath` when no XPath locator exists, or synthesize a best-effort XPath automatically.
- Whether role options should be a free text input or a constrained select with common roles.
- Whether the first runner pass should resolve target to generated XPath or inline resolver code into each action script.
- Whether target evidence should be stored in run outputs or only included in failure messages.

## Recommended Decision

Use a generated-runtime-XPath compatibility layer for the first implementation. It gives the product the main benefit, multi-locator target authoring, while limiting risk to the existing action modules. Once tests prove the resolver works across target kinds, action scripts can be refactored gradually to operate directly on resolved elements.

