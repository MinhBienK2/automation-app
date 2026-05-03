# Help Content Decision Guide Design

## Status

Approved by the user on 2026-05-04.

This spec redesigns the `?` help experience for action nodes and graph logic
nodes. The goal is to make help content teach users how to choose, configure, and
combine actions and logic nodes, not only define fields.

## Problem

The current help popup already has useful structure:

- what the step/node does,
- when to use it,
- field guide,
- examples,
- common mistakes,
- Vietnamese and English content.

However, users can still feel unclear after reading it because the content often
reads like a technical reference instead of a decision guide.

Current gaps:

- Similar actions are not compared clearly. Users cannot easily decide between
  `Fill Field`, `Type Keys`, `Paste Into Field`, and `Fill Rich Text`.
- Data capture actions do not explain outputs strongly enough: what output is
  created, where it is stored, and how later nodes use it.
- Logic node help needs flow examples that show ports and execution shape.
- Advanced actions need stronger "use only when..." framing and safety notes.
- Field guide content can crowd out the practical path: what to configure first,
  what is optional, and what usually causes failures.
- The help title and labels should follow user-facing action names from
  `2026-05-04-action-node-semantic-grouping-design.md`.

## Goals

- Turn help content into a practical decision guide.
- Help users choose the right action or graph logic node.
- Explain required configuration before advanced fields.
- Show workflow-shaped examples, not only isolated field examples.
- Explain outputs and how they feed `If`, assertions, variables, and later
  actions.
- Explain graph port semantics for logic nodes with readable text diagrams.
- Keep Vietnamese first-class, with English content maintained in parallel.
- Preserve the current `?` entry point from inspector and context menus.

## Non-Goals

- Do not build an AI assistant, tutorial system, or interactive walkthrough in
  this spec.
- Do not change action execution semantics.
- Do not change serialized action config shapes.
- Do not implement palette taxonomy changes here; those are covered by separate
  specs.
- Do not remove existing help content until replacement content exists for the
  affected action or node.

## Content Model

Replace or extend the current help content model with sections that support
decision-making.

Recommended action help shape:

```ts
type ActionHelpContent = {
  title: string;
  summary: string;
  bestFor: string[];
  notFor?: string[];
  chooseInstead?: Array<{
    action: string;
    when: string;
  }>;
  minimalConfig: Array<{
    name: string;
    description: string;
  }>;
  advancedConfig?: Array<{
    name: string;
    description: string;
    whenToUse?: string;
  }>;
  workflowExamples: Array<{
    title: string;
    steps: string[];
    notes?: string[];
  }>;
  outputs?: Array<{
    name: string;
    description: string;
    usedBy: string[];
  }>;
  commonMistakes: Array<{
    mistake: string;
    fix: string;
  }>;
  safetyNotes?: string[];
};
```

Recommended graph node help shape:

```ts
type GraphNodeDecisionHelpContent = {
  title: string;
  summary: string;
  bestFor: string[];
  notFor?: string[];
  portSemantics: Array<{
    port: string;
    kind: "input" | "branch" | "continuation" | "terminal";
    required: boolean;
    description: string;
  }>;
  minimalConfig: Array<{
    name: string;
    description: string;
  }>;
  workflowExamples: Array<{
    title: string;
    diagram: string[];
    notes?: string[];
  }>;
  relatedNodes?: Array<{
    node: string;
    relationship: string;
  }>;
  commonMistakes: Array<{
    mistake: string;
    fix: string;
  }>;
};
```

The implementation may adapt names to fit existing code, but it should preserve
these concepts.

## Popup Layout

The `?` popup should render sections in this order:

1. **What this does**
2. **Use it when**
3. **Use something else when**
4. **Minimum setup**
5. **Advanced fields**
6. **Outputs created** for output-producing actions
7. **Ports and flow** for graph logic nodes
8. **Workflow examples**
9. **Common mistakes and fixes**
10. **Safety notes** when relevant

For Vietnamese:

