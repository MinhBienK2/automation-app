# Help Schema Catalog Design

## Status

Approved for specification by the user on 2026-05-04 after text-only brainstorming.

The user selected the schema-driven approach and required that the readability improvements from the lighter layout approach remain in scope. The standalone main-section order must not include a separate "Common mistakes" section, but mistake guidance may still appear inside field and option details where it helps users avoid incorrect configuration.

## Problem

The current help popup has moved in the right direction, but it is still not detailed enough for users configuring browser automation actions and graph logic nodes.

Specific issues:

- Some action field explanations are still generated from broad fallback text such as "this field appears in this action's configuration form".
- Select-like fields are not consistently documented from the same source as the actual form options.
- Graph-native logic nodes explain purpose and ports, but they do not have a detailed field-and-option reference comparable to action help.
- The help UI can become dense because all fields are presented as a flat list.
- Existing tests prove some important option sets exist, but they do not guarantee that every action form select and graph node select has detailed help.

Users need help that is concrete enough to answer:

- What does this field control?
- Is it required, optional, conditionally required, or advanced?
- What value should I type?
- What happens if I choose each select option?
- When should I choose one option instead of another?
- What is a realistic configuration example?
- How does this node connect to the rest of the graph?

## Goals

- Create a schema/catalog source for action and graph-node help content.
- Preserve all current runtime behavior, serialized config shapes, validation semantics, runner behavior, Tauri contracts, and persistence.
- Keep the current popup-based help experience, but make it easier to scan.
- Document every visible action.
- Document hidden compatibility actions well enough when they appear in saved workflows.
- Document every graph-native node.
- Document every field currently shown in action config forms and graph node config forms.
- Document every select option currently shown in action config forms and graph node config forms.
- Keep Vietnamese and English content first-class.
- Remove generic fallback descriptions from real configurable fields.
- Group detailed fields by required, optional, and advanced status.
- Keep field-level and option-level mistake guidance where it clarifies a likely misconfiguration.
- Keep safety-sensitive wording conservative for session, storage, proxy, network, JavaScript, manual checkpoint, and challenge-detection related actions.

## Non-Goals

- Do not add inline help under each editor input in this change.
- Do not add a separate handbook page.
- Do not add tutorials, onboarding tours, or generated walkthroughs.
- Do not change action names, action config JSON, graph node JSON, validation rules, or runner execution.
- Do not rename serialized action types or graph node types.
- Do not persist selected help language.
- Do not make the help catalog the source of truth for form rendering in this iteration.

## Current Sources To Respect

The implementation should respect these current source files:

- `src/types/workflow.ts` for `ActionType`, `ActionConfig`, `GraphNodeType`, and `WorkflowCondition`.
- `src/lib/workflowUi.ts` for user-facing action labels, visible groups, hidden compatibility action types, and summaries.
- `src/features/workflows/components/ActionConfig*Fields.tsx` for actual action form fields and select options.
- `src/features/workflows/components/WorkflowGraphInspectorFields.tsx` for actual graph node config fields and select options.
- `src/features/workflows/components/WorkflowGraphConditionFields.tsx` for condition-kind options.
- `src/features/workflows/lib/stepHelpContent.ts` for existing bilingual action help.
- `src/features/workflows/lib/graphNodeHelpContent.ts` for existing bilingual graph node help.
- `src/features/workflows/components/StepHelpModal.tsx` for current modal layout.
- `src/styles/modals.css` for current help modal styling.

## Help Catalog Architecture

Introduce a data-driven help catalog layer. The exact file split can be adjusted during implementation, but the design should keep these responsibilities separate.

### Shared Field Catalog

Create a shared field catalog for reusable field definitions.

Examples of reusable fields:

- `XPath`
- `Iframe XPath`
- `Timeout ms`
- `Wait until`
- `Output name`
- `Condition kind`
- `Match mode`
- `Status`
- `URL contains`
- `Delay ms`
- `Block`
- `Inline`
- `Mobile`
- `Touch`

