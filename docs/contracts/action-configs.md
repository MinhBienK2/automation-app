# Action Config Contracts

## Source Files

- `src/types/workflow.ts`
- `src/lib/workflowUi.ts`
- `src/features/workflows/lib/workflowStepForm.ts`
- `src/features/workflows/components/ActionConfigEditor.tsx`
- `src/features/workflows/components/ActionConfig*Fields.tsx`
- `electron/backend/graph/compiler.ts`
- `electron/backend/graph/validateGraph.ts`
- `electron/backend/commands.ts`
- `electron/backend/runtime/runner.ts`
- `electron/backend/actions/registry.ts`
- `electron/backend/actions/validation.ts`
- `electron/backend/actions/execution.ts`

## Required Sync Points

Every serialized action type that can cross the Electron IPC boundary must be represented by TypeScript `ActionType` and `ActionConfig`. The visible Add Action palette is a narrower product subset maintained in `workflowUi.ts` and the graph palette helpers.

Every user-addable action type must have:

- TypeScript action type and config shape.
- Capability registry status in `src/lib/actionCapabilities.ts`.
- Default config in frontend defaults or graph compiler settings prelude when applicable.
- UI label/group in `workflowUi.ts`.
- UI label/help text in `workflowUi.ts` and `stepHelpContent.ts`.
- Form support in workflow step form logic/components when user editable.
- Backend validation when fields have constraints.
- Runner execution or an explicit unsupported error. Silent success for stubbed actions is not allowed.
- Backend action registry metadata for owner, palette visibility, and audit risk.

Three of these sync points are now enforced by the compiler rather than by this
checklist, so forgetting them fails the build and names the missing action type:

- **Registry metadata** — `ActionRegistryCoverage` in `electron/backend/actions/registry.ts` proves every `ActionType` has a definition.
- **Execution** — `ActionExecutorMap` is a total map over `ActionType`, so the runner's executor map cannot omit one.
- **Schema and completeness validator** — `assertActionRegistryCoverage()` runs at module load and checks both halves for every registered type.

The rest of the list is still hand-maintained, and several entries fail
*silently* when omitted rather than loudly: the palette group catalog (action
becomes invisible), the config-field update switch (edits become no-ops), the
field renderers (empty inspector body), the trace summary (trace loses its
label), and step help (a fallback generator synthesizes filler text, so the
omission passes the help test too). Tracked in #31.

Browser identity actions such as profile, proxy, user-agent, and download-directory settings are not part of the in-run action contract. Browser identity belongs in project browser profiles selected by Workflow Settings Browser Launch.

Runner traces classify every top-level executed action with compact mode/status metadata. The runner's CloakBrowser-native/custom-human/direct-DOM capability map is internal execution policy, not a serialized action config field.

Graph-internal executable configs such as `graph_noop`, `if_condition`, `router_condition`, `random_choice`, `repeat_times`, `repeat_for_each`, `retry_block`, `switch_condition`, `while_loop`, `repeat_until`, `try_catch`, `fallback_block`, `break_loop`, `continue_loop`, `stop_workflow`, `transform_variable`, `update_number_variable`, `update_text_variable`, `update_flag_variable`, `update_list_variable`, `update_object_variable`, `assert_output`, and `domain_allowlist` are TypeScript `ActionConfig` variants used by graph compilation and runner orchestration. They are intentionally included in TypeScript `ActionType` for DTO safety, but hidden from the main Add Action picker. Graph-native nodes are the user-facing control-flow authoring surface. Variable configs include multi-row `set_variable`, `set_json_variables`, `check_conditions`, `update_number_variable`, `update_text_variable`, `update_flag_variable`, `update_list_variable`, and `update_object_variable`.

Merge nodes compile to `{ type: "graph_noop", config: { kind: "merge" } }` and have no browser, output, session, or network side effects. Router nodes compile to `router_condition` with `mode: "first_match"`, stable case ids/labels/conditions, nested case steps, and `default_steps`.