1. **Action/Node này làm gì**
2. **Dùng khi**
3. **Dùng cái khác khi**
4. **Cấu hình tối thiểu**
5. **Field nâng cao**
6. **Output được tạo**
7. **Port và luồng chạy**
8. **Ví dụ workflow**
9. **Lỗi hay gặp và cách sửa**
10. **Lưu ý an toàn**

The popup should stay concise. It should prefer short bullets, tables, and
monospace text diagrams over long paragraphs.

## Action Help Content Priorities

### Phase 1: Form Fields

Rewrite help for:

- `input_text` displayed as `Fill Field`
- `clear_input` displayed as `Clear Field`
- `type_sequence` displayed as `Type Keys`
- `paste_clipboard` displayed as `Paste Into Field`
- `set_contenteditable` displayed as `Fill Rich Text`
- `select_option`
- `select_custom_option`
- `check`
- `uncheck`
- `toggle_checkbox`
- `select_radio`
- `upload_file`
- `submit_form`

Required decision guidance:

- Use `Fill Field` for normal input, textarea, email, password, search, and
  ordinary form fields.
- Use `Type Keys` when the website depends on real keyboard events, autocomplete,
  masks, or per-key listeners.
- Use `Paste Into Field` when paste behavior is more reliable than typing or the
  text is long.
- Use `Fill Rich Text` for contenteditable and rich text editors.
- Use `Select Option` for native select elements.
- Use `Select Custom Option` for custom React-style dropdowns.
- Prefer `Check` and `Uncheck` over state-dependent toggling when the final state
  matters.

Example content should include login, search, checkbox consent, custom dropdown,
and file upload workflows.

### Phase 2: Capture Data

Rewrite help for:

- `extract_text`
- `extract_attribute`
- `extract_input_value` displayed as `Extract Field Value`
- `extract_table`
- `extract_list`
- `take_screenshot`
- `wait_for_download`
- `execute_js` displayed as `Run JavaScript` where it creates an output

Required decision guidance:

- Explain `output_name` as the name stored in the workflow output store.
- Explain that later conditions and actions can read outputs by name.
- Show examples such as extracting `page_title`, `price_text`,
  `download_path`, or `screenshot_path`.
- Explain when `Extract Text` is wrong and `Extract Attribute` or
  `Extract Field Value` is better.
- Explain that screenshot is evidence/debug output, not text extraction.
- Explain that `Wait For Download` produces a file path after a download starts.

Example:

```text
Navigate product page
-> Extract Text price_text
-> If output price_text contains "$"
-> Take Screenshot screenshot_path
```

### Phase 3: Graph Logic Nodes

Rewrite help for visible logic nodes:

- `if`
- `switch`
- `repeat_times`
- `repeat_for_each`
- `while`
- `repeat_until`
- `break_loop`
- `continue_loop`
- `retry`

Also keep compatibility help for hidden advanced nodes:

- `try_catch`
- `fallback`
- `manual_approval`
- `rate_limit`
- `domain_allowlist`

Required logic guidance:

- Define branch ports vs continuation ports.
- Mark which ports are required and which are optional.
- Explain what happens when optional ports are unconnected.
- Show text diagrams for each node.
- Explain common combinations, such as `If` inside loops with `Break Loop` or
  `Continue Loop`.

Example for `Continue Loop`:

```text
Repeat For Each item
  loop -> If item_invalid
            true  -> Continue Loop
            false -> Process item
  done -> Finish
```

Example for `Retry`:

```text
Retry
  try     -> Click Submit -> Wait Dashboard
  success -> Extract Result
  failed  -> End Failure
```

### Phase 4: Advanced And Sensitive Actions

Rewrite help for:

- session/profile/cookie/storage actions,
- network actions,
- human checkpoint actions,
- reliability actions,
- `Run JavaScript`.

Required guidance:

- Mark actions as advanced when they bypass normal no-code abstraction.
- Explain safe/authorized use cases.
- Avoid bypass, stealth, anti-detection, spam, or challenge-solving language.
- For human checkpoint actions, clearly state that they pause for a person; they
  do not bypass CAPTCHA or third-party account controls.

## Related Action Guidance

The help system should explicitly compare similar actions:

### Text Entry

