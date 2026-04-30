# Plan 4: Editable Graph Canvas

## Objective

Add the primary visual graph authoring UI inside workflow detail. The editor must allow users to add, move, connect, delete, duplicate, save, and validate nodes without editing JSON.

## TDD Slices

1. Add failing component tests:
   - Workflow detail loads graph and shows visual graph workspace.
   - Palette adds a node to the canvas.
   - Selecting a node opens the inspector.
   - Connecting nodes creates an edge with a semantic port label.
   - Deleting a node removes attached edges.
   - Save graph calls `save_workflow_graph`.
2. Add failing CSS/layout tests if existing CSS invariants need updates.

## Implementation Notes

- Use a local React canvas implementation for the first pass to avoid dependency risk in Tauri tests.
- Canvas features:
  - palette
  - absolute-positioned nodes
  - SVG edges
  - zoom controls
  - minimap summary
  - validation badges
  - keyboard-accessible move/connect controls
- Preserve existing step list as an outline/timeline surface, not the primary editor.

## DONE Criteria

- Focused workflow graph component tests pass.
- Existing `WorkflowDetailPage` and `StepBuilder` tests pass.
- `npm test -- src/AppCss.test.ts` passes if CSS invariants changed.
- `npx tsc --noEmit` passes.
- UI follows `DESIGN.md` dark Supabase-inspired system.
