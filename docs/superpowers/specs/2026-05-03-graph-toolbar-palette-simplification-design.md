# Graph Toolbar And Palette Simplification Design

## Status

Approved by the user on 2026-05-03.

This spec covers a focused graph editor UX cleanup. It simplifies the visible
toolbar and graph node palettes so users can understand what each button is for.
It intentionally hides confusing or advanced items before changing runtime
contracts.

## Problem

The current graph toolbar exposes `Add Variable`, `Add Output`, `Add End`, and
`Fit`. Users do not yet have a clear mental model for these controls:

- `Add Variable` includes `Set Variable` and `Transform Variable`, but
  `Transform Variable` is advanced and currently hard to explain in normal
  workflow authoring.
- `Add Output` does not create outputs. It currently exposes `Assert Output` and
  `Run Subworkflow`, which makes the label misleading.
- Output-producing actions actually live under `Add Action`, such as extract
  text, extract input value, extract table, extract list, screenshot, download,
  and JavaScript actions that write named outputs.
- `Add End` exposes failure/stop-oriented nodes, while `End Success` exists in
  the graph model but is not available from the palette.
- `Fit` duplicates functionality already present in React Flow canvas controls.
- `Input Text` is technically correct but users often think in terms of filling
  a field. The action picker should make that intent obvious.

## Goals

- Remove misleading or redundant graph toolbar controls.
- Keep beginner-facing choices small and understandable.
- Keep existing graph runtime and persistence compatibility.
- Make explicit success/failure ends available when users want a readable graph.
- Present form-filling as `Fill Field` in user-facing action picker surfaces
  while preserving the existing `input_text` action type.

## Non-Goals

- Do not delete Rust or TypeScript action config variants in this change.
- Do not change graph compiler semantics.
- Do not remove support for loading saved graphs that already contain hidden
  nodes or configs.
- Do not add a new data/output inspector in this spec.
- Do not implement the broader power-user editor features from
  `2026-05-03-power-user-graph-editor-design.md`.

## Approved Decisions

- Hide `Transform Variable` from user-addable graph palettes.
- Keep `Transform Variable` runtime support for compatibility and internal use,
  especially subworkflow input/output mapping expansion.
- Remove the `Add Output` toolbar button.
- Hide `Assert Output` and `Run Subworkflow` from the main graph toolbar for this
  phase.
- Remove the toolbar `Fit` button because React Flow canvas controls already
  include fit-view behavior.
- Add `End Success` to the `Add End` palette.
- Keep implicit successful endings: a graph path with no continuation still ends
  successfully unless validation or runtime semantics say otherwise.
- Show `input_text` as `Fill Field` in user-facing picker labels and help copy
  where appropriate, while keeping the persisted action type and existing
  backend contract as `input_text`.

## Toolbar Design

The graph toolbar should keep only high-signal authoring controls:

- `New node`
- `Add Action`
- `Add Logic`
- `Add Variable`
- `Add End`

Remove from the toolbar:

- `Add Output`
- `Fit`

`Fit` remains available through React Flow controls. Future keyboard shortcut or
command palette support may still call `fitView`, but the toolbar should not
show two ways to do the same thing.

## Palette Design

### Add Variable

`Add Variable` should expose only:

- `Set Variable`

`Set Variable` means: store a named value for later steps or conditions. The UI
copy should explain that values can be reused with template syntax where the
runner supports it, such as `{{email}}`.

`Transform Variable` should be hidden from user-addable palettes in this phase.
Existing graphs with `transform_variable` nodes must still render, validate, and
run according to current behavior.

### Add Output

Remove this palette entry entirely.

Reasons:

- The name implies output creation.
- The current contents do not create outputs.
- Output creation already happens through action nodes such as extraction,
  screenshot, download, and JavaScript output actions.

`Assert Output` should not be deleted from the codebase. It should be hidden from
the main graph toolbar until the product has a clearer `Check` or `Assertions`
surface.

`Run Subworkflow` should not be deleted from the codebase. It should be hidden
from the main graph toolbar until the product has a clearer `Reuse`,
`Subworkflow`, or advanced orchestration surface.

### Add End

`Add End` should expose:

- `End Success`
- `End Failure`
- `Stop Workflow`

`End Success` is optional. Users do not need to add it to every path, because
missing continuation still represents a successful end where current graph
semantics allow it. It exists to make important paths easier to read.

`End Failure` is for controlled failure endpoints with a clear reason.

`Stop Workflow` is for intentionally stopping from the middle of a graph with a
chosen success or failure status.

## Action Picker Labeling

The action type remains `input_text`, but the user-facing label should become
`Fill Field` in graph action picker surfaces.

Recommended copy:

- Label: `Fill Field`
- Description: `Enter text into an input, textarea, or editable field.`

The inspector can keep technical field labels such as XPath, Text, Clear before
input, Typing mode, Iframe XPath, Delay, Wait until, and Timeout. Help copy
should mention that this action is the default way to fill email, password,
search, textarea, and ordinary form fields.

Compatibility rules:

- Persisted config remains `{ type: "input_text", config: ... }`.
- Rust `ActionType::InputText` and validation remain unchanged.
- Summaries and tests may still reference the action type as `input_text`.
- UI labels can display `Fill Field` without changing the serialized contract.

## Existing Graph Compatibility

Saved graphs may already include hidden or advanced nodes:

- `transform_variable`
- `assert_output`
- `run_subworkflow`

These nodes must still:

- render on the canvas,
- show inspector fields,
- save,
- validate,
- compile,
- run where currently supported.

The cleanup only changes what users can add from the main toolbar palettes. It
does not remove existing graph capabilities from persisted data.

## Documentation Updates During Implementation

When implementation changes are made, update:

- `docs/domain/workflow-lifecycle.md` for toolbar and palette behavior.
- `docs/domain/user-visible-invariants.md` for visible graph authoring controls.
- `docs/architecture/frontend.md` for palette ownership.
- `docs/contracts/workflow-types.md` if the supported user-facing graph node list
  changes.
- `README.md` smoke checklist for the updated graph toolbar.

Docs should explicitly state that output-producing behavior comes from data
capture actions under `Add Action`, not from an `Add Output` toolbar group.

## Testing

Implementation should add or update focused frontend tests:

- Toolbar no longer renders `Add Output`.
- Toolbar no longer renders `Fit`.
- `Add Variable` palette offers `Set Variable` and not `Transform Variable`.
- `Add End` palette offers `End Success`, `End Failure`, and `Stop Workflow`.
- Action picker shows `Fill Field` for the `input_text` action while selected
  configs still persist as `input_text`.
- Existing saved graphs containing `transform_variable`, `assert_output`, or
  `run_subworkflow` still render and expose inspector fields.

Required checks during implementation:

- Focused Vitest tests for edited graph toolbar, palettes, and labels.
- `npx tsc --noEmit` if TypeScript props or types change.
- `npm test -- src/AppCss.test.ts` if styling invariants change.

## Acceptance Criteria

- A user opening the graph editor sees a simpler toolbar without `Add Output` or
  toolbar `Fit`.
- `Add Variable` has one clear option: `Set Variable`.
- `Add End` lets users add explicit success and failure endpoints.
- `Input Text` is presented as `Fill Field` in user-facing picker surfaces.
- Existing advanced nodes remain compatible when loaded from saved graphs.
- No Rust graph compiler or runner contract changes are required for the cleanup.

## Self-Review

- No placeholders remain.
- The spec distinguishes UI hiding from deleting runtime support.
- The scope is small enough to implement independently from the power-user graph
  editor roadmap.
- The design keeps current persistence and compiler semantics intact.