- `Fill Field`: default for normal fields.
- `Type Keys`: use when real key events matter.
- `Paste Into Field`: use when paste is more reliable or text is long.
- `Fill Rich Text`: use for contenteditable editors.
- `Set Clipboard`: prepares clipboard text but does not target a field.

### Select And Checkbox

- `Select Option`: native select.
- `Select Custom Option`: custom dropdown.
- `Check`: ensure checked.
- `Uncheck`: ensure unchecked.
- `Toggle Checkbox`: flip current state when final state is not known or does
  not matter.

### Data Capture

- `Extract Text`: visible text.
- `Extract Attribute`: href, src, data attributes.
- `Extract Field Value`: current input value.
- `Extract Table`: structured table rows.
- `Extract List`: repeated item list.
- `Run JavaScript`: advanced custom output extraction.

### Flow Control

- `If`: one condition, two paths.
- `Switch`: one value, many cases.
- `Repeat Times`: fixed count.
- `Repeat For Each`: item list.
- `Retry`: retry failure-prone work.
- `Break Loop`: exit loop.
- `Continue Loop`: skip current iteration.

## UI Behavior

- Action help titles should use user-facing labels, such as `Fill Field Help`,
  while examples can mention the serialized type only if necessary.
- Graph action nodes should continue opening action-specific help after the
  action type is selected.
- Unconfigured `New node` help should explain that the user must choose an
  action type before validate/run.
- Hidden or compatibility actions should still have help if they appear in an
  existing graph.
- If content for a newly added action is incomplete, the help should fail loudly
  in tests rather than silently showing vague generic text.

## Data And Code Ownership

Current files likely affected during implementation:

- `src/features/workflows/lib/stepHelpContent.ts`
- `src/features/workflows/lib/graphNodeHelpContent.ts`
- `src/features/workflows/components/StepHelpModal.tsx`
- `src/features/workflows/components/WorkflowGraphPalettes.tsx`
- `src/features/workflows/components/WorkflowGraphInspector.tsx`
- `src/features/workflows/lib/stepHelpContent.test.ts`
- `src/features/workflows/components/WorkflowGraphEditor.test.tsx`

The help content should remain data-driven. Avoid hardcoding per-action layout
branches unless a section truly differs by content type.

## Documentation Updates During Implementation

When implementation changes are made, update:

- `docs/architecture/frontend.md` for help content ownership and popup behavior.
- `docs/domain/user-visible-invariants.md` if help behavior or user-facing labels
  change.
- `docs/domain/action-taxonomy.md` if the help content adopts renamed
  user-facing labels from action taxonomy specs.
- `README.md` smoke checklist if manual verification should include opening help
  for action, logic, and hidden compatibility nodes.

## Testing

Implementation should add or update focused tests:

- Every visible action type has complete help content in Vietnamese and English.
- Every graph node type has complete help content in Vietnamese and English.
- Help content for related actions includes "use something else when" guidance
  where required.
- Output-producing actions include an outputs section.
- Logic nodes include port semantics and at least one workflow-shaped example.
- `Fill Field` help opens for `input_text` and uses user-facing labels.
- Unconfigured `New node` help explains that choosing an action type is required.
- Hidden compatibility actions still render help when loaded from existing
  graphs.
- Safety-sensitive actions include safety notes and avoid bypass-oriented copy.

Required checks during implementation:

- Focused Vitest tests for help content data.
- Focused component tests for `StepHelpModal` and graph node help rendering.
- `npx tsc --noEmit` when content types or component props change.

## Acceptance Criteria

- Users can open `?` on an action and understand when to use it, when not to use
  it, the minimum fields to configure, and common fixes.
- Users can open `?` on logic nodes and understand ports, branch behavior,
  continuation behavior, required links, optional links, and common combinations.
- Similar actions are compared directly.
- Output-producing actions explain output names and later usage.
- Help content remains bilingual.
- Runtime behavior, action configs, and graph semantics remain unchanged.

## Self-Review

- No placeholders remain.
- The spec focuses on help content and rendering, not action execution.
- The design preserves existing button entry points.
- The scope can be implemented in phases without blocking palette cleanup specs.