Each reusable field definition should include bilingual text:

```ts
type HelpFieldDefinition = {
  id: string;
  label: Record<HelpLanguage, string>;
  description: Record<HelpLanguage, string>;
  requiredRule: Record<HelpLanguage, string>;
  category: "required" | "optional" | "advanced";
  valueGuidance?: Record<HelpLanguage, string>;
  example?: Record<HelpLanguage, string>;
  mistakeGuidance?: Record<HelpLanguage, string[]>;
  options?: HelpOptionDefinition[];
};
```

The shared catalog should explain reusable concepts once, then allow action/node schemas to override details where the meaning changes.

Example: `XPath` means "target element XPath" for Click, but means "scroll container XPath" for Scroll mode `Container` and "target to reveal" for Scroll mode `Into View` or `Until Visible`. Scroll should override the generic XPath wording so the user does not misunderstand which element to select.

### Option Definitions

Every select-like option should use a structured option model:

```ts
type HelpOptionDefinition = {
  label: Record<HelpLanguage, string>;
  value: string;
  description: Record<HelpLanguage, string>;
  useWhen: Record<HelpLanguage, string>;
  avoidWhen?: Record<HelpLanguage, string>;
  example?: Record<HelpLanguage, string>;
};
```

Option content must be concrete. For example:

- `Wait until > Clickable`: explain that the element must be visible, enabled, and able to receive the action.
- `Wait until > Attached`: explain that DOM presence is enough, but it may still be invisible or not clickable.
- `Select Option > Match by > Label`: explain visible option text and language-sensitive labels.
- `Select Option > Match by > Value`: explain the HTML `value` attribute and why it is often more stable.
- `Stop Workflow > Status > Success`: explain intentional non-error ending.
- `Stop Workflow > Status > Failure`: explain intentional failed ending and visible run status.

### Action Help Schemas

Create action schemas keyed by `ActionType`.

```ts
type ActionHelpSchema = {
  actionType: ActionType;
  fields: HelpFieldReference[];
};

type HelpFieldReference = {
  fieldId: string;
  category?: "required" | "optional" | "advanced";
  descriptionOverride?: Record<HelpLanguage, string>;
  requiredRuleOverride?: Record<HelpLanguage, string>;
  valueGuidanceOverride?: Record<HelpLanguage, string>;
  exampleOverride?: Record<HelpLanguage, string>;
  mistakeGuidanceOverride?: Record<HelpLanguage, string[]>;
  optionsOverride?: HelpOptionDefinition[];
};
```

The action schema should list the exact fields users see for that action. It should not rely on generic fallback text for real configurable fields.

Examples:

- `navigate`: URL, Wait until, Timeout ms.
- `wait`: Condition, Duration ms, XPath, Text, URL contains, Timeout ms.
- `click`: XPath, Mode, Click count, Button, Iframe XPath, Scroll into view, Block, Inline, Position, Offset X / Offset Y, Wait until, Timeout ms, Retry interval ms, Post-click wait ms.
- `scroll`: Mode, Direction, Pixels, XPath, Max attempts, Wait ms, Iframe XPath, Behavior, Block, Inline.
- `select_option`: XPath, Match by, Value, Iframe XPath, Wait until, Timeout ms.
- `set_viewport`: Width, Height, Device scale factor, Mobile, Touch.
- `assert_text`: XPath, Text, Match mode, Timeout ms.
- `execute_js`: Script, Output name, Timeout ms.

Hidden compatibility actions should also have schemas. If a hidden action has no visible editor fields in the current UI, the schema may use a single "Compatibility behavior" or "No fields" entry, but it must explain what that means in saved workflows.

### Graph Node Help Schemas

Create graph node schemas keyed by `GraphNodeType`.