Random Choice nodes compile to `random_choice` with stable choice ids, labels, positive weights, nested branch steps, and optional `output_name`. The runner chooses one branch by weighted random selection, stores the selected choice id when `output_name` is set, runs that branch, then continues through the graph node's `done` port.

Terminal graph nodes can compile to `stop_workflow` with `close_browser: true`. When `close_browser` is missing or false, terminal runs keep retaining the browser session. When true, the runner still captures outputs first and then closes the browser instead of retaining the session.

Variable config rules:

- `set_variable` rows use `{ name, value_type, value }`, where `value_type` is `text`, `json`, `number`, or `boolean`.
- `set_json_variables` requires a JSON object root.
- `check_conditions` uses `{ output_name, mode, script, rules_group }` to evaluate visual rules or JavaScript expressions and write a boolean result to `output_name` (display name: Check Conditions).
- `calculate_value` uses `{ output_name, expression }` to evaluate JavaScript or mathematical expressions and write the raw result to `output_name` (display name: Calculate Value).
- `update_number_variable` uses `{ name, operation, value }` to perform mathematical calculations.
- `update_text_variable` uses `{ name, operation, value, search_pattern }` to transform strings (append, prepend, replace, uppercase, lowercase, trim).
- `update_flag_variable` uses `{ name, operation }` to toggle or set booleans.
- `update_list_variable` uses `{ name, operation, value, value_type, index }` to push, pop, shift, unshift, remove, merge, or merge_unique from/into arrays.
- `update_object_variable` uses `{ name, operation, value, property_key, property_value, property_value_type }` to merge or edit object key-values.
- Dot-path names are valid variable paths.
- Object values flatten into dot-path outputs; arrays stay whole at their path.
- Later writes to the same path overwrite earlier writes.
- `repeat_for_each` can use literal `items` or an `array_variable` source.

Element target config rules:

- User-authored element-facing actions use `target`, a structured locator bundle with ordered locators (`test_id`, `role`, `label`, `placeholder`, `text`, `css`, `xpath`, or `attribute`) plus optional constraints (`visible`, `enabled`, `contains_text`, `index`) and optional iframe target.
- Drag/drop uses `source_target`/`source_ref` for the draggable element and `target_target`/`target_ref` for the destination; custom select uses `trigger_target`/`trigger_ref` for the dropdown trigger. Drag/drop may also set optional `target_position`: missing or `{ mode: "center" }` preserves the legacy drop-to-target-center behavior; `{ mode: "percent", x_percent, y_percent }` drops at a 0-100 percentage point inside the target box; `{ mode: "offset", x_px, y_px }` drops at a pixel offset from the target box's top-left corner.
- Backend validation requires a valid structured target for required element actions, except targetable single-target actions may use `target_ref` from an earlier `find_element` action in the same run. This includes pointer, form, keyboard-targeted, wait element-state, capture, assertion, and Scroll To Element configs. Drag/drop endpoints may independently use `source_ref` and `target_ref` from earlier `find_element` actions, and Custom Select trigger targeting may use `trigger_ref`. `find_element` and Scroll Until Element Visible keep locator-specific target fields.
- `find_element` resolves an element from a target, optional viewport filter, and ranking mode (`first`, `nearest_viewport_center`, or `largest_visible_area`), then stores a short-lived runtime element ref under `output_name`. The serialized output is audit metadata only; downstream actions consume the named runtime ref, not a DOM mutation or synthetic selector.
- `click_and_switch_tab` uses `target` (structured locator bundle) or `target_ref` (referenced element) to click an element, waits for a new page to open, and switches the runner's active page context to the newly opened page.
- The runner resolves structured targets at runtime through ordered locators, supports role/label/placeholder/text/CSS/XPath/attribute locator kinds, applies supported constraints, and reuses the frame-aware action path.
- Targetable single-target action authoring exposes a target-source segmented control. Use Locator shows structured locator fields; Use Find Element ref shows only `target_ref` plus action-specific fields so hidden locator constraints are not presented as active. Switching back to Use Locator preserves the saved locator config.
- Custom Select trigger authoring exposes the same exclusive source model with `trigger_target` versus `trigger_ref`, using Trigger labels while preserving saved locator config when operators switch to ref mode.
- Visible action and graph-native logic authoring groups related fields by purpose without adding serialized config fields. Group labels are editor-only presentation for related controls such as target/content, output, match/value, mode-specific settings, artifacts, network/storage/session scope, loop/retry policy, router cases, random choices, and terminal behavior.
- `WorkflowCondition` with `kind: "element_visible"` accepts legacy `xpath`, structured `target`, or `target_ref` from an earlier `find_element`; graph-native If/Router/While/Repeat Until editors expose XPath versus Find Element ref as exclusive element-source modes.
- Drag/drop authoring presents `Drag source` and `Drop target` endpoint-source controls. Use Locator shows `source_target` or `target_target`; Use Find Element ref shows `source_ref` or `target_ref` while preserving saved locator config. The `Drop setup` group keeps `Drop target` plus `target_position` together so operators can see which fields jointly decide where the source lands.
- Scroll config supports `mode: "page" | "into_view" | "until_element_visible"`. Missing `mode` remains compatible with legacy Page Scroll and requires `direction` plus positive `pixels`. Page Scroll may set `scroll_style: "human_like" | "smooth_single"`; missing style is `human_like`, while `smooth_single` sends one wheel gesture for the requested distance. `into_view` requires `target` or legacy `xpath`, may include `iframe_xpath`, and may set positive `timeout_ms`; when omitted, target scroll defaults to `60000` ms. `until_element_visible` also requires a target, uses `direction` and positive `pixels` as the repeated page-scroll search gesture, and stops when the target gets a visible box before bringing it into view.
- `extract_regex_matches` reads a named prior output (`source_name`), applies a validated regex `pattern` and optional `flags`, and stores the match list in `output_name`. `append` keeps existing output list values before adding new matches, and `dedupe` preserves first-seen order while removing duplicate strings.
- `write_text_file` reads a named prior output (`source_name`), renders arrays with `separator` (default newline), writes a safe text artifact name in the run downloads evidence directory, and stores the relative artifact path in `output_name`. `include_trailing_newline` defaults to true.
- Visible action defaults no longer include action-level typing fidelity, retry interval, post-click wait, click positioning, or clear-field method fields. Scroll exposes only mode-specific fields: Page Scroll shows scroll style, direction, and pixels; Scroll To Element shows target and timeout; and Scroll Until Element Visible shows target, timeout, direction, and pixels. Low-level target constraints and scroll-planner tuning stay internal for Scroll authoring.
- Backend validation rejects unsupported enum values for preserved element/form/assertion fields such as readiness wait mode, select matching mode, checkbox state, and assertion match mode; the runner keeps matching defensive guards for direct execution inputs.
- Runner interaction dispatch uses an internal capability map: CloakBrowser-native paths are preferred for supported element/page/frame APIs, Scroll To Element may use CloakBrowser's exported human scroll helper before falling back to app-owned wheel timing, Scroll Until Element Visible uses app-owned page-scroll search gestures before the same target-scroll path, Custom Select triggers resolve either `trigger_ref` or direct trigger locator before opening the dropdown, Blur Element resolves and blurs its target rather than moving focus with Tab, custom human behavior owns Page Scroll, untargeted key chords, paste shortcut orchestration, and right-click button preservation, and direct DOM is used for read/assert/storage actions or final fallbacks only.

Evidence config rules:

- `take_screenshot.path` is an artifact name, not a filesystem path.
- Screenshot and text-file artifact names must be relative names without `file:`, absolute paths, path separators, or parent traversal.
- Generated screenshot, text-file, and download paths are stored under `evidence/runs/<run_id>/...`.
- `__evidence` contains structured artifact metadata; compact output paths remain for existing output consumers.

Recovery config semantics must preserve failure behavior when recovery branches are absent:

- `retry_block` with empty `failed_steps` fails with the last try error after attempts are exhausted.
- `try_catch` with empty `error_steps` fails with the original try error after running `finally_steps` when present.
- `fallback_block` with empty `fallback_steps` fails with the primary branch error.

## Validation Ownership

