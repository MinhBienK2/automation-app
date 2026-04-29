# Add Step Palette Design

## Goal

Make adding workflow steps easier as the number of action types grows. The current action type picker sits below the step list and exposes a long grouped menu, which makes discovery and repeated add-step work feel heavy.

## Decision

Use an Add Step palette.

The workflow detail workspace keeps the current two-column structure:

- Left: `Builder Steps`.
- Right: selected `Step Detail`.

The add-step control moves from the bottom of the step list to the top of the `Builder Steps` panel as a clear `+ Add Step` button. Clicking it opens a focused palette/modal for choosing an action type.

## Palette Layout

The palette contains:

- Header: `Add Step` and `Choose an action type`.
- Search input for filtering actions by label and keyword.
- Category navigation using the existing `actionGroups`.
- A compact action result grid/list.
- Each action option shows the action label and a short one-line description.

The palette should prioritize common actions when no search query is entered. A practical first version can define common actions from the current Core group plus frequently used data actions:

- Navigate
- Click
- Input Text
- Wait
- Extract Text
- Take Screenshot

## Interaction

- `+ Add Step` opens the palette.
- Choosing an action type immediately creates the step using the existing `add_step` command flow.
- After the step is created, the palette closes and the new step remains selected, matching current behavior.
- `Escape` closes the palette without adding a step.
- Clicking outside the palette closes it.
- Search updates the visible action list without changing the selected workflow or selected step.

## Responsive Behavior

Desktop:

- Keep `Builder Steps` and `Step Detail` as the primary two columns.
- The palette appears as a centered modal with enough width for categories and action descriptions.

Tablet and mobile:

- The workflow detail layout can continue stacking as it does today.
- The palette becomes single-column: search first, category chips next, action list below.
- Result rows must keep labels readable without horizontal scrolling.

## Component Boundary

Add a focused component for action selection, for example `AddStepPalette`.

Responsibilities:

- Own palette open/close state.
- Own search query and active category.
- Render action groups, labels, descriptions, and filtered results.
- Call the existing add-step callback with the chosen `ActionType`.

Keep workflow persistence and command behavior unchanged. The palette is a frontend interaction change only.

## Data And Copy

Reuse:

- `actionGroups` from `src/lib/workflowUi.ts`.
- `actionLabels` from `src/lib/workflowUi.ts`.
- Existing `ActionType` from `src/types/workflow.ts`.

Add a small UI-only description map for action options. The descriptions should be short and functional, such as:

- Navigate: `Open a page`.
- Click: `Click an element`.
- Input Text: `Fill a field`.
- Wait: `Pause or wait for a condition`.

Descriptions do not affect backend behavior.

## Styling

Follow `DESIGN.md`:

- Preserve the dark Supabase-inspired theme.
- Use border-defined panels, not heavy shadows.
- Use green only as a small accent for selected category, focus, or active result.
- Keep controls compact. The palette should feel like a tool surface, not a landing page.
- Avoid large rounded cards inside the modal. Action options should be compact rows or small flat bordered cells.

## Testing

Add focused frontend tests for:

- The `+ Add Step` button opens the palette.
- Search filters action labels.
- Category selection filters visible actions.
- Selecting an action calls the existing add-step path with that action type.
- Escape closes the palette without adding.

Add CSS coverage if layout rules are encoded in existing CSS tests.

## Out Of Scope

- Changing Rust action types, validation, defaults, or runner dispatch.
- Changing persisted workflow or step data.
- Adding drag-from-palette behavior.
- Reordering or renaming action groups.
- Building personalized recent actions.

## Acceptance Criteria

- Users no longer need to open a long action type menu at the bottom of the step list.
- Adding a step starts from a visible `+ Add Step` button near the top of `Builder Steps`.
- The palette supports search and category browsing.
- The current add-step command behavior and selected-new-step behavior remain unchanged.
- The layout remains usable on mobile.