```ts
type GraphNodeHelpSchema = {
  nodeType: GraphNodeType;
  fields: HelpFieldReference[];
  ports?: HelpPortReference[];
};

type HelpPortReference = {
  id: string;
  label: Record<HelpLanguage, string>;
  kind: "input" | "branch" | "continuation" | "terminal";
  required: boolean;
  description: Record<HelpLanguage, string>;
  missingBehavior?: Record<HelpLanguage, string>;
  example?: Record<HelpLanguage, string>;
};
```

Graph node schemas should cover both inspector fields and port/flow semantics.

Examples:

- `if`: Condition kind, Output name/Value or Text/URL/XPath depending on condition; ports `in`, `true`, `false`, `done`.
- `switch`: Switch expression, Switch cases; ports `in`, `case_N`, `default`, `done`.
- `repeat_times`: Times; ports `in`, `loop`, `done`.
- `repeat_for_each`: Item name, Items; ports `in`, `loop`, `done`.
- `while`: Condition kind, Loop max attempts, Loop timeout ms; ports `in`, `loop`, `done`.
- `repeat_until`: Condition kind, Loop max attempts, Loop timeout ms; ports `in`, `loop`, `done`, `timeout`.
- `retry`: Max attempts, Delay ms; ports `in`, `try`, `success`, `failed`.
- `try_catch`: no ordinary input fields; ports explain try, error, and done behavior.
- `fallback`: no ordinary input fields; ports explain primary, fallback, and done behavior.
- `stop_workflow`: Status, Reason.
- `assert_output`: Output name, Match, Expected value.
- `manual_approval`: Approval reason, Timeout ms, with safety wording that it is a human checkpoint, not a challenge bypass.
- `domain_allowlist`: Allowed domains, with examples like `example.com` and no path.

## Help Rendering

The popup should remain data-driven. Rendering components should receive already-normalized help content and should not branch per action type or graph node type except for safe empty-content fallbacks.

### Action Help Main Section Order

Action help should render sections in this order:

1. What this action does.
2. Use it when.
3. Use something else when.
4. Minimum setup.
5. All fields and options.
6. Outputs created, when applicable.
7. Workflow examples.
8. Safety notes, when applicable.

Vietnamese labels:

1. Action này làm gì.
2. Dùng khi.
3. Dùng cái khác khi.
4. Cấu hình tối thiểu.
5. Tất cả field và option.
6. Output được tạo.
7. Ví dụ workflow.
8. Lưu ý an toàn.

There should be no standalone top-level "Common mistakes and fixes" section in the main order. Mistake guidance belongs inside the relevant field or option item.

### Graph Node Help Main Section Order

Graph node help should render sections in this order:

1. Node này làm gì / What this node does.
2. Dùng khi / Use it when.
3. Port và flow / Ports and flow.
4. Cấu hình tối thiểu / Minimum setup.
5. Tất cả field và option / All fields and options.
6. Ví dụ workflow / Workflow examples.
7. Lưu ý an toàn / Safety notes, when applicable.

There should be no standalone top-level "Common mistakes" section in this main order.

### Field Grouping

The "All fields and options" section should group fields by:

- Required / Bắt buộc.
- Optional / Tùy chọn.
- Advanced / Nâng cao.

Each field card should show:

- Field label.
- Category badge.
- Description.
- Required/optional rule.
- Value guidance, when useful.
- Example, when useful.
- Mistake guidance, when useful.
- Options, when present.

The field order should follow the actual form order inside each group as much as possible. This keeps help aligned with the editor.

### Option Rendering

Each option should render as a compact block under its field:

- Option label.
- Raw value in monospace, when useful.
- What it does.
- Use when.
- Avoid when, when useful.
- Example, when useful.

The layout should be easy to scan on desktop and mobile. It should preserve the existing dark Supabase-inspired theme, subtle borders, 8px or smaller card radius, and compact typography.

## Content Depth Rules

