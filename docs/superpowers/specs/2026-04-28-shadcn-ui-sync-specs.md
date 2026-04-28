# shadcn UI Sync Specs

## Spec 1: UI primitives
Scope: establish the reusable shadcn-style layer used by the app.

Implementation:
- Add `Select`, `Textarea`, `Badge`, `Card`, `Tabs`, `Tooltip`, and `ScrollArea` under `src/components/ui/`.
- Keep Supabase-inspired dark styling from `DESIGN.md`.
- Keep components incremental and compatible with the existing CSS while migration continues.

DONE:
- Focused UI component tests cover the added primitives.
- `npx tsc --noEmit` passes.
- Existing workflow list dialog tests still pass.

## Spec 2: StepForm migration
Scope: migrate the step detail form controls to the shared UI layer.

Implementation:
- Replace native step form buttons, labels, inputs, selects, and textareas with `src/components/ui/*`.
- Preserve all existing labels, values, conditional fields, and save/delete behavior.
- Avoid changing domain behavior or validation.

DONE:
- Focused StepForm/WorkflowDetail tests pass.
- `npx tsc --noEmit` passes.
- No workflow step behavior changes are introduced.

## Spec 3: Remaining dialogs and monitors
Scope: migrate remaining modal surfaces to shared dialog primitives.

Implementation:
- Migrate `StepHelpModal` to `Dialog`, `Button`, `Tabs` or segmented controls, and `ScrollArea`.
- Migrate `TestStepMonitor` to `Dialog`, `Button`, `ScrollArea`, `Badge`, and `Card` where useful.
- Preserve close, stop, language switching, and monitor status behavior.

DONE:
- Focused modal/monitor tests pass.
- Keyboard-accessible dialog semantics remain present.
- `npx tsc --noEmit` passes.

## Spec 4: Cards, badges, panels, and lists
Scope: standardize repeated list and status surfaces.

Implementation:
- Migrate workflow cards, step list items, run status, and compact panels to shared `Card`, `Badge`, and `Button` primitives.
- Keep page-level grid/layout CSS intact.
- Preserve drag-and-drop behavior.

DONE:
- Workflow list/detail and StepBuilder tests pass.
- Drag handles and selected step state still work.
- `npx tsc --noEmit` passes.

## Spec 5: CSS cleanup
Scope: remove styling duplication only after migrated components are stable.

Implementation:
- Remove unused legacy classes such as old dialog/backdrop/button styles only after no JSX references remain.
- Keep page layout CSS and responsive CSS where it still owns layout.
- Avoid broad visual rewrites.

DONE:
- `rg` confirms removed classes are not referenced.
- `npm test` and `npm run build` pass.

## Spec 6: Design token alignment
Scope: make the shared UI layer token-driven instead of hardcoded.

Implementation:
- Move recurring colors, radii, and focus rings into CSS variables.
- Update UI primitives to consume the tokens.
- Preserve the Supabase-inspired dark theme.

DONE:
- Visual behavior matches the current dark theme.
- `npm test`, `npx tsc --noEmit`, and `npm run build` pass.