- Electron backend validation is authoritative.
- `electron/backend/graph/compiler.ts` owns graph structural validation, graph-native semantic validation, and graph-to-action compilation.
- `electron/backend/actions/validation.ts` owns serialized `ActionConfig` validation and nested action-config recursion.
- Frontend may provide ergonomic form behavior but cannot be the only validation.
- `dry_run_validate_config` exposes backend validation for builder assist.
- Backend action validation covers visible action families, nested graph-internal action arrays, safe evidence names, geolocation and viewport ranges, network status ranges, required output names, and storage/header/permission lists.
- Backend graph validation rejects unknown graph `node_type`, unknown action
  `type`, unknown nested action `type`, and unknown `condition.kind` values at
  save/import/compile boundaries. The runner also fails unknown action and
  condition discriminants as a defense-in-depth guard so unsupported inputs
  cannot execute as successful no-ops.
- Backend unknown-action errors are routed through
  `electron/backend/actions/registry.ts`, which is the canonical runtime list of
  supported serialized action types. The compiler calls
  `electron/backend/actions/validation.ts`, and the runner calls
  `electron/backend/actions/execution.ts`, so action validation and execution
  coverage are both checked against the registry.

Set Viewport is a runtime viewport-size action. Active authoring exposes only `width` and `height`; Workflow Settings Browser Launch no longer exposes device scale factor, mobile mode, or touch capability controls.

## Persistence

Configs persist as JSON inside the normalized `workflow_nodes.config_json` and
`subflow_nodes.config_json` columns (one row per node), with edges in
`workflow_edges` / `subflow_edges`. The legacy `workflows.graph_json` and
`subflows.graph_json` columns were dropped in PR 2.3; normalized tables are
the single source of truth. Workflow package `flow` payloads still embed the
graph as a single JSON blob for export/import.

Every `ActionConfig` variant has a Zod schema registered in
`electron/backend/actions/schemas/` (one file per action type plus
`common.ts` for shared sub-schemas). Each schema is attached to its
`ActionDefinition.configSchema`, and `assertActionRegistryCoverage()` — the
single module-load coverage assertion — fails the build if any `ActionType` is
missing either its schema or its completeness validator. On load, invalid or
unknown action configs are converted to `quarantined` placeholder nodes
rather than crashing; the original payload is preserved verbatim inside the
quarantined config.

### Two validation tiers

Validation has two tiers, and they are **deliberately asymmetric**:

| Tier | Function | Question | Enforced by |
| --- | --- | --- | --- |
| Shape | `parseActionConfigShape` (schema registry) | Can this persisted JSON be read as an Action Config of its declared type? | Graph load path, graph migration pass |
| Completeness | `validateActionConfig` (validation registry) | Is this config complete enough to run? | Authoring/IPC path, graph node semantics, compile path |

The completeness tier is strictly stricter and is the authority on runnability.
The shape tier must stay looser because the load path *quarantines* what it
rejects: a freshly dropped node carries an empty config (`click` defaults to
`{ target: null }`), so a strict load path would destroy every in-progress node
on reload. The authoring path instead *reports* incompleteness in the inspector,
which is non-destructive.

Do not "reconcile" the two verdicts. `electron/backend/actions/actionConfigTiers.test.ts`
pins the relationship: shape accepts the draft, completeness reports it, and the
completeness tier never accepts what the shape tier rejects. Conditional
per-field requirements (for example `update_list_variable`'s per-operation
required fields) belong in the completeness tier for the same reason.

Closed value sets shared by the `ActionConfig` union and the Zod schemas are
declared once in `src/types/actionEnums.ts` and derived by both, so they cannot
drift.

Preserve the current v2 graph JSON contract unless a schema change is intentionally designed.

## Removed Actions

`open_url`, `sleep`, and `type_text` are not part of the current action type set.

- `open_url` -> `navigate`
- `sleep` -> `wait` with `condition: "duration"` and `duration_ms`

`random_wait` is a first-class wait action with `min_ms` and `max_ms`. Both values must be greater than zero, and `max_ms` must be greater than or equal to `min_ms`.
- `type_text` -> `input_text`