Every real configurable field must have a specific explanation. Generic fallback text is only acceptable for intentional no-field compatibility entries.

Field descriptions should be written for users configuring workflows, not for developers reading config JSON.

Good field guidance:

- "XPath selects the exact button, input, row, or element this action acts on. If the element is inside an iframe, XPath is evaluated inside that iframe after Iframe XPath selects the frame."
- "Timeout ms is the maximum time this action waits before failing. Use 5000 for 5 seconds; increase it for slow pages, but do not use it to hide an incorrect XPath."
- "Output name is the name later logic nodes and actions use to read this captured value. Use stable names like `price_text`, `download_path`, or `login_state`."

Weak field guidance to remove:

- "This field appears in this action's configuration form."
- "Required when this field appears in minimum setup."
- "Use to tune behavior."

Option descriptions should compare choices directly when users are likely to confuse them.

Examples:

- `Set value` versus `Type keys`: Set value is faster for ordinary inputs; Type keys is better for masks, autocomplete, and per-key listeners.
- `Label` versus `Value`: Label matches visible text; Value matches the HTML attribute and is often more stable.
- `Page` versus `Container` scroll: Page scrolls the page; Container scrolls a nested scrollable element.
- `Into View` versus `Until Visible`: Into View moves an existing element into view; Until Visible repeatedly scrolls to find an element that may appear after lazy loading.
- `Output equals` versus `Output contains`: Equals requires exact match; Contains accepts a substring and is better for longer or changing text.

## Select Coverage Requirements

The schema must cover select options from these current UI sources:

- `ActionConfigCoreFields.tsx`
- `ActionConfigPointerFields.tsx`
- `ActionConfigFormFields.tsx`
- `ActionConfigCaptureFields.tsx`
- `ActionConfigOutputFields.tsx`
- `ActionConfigLogicFields.tsx`
- `ActionConfigSessionFields.tsx`
- `ActionConfigElementSharedFields.tsx`
- `WorkflowGraphConditionFields.tsx`
- `WorkflowGraphInspectorFields.tsx`

Known select-like fields that must have option help:

- Navigate `Wait until`: Load, DOMContentLoaded, Network idle.
- Wait `Condition`: Duration, Element visible, Element hidden, Element attached, Element detached, Text visible, URL contains, Page load, Element enabled, Element disabled.
- Fill Field `Clear before input`: Yes, No.
- Fill Field `Typing mode`: Set value, Type keys.
- Element action `Wait until`: Clickable, Visible, Enabled, Attached.
- Clear Field `Method`: Select all, Backspace, DOM value.
- Click `Mode`: Real click, Force DOM click.
- Click `Click count`: Single, Double.
- Click `Button`: Left, Right, Middle.
- Click `Scroll into view`: Yes, No.
- Click and Scroll `Block`: Start, Center, End, Nearest.
- Click and Scroll `Inline`: Start, Center, End, Nearest.
- Click `Position`: Center, Top left, Top right, Bottom left, Bottom right, Offset.
- Scroll `Mode`: Page, Container, Into View, Until Visible.
- Scroll `Direction`: Down, Up, Left, Right.
- Scroll `Behavior`: Instant, Smooth.
- Select Option `Match by`: Label, Value.
- Set Checkbox `State`: Checked, Unchecked.
- Fill Rich Text `Clear before input`: Yes, No.
- Screenshot `Full page`: Yes, No.
- Assert Element `State`: Visible, Hidden, Attached, Enabled, Disabled.
- Assert Text `Match mode`: Contains, Equals.
- Stop Workflow `Status`: Success, Failure.
- Set Viewport `Mobile`: False, True.
- Set Viewport `Touch`: False, True.
- Graph condition `Condition kind`: Output equals, Output contains, Text visible, URL contains, Element visible.
- Graph assert output `Match`: Equals, Contains.

If implementation finds additional select-like fields, they must be added to this list and to tests.

