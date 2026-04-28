# Step Help Popup Design

## Goal

Add an easy-to-understand help entry point for every workflow step type so users can understand what each step does, when to use it, and what each field means before saving or running a workflow.

The help must reduce common confusion around XPath, iframe XPath, wait conditions, scroll modes, click modes, keyboard syntax, and timing fields. The copy must be practical, beginner-friendly, and bilingual with a language switch between Vietnamese and English.

## Scope

In scope:
- Add a `?` help button at the top-right of the selected step detail form.
- Open a modal popup for the currently selected step type.
- Provide bilingual help content for every current step type:
  - `navigate`
  - `open_url`
  - `sleep`
  - `wait`
  - `input_text`
  - `type_text`
  - `clear_input`
  - `click`
  - `scroll`
  - `select_option`
  - `set_checkbox`
  - `press_key`
  - `hotkey`
  - `hover`
- Include a language control inside the modal for Vietnamese and English.
- Keep the feature frontend-only. No database or Tauri command changes are needed.

Out of scope:
- Changing step behavior.
- Adding inline help under every input.
- Adding persisted user language preferences.
- Adding a global documentation page.

## UX Design

The selected step form header becomes a two-column header:
- Left side: existing `Step Detail` eyebrow and step type title.
- Right side: compact icon-style `?` button.

The help button:
- Uses an accessible label such as `Open Scroll help`.
- Opens a modal dialog.
- Does not submit the form.
- Stays visually consistent with the existing dark Supabase-inspired design system.

The modal:
- Uses `role="dialog"` and `aria-modal="true"`.
- Title reflects the current step type, such as `Scroll Help`.
- Contains a `Tiếng Việt / English` segmented control.
- Shows beginner-friendly sections:
  - What this step does.
  - When to use it.
  - Field explanations.
  - Examples.
  - Common mistakes.
- Has a close button.

The content must avoid vague technical wording. It should explain fields in terms of what the user is trying to automate. For example, Scroll help must explicitly say:
- `Page` scrolls the main page, or the iframe document if `Iframe XPath` is set.
- `Container` uses `XPath` as the scrollable box.
- `Into View` uses `XPath` as the element to bring into view.
- `Until Visible` uses `XPath` as the target element that should become visible, not the scroll box.
- `Iframe XPath` selects the iframe on the parent page; `XPath` selects the element inside that iframe.

## Content Model

Create a frontend content module, for example:

```ts
type StepHelpLanguage = "vi" | "en";

type StepHelpContent = {
  title: string;
  summary: string;
  useWhen: string[];
  fields: Array<{
    name: string;
    description: string;
  }>;
  examples: string[];
  commonMistakes: string[];
};
```

The module maps each `ActionConfig["type"]` to both `vi` and `en` content. Keeping content in a separate module prevents `StepForm.tsx` from becoming a long documentation file.

The first implementation can use plain strings and arrays. It does not need Markdown parsing.

## Component Design

Add a small component boundary:
- `StepHelpModal`: renders the modal, language switch, and content sections.
- `stepHelpContent.ts`: contains all bilingual copy.

`StepForm` owns:
- `isHelpOpen`
- `helpLanguage`

`StepForm` passes the current `config.type` to `StepHelpModal`.

This keeps the modal tied to the currently selected step and avoids introducing app-wide state.

## Styling

Follow `DESIGN.md`:
- Dark native surfaces: `#171717` modal, `#0f0f0f` section panels if needed.
- Borders define depth: `#2e2e2e` and `#363636`.
- Border radius: 8px for modal and content blocks.
- Green accent only for active language state or subtle focus/active treatment.
- No large shadows.
- Modal width should support long help text: `min(760px, 100%)`.
- Modal body should scroll if content is taller than the viewport.
- On mobile, the modal should fit within the viewport with comfortable padding.

## Accessibility

Requirements:
- Help button has a clear `aria-label`.
- Modal uses `role="dialog"` and `aria-modal="true"`.
- Dialog title is connected with `aria-labelledby`.
- Language buttons expose selected state through `aria-pressed` or an equivalent accessible state.
- Close button is keyboard reachable.
- The modal can be closed with its close button. Escape-to-close is optional for the first implementation.

## Testing

Add focused Vitest and Testing Library coverage:
- The selected step form shows a `?` help button.
- Clicking the help button opens the modal for the current step type.
- The modal includes Vietnamese content by default.
- Switching to English changes the displayed content.
- At least one high-risk step, `scroll`, includes guidance that `Until Visible` uses XPath as the target element, not the scroll box.
- Every current action type has help content in both languages. This can be a data-level test that iterates over all known action types.

Because this is a user-facing UI change, implementation must use TDD:
1. Add focused failing tests first.
2. Run the relevant frontend test and confirm the expected failure.
3. Implement the modal and content.
4. Re-run focused tests and relevant checks.

## Acceptance Criteria

- Every step type has a help popup reachable from the top-right of the step detail form.
- Users can switch the popup language between Vietnamese and English.
- Help copy explains every field currently shown by the step form.
- Scroll help clearly distinguishes scroll target, scroll container, iframe XPath, and XPath.
- UI follows `DESIGN.md` and keeps the existing Supabase-inspired dark theme.
- Frontend tests cover popup behavior and content completeness.
