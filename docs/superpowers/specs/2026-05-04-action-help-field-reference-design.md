# Action Help Field Reference Design

## Status

Approved for implementation by the user on 2026-05-04 after text-only brainstorming.

## Problem

The current action help popup is useful but still too vague for users who need to configure an action correctly. It explains high-level purpose and common mistakes, but it does not consistently explain every field, every select option, when each option should be used, and what values are expected.

The popup also still presents itself as step help. The requested experience should be action-focused and easier to scan.

## Goals

- Rename the action popup context from "Trợ giúp step / Step Help" to "Hướng dẫn action / Action guide".
- Move the language switch into the modal header as a compact toggle.
- Keep Vietnamese and English content first-class.
- Cover every current action type, including hidden compatibility actions when they appear in saved workflows.
- Explain every field in detail.
- For select-like fields, explain every option in detail: what it does, when to use it, when to avoid it, and a useful example where relevant.
- Preserve the existing runtime behavior, serialized action config shapes, runner semantics, and Tauri contracts.

## Non-Goals

- Do not add inline help under every input in the action editor.
- Do not build a separate handbook page or tutorial system.
- Do not change action execution behavior.
- Do not rename serialized action types.
- Do not persist the selected help language.

## UX Design

The help dialog header should contain:

- Left side: eyebrow `Hướng dẫn action` in Vietnamese or `Action guide` in English, plus the action title.
- Right side: a compact language toggle.

The language toggle should be visually smaller than the current full-width segmented control. It should stay in the header and use the existing dark Supabase-inspired treatment: dark surface, subtle border, green active state, no shadow-heavy styling.

The body should render sections in this order:

1. What this action does.
2. Use it when.
3. Use something else when.
4. Minimum setup.
5. All fields and options.
6. Outputs created, when the action creates outputs.
7. Workflow examples.
8. Common mistakes and fixes.
9. Safety notes, when relevant.

For Vietnamese, section labels should use the existing Vietnamese style:

1. Action này làm gì.
2. Dùng khi.
3. Dùng cái khác khi.
4. Cấu hình tối thiểu.
5. Tất cả field và option.
6. Output được tạo.
7. Ví dụ workflow.
8. Lỗi hay gặp và cách sửa.
9. Lưu ý an toàn.

## Content Model

Extend the data-driven help content model instead of hardcoding action-specific layout in the modal.

Recommended shape:

```ts
type ActionFieldReference = {
  name: string;
  description: string;
  requiredWhen?: string;
  example?: string;
  mistakes?: string[];
  options?: Array<{
    label: string;
    value?: string;
    description: string;
    useWhen: string;
    avoidWhen?: string;
    example?: string;
  }>;
};
```

`StepHelpContent` should add:

```ts
fieldReference: ActionFieldReference[];
```

The existing `fields`, `minimalConfig`, and `advancedConfig` can remain during migration, but `fieldReference` becomes the detailed source for the new "All fields and options" section.

## Content Rules

Every action help entry must explain:

- What the field controls in user-facing language.
- Whether the field is required, conditionally required, or optional.
- A realistic example value for fields where examples help.
- Common mistakes for fields that often fail.
- Every select option for fields that map to select controls or enum-like config values.

Examples of option detail requirements:

- `Scroll > Mode`: explain `Page`, `Container`, `Into View`, and `Until Visible`, including how `XPath` changes meaning per mode.
- `Click > Mode`: explain normal pointer click versus DOM-forced fallback and when forced fallback is risky.
- `Click > Button`: explain left, right, and middle click.
- `Click > Position`: explain center, corners, and offset.
- `Wait > Condition`: explain every wait condition and which companion field it requires.
- `Fill Field > Typing mode`: explain fast value setting versus real key events.
- `Select Option > Match by`: explain label versus value.
- Network, storage, session, and JavaScript actions must include safety-oriented wording and avoid bypass, stealth, anti-detection, spam, or challenge-solving language.

## Components And Ownership

Likely implementation files:

- `src/features/workflows/lib/stepHelpContent.ts`
- `src/features/workflows/components/StepHelpModal.tsx`
- `src/features/workflows/lib/stepHelpContent.test.ts`
- `src/features/workflows/components/WorkflowGraphPalettes.tsx` if graph action help reuses header structure.
- `src/styles/modals.css`
- `docs/architecture/frontend.md`
- `docs/domain/user-visible-invariants.md`

The modal component should stay generic and render arrays from content data. It should not branch per action type except for compatibility or empty-content safeguards.

## Accessibility

- The dialog keeps accessible title and description wiring.
- The language toggle remains keyboard reachable.
- Active language state is exposed with the existing tabs semantics or an equivalent accessible selected state.
- The compact header layout must wrap cleanly on narrow widths without overlapping title text.

## Testing

Implementation must use TDD.

Focused tests should cover:

- The action help popup renders `Hướng dẫn action` / `Action guide`.
- The language toggle is rendered in the modal header.
- Every action type has Vietnamese and English help content.
- Every action type has `fieldReference`.
- Every field reference has a non-empty description.
- Select-like field references include option explanations.
- Complex actions such as `click`, `scroll`, and `wait` document all important options.
- Output-producing actions still document outputs.
- Safety-sensitive actions still include safety notes and avoid bypass-oriented wording.

## Acceptance Criteria

- Opening help for any current action gives the user enough detail to configure every field accurately.
- Select options are no longer vague; each option explains what it does and when to choose it.
- The popup header says `Hướng dẫn action` or `Action guide`.
- The language switch is compact and located in the modal header.
- Runtime behavior and action config contracts are unchanged.
- Frontend docs and user-visible invariants match the new popup behavior.

## Self-Review

- No placeholders remain.
- The scope is limited to action help content and rendering.
- The design does not change action semantics or serialized config shapes.
- The content model is testable and data-driven.