## Safety Requirements

Safety-sensitive help must be practical without encouraging abuse.

Required wording rules:

- `detect_challenge` explains detection and routing to human review, not solving or bypassing challenges.
- `pause_for_human` and `manual_approval` are described as human checkpoints.
- `resume_when_condition` must not imply bypassing third-party controls.
- `use_proxy`, `set_extra_headers`, `mock_response`, and `execute_js` must mention authorized environments or controlled testing where appropriate.
- Avoid words and examples that frame the app as stealth, anti-detection, CAPTCHA bypass, spam, account creation abuse, or evasion tooling.

## UI And Styling

The visual treatment should stay consistent with `DESIGN.md`:

- Dark surfaces using the existing `#171717` and `#0f0f0f` style.
- Thin borders for depth.
- Green only as a small accent for active or important labels.
- No heavy shadows.
- Cards and option blocks at 8px radius or less.
- Compact typography that does not look like a landing page.
- Mobile layout must wrap instead of overlapping header, tabs, field badges, or option values.

Implementation should likely adjust `src/styles/modals.css` for:

- Field group headings.
- Required/optional/advanced badges.
- Option block spacing.
- Monospace value chips.
- Responsive wrapping.

## Testing

Implementation must use TDD because this is a behavior and UI change.

Recommended focused tests:

- Every `ActionType` in `allActionOptions` resolves to bilingual help content.
- Every visible action has a schema-backed field reference.
- Every hidden compatibility action has at least compatibility-safe help.
- Every `GraphNodeType` resolves to bilingual help content.
- Every graph node with inspector fields has schema-backed field reference.
- Every schema-backed field has non-empty description, required rule, category, and at least one concrete value guidance or example unless it is an intentional no-field entry.
- No real configurable field uses generic fallback text.
- Every select-like field listed in this spec has option help for every rendered option value.
- Every option has non-empty description and useWhen text.
- Safety-sensitive actions do not contain bypass, stealth, anti-detection, or challenge-solving language.
- `StepHelpModal` renders grouped field sections and option detail blocks.
- Graph node help modal renders "Ports and flow" before "All fields and options".
- Existing action guide header and compact language toggle still render.

Recommended commands:

- `npm test -- src/features/workflows/lib/stepHelpContent.test.ts`
- `npm test -- src/features/workflows/components/StepHelpModal.test.tsx`
- `npm test -- src/features/workflows/components/WorkflowGraphEditor.test.tsx` if graph help rendering is touched there.
- `npx tsc --noEmit`

## Documentation Updates

If implementation changes code, update current docs where needed:

- `docs/domain/user-visible-invariants.md` for the new help section order and schema-backed coverage.
- `docs/architecture/frontend.md` for help catalog ownership and modal rendering responsibilities.

No runner, domain validation, command-boundary, persistence, or workflow-type docs should change unless implementation unexpectedly touches those boundaries.

## Acceptance Criteria

- Users can open help for any current action and understand every field well enough to configure it.
- Users can open help for graph logic nodes and understand both fields and port flow.
- Every select option in action and graph config forms has clear bilingual explanation.
- Help content includes concrete examples and value guidance, not generic placeholders.
- Fields are grouped by Required, Optional, and Advanced.
- Options show what they do, when to use them, when to avoid them, and examples where useful.
- The standalone main "Common mistakes" section is removed from action and graph node help order.
- Field-level or option-level mistake guidance remains available where it makes configuration easier.
- Runtime behavior and serialized data contracts are unchanged.
- Frontend tests enforce schema coverage and option coverage.

## Self-Review

- No placeholders remain.
- Scope is focused on schema-backed help content, popup rendering, and help tests.
- The design includes the readability improvements from the lighter approach.
- The design excludes runtime, contract, runner, validation, and persistence changes.
- The standalone main "Common mistakes" section is explicitly out of the render order.
- The spec names concrete source files and select option sets to verify.
