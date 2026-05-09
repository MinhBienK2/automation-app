# UI/UX Feature Parity Spec

## Purpose

Define product-equivalent UI behavior for the Electron/CloakBrowser rebuild.
The new UI should preserve proven product workflows while adapting to the new
product model, identity profile model, runner event stream, and evidence model.

## In Scope

- Workflow list.
- Workflow detail and graph builder.
- Action editor.
- Workflow settings.
- Identity profile editor.
- Run monitor.
- Run issue panel.
- Evidence/artifact viewer.
- Import/export surfaces.
- Feature parity behavior mapping.

## Out Of Scope

- Pixel-perfect copy of old UI.
- Final visual design tokens.
- Full implementation component tree.
- Marketing/landing pages.
- Browser automation inside renderer.

## Product Concepts

Renderer UI presents:

- workflows;
- graphs;
- run profiles;
- identity profiles;
- environments;
- variables;
- runs;
- issues;
- artifacts;
- evidence.

It does not own runner execution or database writes directly.

## Technical Design

### Navigation

Primary screens:

- Workflow List.
- Workflow Detail.
- Runs / Run History.
- Identity Profiles.
- Settings / Workspace Policy.

Workflow Detail contains graph workspace, inspector, run controls, and run
status.

### Workflow List

Capabilities:

- create workflow;
- duplicate workflow;
- rename/edit metadata;
- delete with confirmation;
- import workflow package;
- export workflow package;
- open workflow detail;
- run workflow with default profile.

### Workflow Detail

Capabilities:

- graph editing;
- graph validation;
- action palette;
- logic palette;
- variable nodes;
- settings access;
- run/stop controls;
- run state display;
- issue panel;
- artifact/evidence shortcuts.

### Graph Builder

The graph builder remains the central authoring surface. It should support:

- add/connect/delete nodes;
- explicit ports;
- selection and multi-selection;
- undo/redo;
- keyboard shortcuts;
- validation issue highlighting;
- run progress highlighting;
- inspector-based configuration.

### Settings

Workflow settings should expose:

- General;
- Run Profile;
- Identity Profile selection;
- Environment;
- Variables;
- Triggers or planned automation metadata;
- Advanced diagnostics.

Settings should make profile/environment boundaries clear.

### Identity Profile Editor

Identity editor should expose:

- browser/profile reuse;
- device profile;
- viewport;
- locale/timezone;
- proxy reference and metadata;
- headed/headless policy;
- preflight policy;
- coherence validation results.

### Run Monitor

Run monitor should show:

- status;
- active node/action;
- elapsed time;
- terminal reason;
- progress timeline;
- current issues;
- artifacts produced.

### Evidence Viewer

Evidence viewer should show:

- run summary;
- identity snapshot summary;
- preflight verdict;
- action trace timeline;
- artifacts;
- sanitized export action.

## Interfaces / Contracts

Renderer uses preload API:

- workflow APIs;
- graph APIs;
- settings/profile APIs;
- run APIs;
- evidence/artifact APIs.

Renderer subscribes to event streams by run id. Main process remains
authoritative for persistence and runner supervision.

## Data Model

UI state is not the durable model. Durable state comes from storage services and
run events.

UI may maintain local drafts for forms and graph edits. Drafts must be saved
explicitly or autosaved according to product settings.

## Error Handling

- Validation issues should link to graph node, field, profile, or settings
  section.
- Runtime issues should remain visible until cleared by new run or explicit user
  action.
- Runner/system issues should explain whether retry is safe.
- Unsaved settings/graph changes should prompt before destructive navigation.

## Security / Safety / Audit

- UI must show allowlist/profile/preflight blocks clearly.
- UI must avoid language that presents manual checkpoints as automated challenge
  bypass.
- Secret fields must be masked.
- Export UI must default to sanitized export.
- Renderer must not expose raw file paths or shell actions beyond approved APIs.

## Testing

Tests must cover:

- workflow list actions;
- graph edit and validation rendering;
- action editor forms for P0 actions;
- settings/profile validation display;
- run event stream updates;
- issue panel behavior;
- evidence viewer sanitized export path;
- renderer does not require Node globals.

## Acceptance Criteria

- Current product workflows are represented in the new UI.
- Graph remains the primary authoring surface.
- Identity profile and run profile are understandable as separate concepts.
- Run monitor updates from streamed events.
- Issues and artifacts are visible and actionable.
- UI parity is measured by parity matrix, not pixel equivalence.

## Dependencies

- Product Model Spec.
- Electron App Architecture Spec.
- Workflow Graph And Builder Spec.
- Action Catalog And Locator Spec.
- Identity Profile And Fingerprint Preflight Spec.
- Run Evidence And Audit Spec.

## Open Questions

None blocking. Visual design refinements can be handled after parity behavior is
specified.
