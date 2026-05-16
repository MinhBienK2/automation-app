# Action And Graph Node Audit Matrix

Status: action/node inventory and field matrix reviewed; findings and test gaps linked.

Generated from current code on 2026-05-15. Do not mark this audit complete until each matrix row has a field-level review, verified tests, and findings linked in `findings.md`.

## Sources

- Action contract: `src/types/workflow.ts`
- Capability registry: `src/lib/actionCapabilities.ts`
- Defaults: `src/features/workflows/lib/workflowActionDefaults.ts`
- UI editor: `src/features/workflows/components/ActionConfigEditor.tsx`, `ActionConfig*Fields.tsx`, `WorkflowGraphInspectorFields.tsx`
- Help: `src/features/workflows/lib/stepHelpContent.ts`, `graphNodeHelpContent.ts`
- Backend: `electron/backend/graphCompiler.ts`, `runner.ts`, `commands.ts`
- Migration: `electron/backend/workflowGraphMigration.ts`
- Coverage registry: `tests/e2e/support/coverageMatrix.ts`
- E2E guard: `tests/e2e/coverage-matrix.e2e.ts`

## Audit Rule

Start every pass from this inventory. Do not infer coverage from docs or file names alone. A `yes` below means the token appears in the source area and still requires behavior review.

For each action and node:

- Review the TypeScript config shape.
- List each field and classify it as `required`, `optional`, `legacy compatibility`, `hidden/internal`, or `launch-time-only`.
- Recurse into nested targets, iframe targets, conditions, action arrays, switch cases, variable rows, and mappings.
- Verify default, UI editability, backend validation, graph compile preservation, runner execution, help text, docs, and behavior tests.
- Mark a row `reviewed` only after recording test evidence or a finding.

## Action Inventory

| Action | Capability | Contract | Default | UI | Help | Command validation | Compiler | Runner | Migration | Coverage registry | Docs | Audit |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `navigate` | implemented | `src/types/workflow.ts:2` | yes | yes | yes | token-check | yes | yes | yes | matrix | yes | reviewed |
| `wait` | implemented | `src/types/workflow.ts:3` | yes | yes | yes | token-check | yes | yes | yes | matrix | yes | reviewed |
| `random_wait` | implemented | `src/types/workflow.ts:4` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |
| `input_text` | implemented_partial_requires_validation | `src/types/workflow.ts:5` | yes | yes | yes | token-check | yes | yes | yes | matrix | yes | reviewed |
| `clear_input` | implemented_partial_requires_validation | `src/types/workflow.ts:6` | yes | yes | yes | token-check | yes | yes | yes | matrix | yes | reviewed |
| `click` | implemented_partial_requires_validation | `src/types/workflow.ts:7` | yes | yes | yes | token-check | yes | yes | yes | matrix | yes | reviewed |
| `scroll` | implemented_partial_requires_validation | `src/types/workflow.ts:8` | yes | yes | yes | token-check | yes | yes | yes | matrix | yes | reviewed |
| `select_option` | implemented_partial_requires_validation | `src/types/workflow.ts:9` | yes | yes | yes | token-check | yes | yes | yes | matrix | yes | reviewed |
| `set_checkbox` | compatibility_hidden | `src/types/workflow.ts:10` | yes | yes | yes | token-check | no | yes | yes | matrix | yes | reviewed; F-011 |
| `press_key` | implemented | `src/types/workflow.ts:11` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |
| `hotkey` | implemented | `src/types/workflow.ts:12` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |
| `hover` | implemented_partial_requires_validation | `src/types/workflow.ts:13` | yes | yes | yes | token-check | yes | yes | yes | matrix | yes | reviewed |
| `double_click` | implemented_partial_requires_validation | `src/types/workflow.ts:14` | yes | yes | yes | token-check | yes | yes | yes | matrix | yes | reviewed |
| `right_click` | implemented_partial_requires_validation | `src/types/workflow.ts:15` | yes | yes | yes | token-check | yes | yes | yes | matrix | yes | reviewed |
| `drag_and_drop` | implemented_partial_requires_validation | `src/types/workflow.ts:16` | yes | yes | yes | token-check | yes | yes | yes | matrix | yes | reviewed |
| `focus_element` | implemented_partial_requires_validation | `src/types/workflow.ts:17` | yes | yes | yes | token-check | yes | yes | yes | matrix | yes | reviewed |
| `blur_element` | implemented_partial_requires_validation | `src/types/workflow.ts:18` | yes | yes | yes | token-check | yes | yes | yes | matrix | yes | reviewed |
| `type_sequence` | implemented_partial_requires_validation | `src/types/workflow.ts:19` | yes | yes | yes | token-check | yes | yes | yes | matrix | yes | reviewed |
| `set_clipboard` | implemented | `src/types/workflow.ts:20` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |
| `paste_clipboard` | implemented_partial_requires_validation | `src/types/workflow.ts:21` | yes | yes | yes | token-check | yes | yes | yes | matrix | yes | reviewed |
| `check` | implemented_partial_requires_validation | `src/types/workflow.ts:22` | yes | yes | yes | token-check | yes | yes | yes | matrix | yes | reviewed |
| `uncheck` | implemented_partial_requires_validation | `src/types/workflow.ts:23` | yes | yes | yes | token-check | yes | yes | yes | matrix | yes | reviewed |
| `toggle_checkbox` | implemented_partial_requires_validation | `src/types/workflow.ts:24` | yes | yes | yes | token-check | yes | yes | yes | matrix | yes | reviewed |
| `select_radio` | implemented_partial_requires_validation | `src/types/workflow.ts:25` | yes | yes | yes | token-check | yes | yes | yes | matrix | yes | reviewed |
| `upload_file` | implemented_partial_requires_validation | `src/types/workflow.ts:26` | yes | yes | yes | token-check | yes | yes | yes | matrix | yes | reviewed |
| `submit_form` | implemented_partial_requires_validation | `src/types/workflow.ts:27` | yes | yes | yes | token-check | yes | yes | yes | matrix | yes | reviewed |
| `select_custom_option` | implemented_partial_requires_validation | `src/types/workflow.ts:28` | yes | yes | yes | token-check | yes | yes | yes | matrix | yes | reviewed |
| `set_contenteditable` | implemented_partial_requires_validation | `src/types/workflow.ts:29` | yes | yes | yes | token-check | yes | yes | yes | matrix | yes | reviewed |
| `extract_text` | implemented_partial_requires_validation | `src/types/workflow.ts:30` | yes | yes | yes | token-check | yes | yes | yes | matrix | yes | reviewed |
| `extract_attribute` | implemented_partial_requires_validation | `src/types/workflow.ts:31` | yes | yes | yes | token-check | yes | yes | yes | matrix | yes | reviewed |
| `extract_input_value` | implemented_partial_requires_validation | `src/types/workflow.ts:32` | yes | yes | yes | token-check | yes | yes | yes | matrix | yes | reviewed |
| `extract_table` | implemented_partial_requires_validation | `src/types/workflow.ts:33` | yes | yes | yes | token-check | yes | yes | yes | matrix | yes | reviewed |
| `extract_list` | implemented_partial_requires_validation | `src/types/workflow.ts:34` | yes | yes | yes | token-check | yes | yes | yes | matrix | yes | reviewed |
| `take_screenshot` | implemented | `src/types/workflow.ts:35` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |
| `go_back` | implemented | `src/types/workflow.ts:36` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |
| `go_forward` | implemented | `src/types/workflow.ts:37` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |
| `reload` | implemented | `src/types/workflow.ts:38` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |
| `open_new_tab` | implemented | `src/types/workflow.ts:39` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |
| `switch_tab` | implemented | `src/types/workflow.ts:40` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |
| `close_tab` | implemented | `src/types/workflow.ts:41` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |
| `switch_frame` | planned_hidden | `src/types/workflow.ts:42` | yes | yes | yes | token-check | yes | yes | yes | matrix | yes | reviewed; F-004 |
| `accept_dialog` | implemented_partial_requires_validation | `src/types/workflow.ts:43` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |
| `dismiss_dialog` | implemented_partial_requires_validation | `src/types/workflow.ts:44` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |
| `set_download_directory` | launch_time_only | `src/types/workflow.ts:45` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed; F-003 test gap |
| `wait_for_download` | implemented_partial_requires_validation | `src/types/workflow.ts:46` | yes | yes | yes | token-check | yes | yes | yes | matrix | yes | reviewed |
| `set_variable` | implemented | `src/types/workflow.ts:47` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |
| `set_json_variables` | implemented | `src/types/workflow.ts:48` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |
| `assert_element` | implemented_partial_requires_validation | `src/types/workflow.ts:49` | yes | yes | yes | token-check | yes | yes | yes | matrix | yes | reviewed; F-010 fixed |
| `assert_text` | implemented_partial_requires_validation | `src/types/workflow.ts:50` | yes | yes | yes | token-check | yes | yes | yes | matrix | yes | reviewed |
| `if_condition` | compatibility_hidden | `src/types/workflow.ts:51` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |
| `repeat_times` | compatibility_hidden | `src/types/workflow.ts:52` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |
| `repeat_for_each` | compatibility_hidden | `src/types/workflow.ts:53` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |
| `retry_block` | compatibility_hidden | `src/types/workflow.ts:54` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |
| `switch_condition` | compatibility_hidden | `src/types/workflow.ts:55` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |
| `while_loop` | compatibility_hidden | `src/types/workflow.ts:56` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |
| `repeat_until` | compatibility_hidden | `src/types/workflow.ts:57` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |
| `try_catch` | compatibility_hidden | `src/types/workflow.ts:58` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed; F-006 |
| `fallback_block` | compatibility_hidden | `src/types/workflow.ts:59` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed; F-006 |
| `break_loop` | compatibility_hidden | `src/types/workflow.ts:60` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |
| `continue_loop` | compatibility_hidden | `src/types/workflow.ts:61` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |
| `stop_workflow` | compatibility_hidden | `src/types/workflow.ts:62` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |
| `transform_variable` | compatibility_hidden | `src/types/workflow.ts:63` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed; F-005 |
| `assert_output` | compatibility_hidden | `src/types/workflow.ts:64` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed; F-005 |
| `run_subworkflow` | compatibility_hidden | `src/types/workflow.ts:65` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed; F-005 |
| `domain_allowlist` | compatibility_hidden | `src/types/workflow.ts:66` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |
| `use_profile` | launch_time_only | `src/types/workflow.ts:67` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed; F-003 test gap |
| `save_session` | planned_hidden | `src/types/workflow.ts:68` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed; F-004 |
| `load_session` | planned_hidden | `src/types/workflow.ts:69` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed; F-004 |
| `set_cookie` | implemented | `src/types/workflow.ts:70` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |
| `clear_cookies` | implemented | `src/types/workflow.ts:71` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |
| `set_secret` | planned_hidden | `src/types/workflow.ts:72` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed; F-004 |
| `use_proxy` | launch_time_only | `src/types/workflow.ts:73` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |
| `set_user_agent` | launch_time_only | `src/types/workflow.ts:74` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed; F-002/F-003 |
| `set_viewport` | implemented_partial_requires_validation | `src/types/workflow.ts:75` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed; F-007 fixed |
| `set_geolocation` | implemented | `src/types/workflow.ts:76` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |
| `set_extra_headers` | implemented | `src/types/workflow.ts:77` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |
| `grant_permission` | implemented | `src/types/workflow.ts:78` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |
| `detect_challenge` | planned_hidden | `src/types/workflow.ts:79` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed; F-004 |
| `pause_for_human` | planned_hidden | `src/types/workflow.ts:80` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed; F-004 |
| `resume_when_condition` | compatibility_hidden | `src/types/workflow.ts:81` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |
| `fallback_selector` | planned_hidden | `src/types/workflow.ts:82` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed; F-004 |
| `retry_step` | planned_hidden | `src/types/workflow.ts:83` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed; F-004 |
| `checkpoint` | planned_hidden | `src/types/workflow.ts:84` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed; F-004 |
| `execute_js` | implemented | `src/types/workflow.ts:85` | yes | yes | yes | token-check | yes | yes | yes | matrix | yes | reviewed; F-019 fixed |
| `wait_for_request` | implemented | `src/types/workflow.ts:86` | yes | yes | yes | token-check | yes | yes | yes | matrix | yes | reviewed |
| `wait_for_response` | implemented | `src/types/workflow.ts:87` | yes | yes | yes | token-check | yes | yes | yes | matrix | yes | reviewed |
| `block_request` | implemented | `src/types/workflow.ts:88` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |
| `mock_response` | implemented | `src/types/workflow.ts:89` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed; F-008 fixed |
| `set_local_storage` | implemented | `src/types/workflow.ts:90` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |
| `set_session_storage` | implemented | `src/types/workflow.ts:91` | yes | yes | yes | token-check | yes | yes | no | matrix | yes | reviewed |

## Graph Node Inventory

| Node | Contract | UI | Help | Compiler | Runner/progress | Coverage registry | Docs | Audit |
|---|---|---|---|---|---|---|---|---|
| `start` | `src/types/workflow.ts:885` | yes | yes | yes | progress-only | matrix | yes | reviewed |
| `end_success` | `src/types/workflow.ts:886` | yes | yes | yes | terminal | matrix | yes | reviewed |
| `end_failure` | `src/types/workflow.ts:887` | yes | yes | yes | terminal | matrix | yes | reviewed |
| `action` | `src/types/workflow.ts:888` | yes | yes | yes | action dispatch | matrix | yes | reviewed |
| `if` | `src/types/workflow.ts:889` | yes | yes | yes | nested branch | matrix | yes | reviewed |
| `switch` | `src/types/workflow.ts:890` | yes | yes | yes | nested branch | matrix | yes | reviewed |
| `repeat_times` | `src/types/workflow.ts:891` | yes | yes | yes | loop context | matrix | yes | reviewed |
| `repeat_for_each` | `src/types/workflow.ts:892` | yes | yes | yes | loop context | matrix | yes | reviewed |
| `repeat_until` | `src/types/workflow.ts:893` | yes | yes | yes | loop context | matrix | yes | reviewed |
| `while` | `src/types/workflow.ts:894` | yes | yes | yes | loop context | matrix | yes | reviewed |
| `retry` | `src/types/workflow.ts:895` | yes | yes | yes | retry context | matrix | yes | reviewed |
| `try_catch` | `src/types/workflow.ts:896` | yes | yes | yes | nested recovery | matrix | yes | reviewed; F-006 |
| `fallback` | `src/types/workflow.ts:897` | yes | yes | yes | nested recovery | matrix | yes | reviewed; F-006 |
| `break_loop` | `src/types/workflow.ts:898` | yes | yes | yes | loop control | matrix | yes | reviewed |
| `continue_loop` | `src/types/workflow.ts:899` | yes | yes | yes | loop control | matrix | yes | reviewed |
| `stop_workflow` | `src/types/workflow.ts:900` | yes | yes | yes | terminal | matrix | yes | reviewed |
| `set_variable` | `src/types/workflow.ts:901` | yes | yes | yes | variable write | matrix | yes | reviewed |
| `set_json_variables` | `src/types/workflow.ts:902` | yes | yes | yes | variable write | matrix | yes | reviewed |
| `transform_variable` | `src/types/workflow.ts:903` | yes | yes | yes | variable write | matrix | yes | reviewed; F-005 |
| `assert_output` | `src/types/workflow.ts:904` | yes | yes | yes | assertion | matrix | yes | reviewed; F-005 |
| `run_subworkflow` | `src/types/workflow.ts:905` | yes | yes | yes | explicit unsupported | matrix | yes | reviewed; F-005 |
| `manual_approval` | `src/types/workflow.ts:906` | yes | yes | yes | planned guard | matrix | yes | reviewed; F-009 |
| `rate_limit` | `src/types/workflow.ts:907` | yes | yes | yes | wait/pacing | matrix | yes | reviewed; F-009 |
| `domain_allowlist` | `src/types/workflow.ts:908` | yes | yes | yes | run policy | matrix | yes | reviewed |

## Field Matrix Work Queue

Use `src/types/workflow.ts:305` through the end of `ActionConfig` as the authoritative list. Rows below are reviewed shared-field rows; continue expanding one row per remaining action/node field.

| Action/node | Field path | Type | Class | Default | UI editable | Validation | Compiler | Runner | Help/docs | Tests | Audit |
|---|---|---|---|---|---|---|---|---|---|---|---|
| element-target actions | `config.target` | `ElementTarget \| null` | optional primary selector | `workflowActionDefaults.ts:20` through `workflowActionDefaults.ts:68` initialize `target: null` for visible element actions | `ActionConfigElementSharedFields.tsx:42` renders structured target fields | `graphCompiler.ts:1081` and `graphCompiler.ts:1784` require either legacy XPath or structured target where the action needs an element | compiler preserves action config after `workflowGraphMigration.ts:244` converts legacy fields | `runner.ts:1338` and `runner.ts:1876` resolve target before action execution | field lists generated in `stepHelpContent.ts:862` | `runner.test.ts:1903`, `WorkflowGraphEditor.test.tsx:700`, `workflowActionDefaults.test.ts:37` | reviewed |
| element-target actions | `config.target.locators[]` | `ElementLocator[]` | required when structured target present | default `null`; first locator created by UI on input | `ActionConfigElementSharedFields.tsx:161` creates a one-locator structured target | `graphCompiler.ts:1797` accepts any locator with a nonblank value | preserved | `runner.ts:1892` iterates ordered locators until constraints pass | `stepHelpContent.ts:864` through `stepHelpContent.ts:872` lists target locator fields | `runner.test.ts:1903` covers ordered fallback locators | reviewed |
| element-target actions | `config.target.locators[].kind` | `ElementLocatorKind` | required | UI default kind is `xpath` | `ActionConfigElementSharedFields.tsx:149` and `ActionConfigElementSharedFields.tsx:214` | only value presence is validated; kind-specific validation is runtime/TypeScript only | preserved | `runner.ts:1921` maps `test_id`, `role`, `label`, `placeholder`, `text`, `attribute`, `css`, and `xpath` | `stepHelpContent.test.ts:283` covers visible option labels | `runner.test.ts:1945`, `WorkflowGraphEditor.test.tsx:806` | reviewed |
| element-target actions | `config.target.locators[].value` | `string` | required | empty until operator input | `ActionConfigElementSharedFields.tsx:231` | `graphCompiler.ts:1800` requires nonblank value | preserved | consumed by locator-kind mapper | field guidance in `stepHelpContent.ts:1205` | `WorkflowGraphEditor.test.tsx:708` persists value | reviewed |
| element-target actions | `config.target.locators[].role` | `string \| null` | optional role locator parameter | UI defaults role to `button` for role kind | `ActionConfigElementSharedFields.tsx:239` | not validated beyond structured target value | preserved | `runner.ts:1929` passes role/name to `getByRole` | help option coverage in `stepHelpContent.test.ts:283` | `runner.test.ts:1962` covers role locator | reviewed |
| element-target actions | `config.target.locators[].attribute` | `string \| null` | optional attribute locator parameter | UI empty until operator input for attribute kind | `ActionConfigElementSharedFields.tsx:248` | not validated beyond structured target value | preserved | `runner.ts:1946` falls back to `data-testid` when absent | help option coverage in `stepHelpContent.test.ts:283` | `runner.test.ts:1987` covers attribute locator | reviewed |
| element-target actions | `config.target.locators[].exact` | `boolean \| null` | optional locator matching flag | preserved when present; no default editor control found | no visible direct control found in `ActionConfigElementSharedFields.tsx` | not validated | preserved | used by role/label/placeholder/text locators in `runner.ts:1931` through `runner.ts:1945` | no direct field label in current help | no direct test found | reviewed; test/UI gap remains under full field expansion |
| element-target actions | `config.target.constraints.visible` | `boolean \| null` | optional filter | default any/null | `ActionConfigElementSharedFields.tsx:257` | not type/range validated | preserved | `runner.ts:1986` checks locator visibility | `stepHelpContent.ts:1147` describes locator constraints | `runner.test.ts:1903` covers visible true | reviewed |
| element-target actions | `config.target.constraints.enabled` | `boolean \| null` | optional filter | default any/null | `ActionConfigElementSharedFields.tsx:274` | not type/range validated | preserved | `runner.ts:1990` checks locator enabled state | `stepHelpContent.ts:1147` describes locator constraints | `runner.test.ts:1903` covers enabled true | reviewed |
| element-target actions | `config.target.constraints.contains_text` | `string \| null` | optional filter | default empty/null | `ActionConfigElementSharedFields.tsx:291` | not validated | preserved | `runner.ts:1994` checks `textContent` includes value | `stepHelpContent.ts:1230` describes contains-text filter | no direct behavior test found | reviewed; test gap remains under full field expansion |
| element-target actions | `config.target.constraints.index` | `number \| null` | optional zero-based selector disambiguation | default empty/null | `ActionConfigElementSharedFields.tsx:298` | UI min is `0`; backend does not range-check structured constraint | preserved | `runner.ts:1972` applies `locator.nth(index)` | `stepHelpContent.ts:1235` describes zero-based index | no direct behavior test found | reviewed; test gap remains under full field expansion |
| element-target actions | `config.target.iframe` | `ElementTarget \| null` | optional nested iframe scope | created by legacy migration, not default | primary structured target UI preserves but cannot author it | migration validates by conversion; compiler only checks target has a nonblank locator | preserved after migration | `runner.ts:1882` and `runner.ts:1910` execute inside `frameLocator` | help still discusses iframe targeting in action copy | `workflowGraphMigration.test.ts:16`, `runner.test.ts:1945` | reviewed; F-012 |
| legacy element actions | `config.xpath` | `string \| null` | legacy compatibility selector | removed from visible defaults by `workflowActionDefaults.test.ts:6` | no primary UI control for visible actions | migrated by `workflowGraphMigration.ts:244` | converted into structured `target` before command validation/compile in `commands.ts:448` | runner still falls back to XPath for direct runner/internal compatibility | legacy help copy remains in some action prose | `workflowGraphMigration.test.ts:16`, `graphCompiler.test.ts:561` | reviewed |
| legacy element actions | `config.iframe_xpath` | `string \| null` | legacy compatibility iframe selector | removed from visible defaults by `workflowActionDefaults.test.ts:6` | legacy `ElementOptionalFields` exists but is not rendered | migrated/dropped by `workflowGraphMigration.ts:212` and `workflowGraphMigration.ts:257` | converted into `target.iframe` before command validation/compile | runner consumes only `target.iframe`; raw `iframe_xpath` is not used | help/docs drift recorded for iframe authoring | `workflowStepForm.test.ts:74`, `workflowGraphMigration.test.ts:16` | reviewed; F-012 |
| condition nodes/actions | `condition.kind` | `"output_equals" \| "output_contains" \| "text_visible" \| "url_contains" \| "element_visible"` | required discriminator | defaults use `output_equals` or action-specific defaults in `workflowActionDefaults.ts:189` and `workflowGraph.ts:481` | `WorkflowGraphConditionFields.tsx:17` renders allowed condition kinds | known-kind field validation exists but unknown kind is not rejected in `graphCompiler.ts:1672` | preserved into nested control-flow action configs | `runner.ts:2239` through `runner.ts:2257` evaluates known kinds and returns false for unknown kinds | graph node help option list in `graphNodeHelpContent.ts:518` | known-kind tests exist in `runner.test.ts:1074`; no invalid-kind test found | reviewed; F-013 |
| condition nodes/actions | `condition.name` | `string` | required for output conditions | default `"name"` | `WorkflowGraphConditionFields.tsx:27` | `graphCompiler.ts:1674` through `graphCompiler.ts:1677` requires nonblank | preserved | `runner.ts:2239` and `runner.ts:2240` read runtime outputs by name | graph help covers output condition kinds | `control-flow.e2e.ts:152`, `runner.test.ts:1021` | reviewed |
| condition nodes/actions | `condition.value` | `string` | required for output/url conditions | default empty or template-specific value | `WorkflowGraphConditionFields.tsx:37` and `WorkflowGraphConditionFields.tsx:60` | `graphCompiler.ts:1677` and `graphCompiler.ts:1683` require nonblank | preserved | `runner.ts:2239`, `runner.ts:2240`, and `runner.ts:2243` compare output/URL values | graph help covers output/url conditions | `control-flow.e2e.ts:152`, `runner.test.ts:1088` | reviewed |
| condition nodes/actions | `condition.text` | `string` | required for text-visible condition | default empty for graph condition UI; default `"Welcome"` for `resume_when_condition` | `WorkflowGraphConditionFields.tsx:49` | `graphCompiler.ts:1679` through `graphCompiler.ts:1680` requires nonblank | preserved | `runner.ts:2249` queries text locator visibility | graph/action help covers text-visible conditions | `runner.test.ts:1074`, `workflowStepForm.test.ts:523` | reviewed |
| condition nodes/actions | `condition.xpath` | `string \| null` | legacy compatibility element selector | default empty for element-visible graph condition | `WorkflowGraphConditionFields.tsx:71` exposes legacy XPath only for graph conditions | `graphCompiler.ts:1685` requires either `target` or nonblank `xpath` | migrated by `workflowGraphMigration.ts:284` for legacy edge/node conditions | runner falls back to `locatorFor(..., typed.xpath ?? "body")` in `runner.ts:2252` | graph help still describes Element XPath | `workflowGraphMigration.test.ts:103`, `graphCompiler.test.ts:64` | reviewed |
| condition nodes/actions | `condition.target` | `ElementTarget \| null` | optional structured element condition target | migrated from legacy XPath when present | no structured target editor in `WorkflowGraphConditionFields.tsx`; condition UI uses XPath input | `graphCompiler.ts:1685` accepts target presence without structured-shape validation | preserved | `runner.ts:2252` executes structured target through shared locator resolver | graph help does not expose structured target fields for conditions | migration/runner coverage exists for known conditions, UI coverage is XPath-only | reviewed; field/UI gap remains under full condition expansion |
| nested control actions | `then_steps`, `else_steps`, `steps`, `failed_steps`, `default_steps`, `try_steps`, `success_steps`, `error_steps`, `finally_steps`, `primary_steps`, `fallback_steps`, `timeout_steps` | `CompiledNestedAction[]` | required branch/body arrays, optional semantics by port | defaults are empty arrays in `workflowActionDefaults.ts:189` through `workflowActionDefaults.ts:239` | compatibility action editors mostly do not expose nested arrays; visual graph ports author these paths | `graphCompiler.ts:1149` validates arrays recursively | graph nodes compile each branch port through `compileNestedConfigs` in `graphCompiler.ts:266` through `graphCompiler.ts:383` | runner executes arrays through branch/loop/retry/recovery handlers in `runner.ts:882` through `runner.ts:961` | graph-node help documents branch/body/continuation semantics | `graphCompiler.test.ts:62`, `graphCompiler.test.ts:676`, `runner.test.ts:1005`, `runner.test.ts:1074` | reviewed; recovery depth gaps tracked in F-006 |
| nested control actions | `CompiledNestedAction.graph_node_id` | `string` | hidden/internal progress mapping | set by compiler only | not UI editable | not directly validated on input | `graphCompiler.ts:483` attaches source graph node id to nested actions | runner progress uses nested graph ids when reporting branch steps | graph docs describe nested path progress behavior indirectly | `graphCompiler.test.ts:249`, `runner.test.ts:1268` | reviewed |
| nested control actions | `CompiledNestedAction.graph_label` | `string` | hidden/internal progress mapping | set by compiler only | not UI editable | not directly validated on input | `graphCompiler.ts:483` attaches source graph label to nested actions | runner progress surfaces nested labels in run state | graph docs describe nested path progress behavior indirectly | `graphCompiler.test.ts:249`, `runner.test.ts:1268` | reviewed |
| switch control actions | `cases[].value` | `string` | required branch discriminator | graph node config supplies values | graph inspector handles switch config; compatibility editor has no nested authoring | `graphCompiler.ts:1170` through `graphCompiler.ts:1179` requires nonblank case values | graph compiler maps each case port to `cases[index].steps` in `graphCompiler.ts:281` | `runner.ts:911` selects the first case whose value matches expression/output | graph help documents switch case/default ports | `graphCompiler.test.ts:62` covers compile shape; deeper runner fallback coverage remains under action/node gaps | reviewed |
| switch control actions | `cases[].steps` | `CompiledNestedAction[]` | required nested branch body | empty when case port unconnected | graph ports author branch body | `graphCompiler.ts:1179` validates recursively | `graphCompiler.ts:285` through `graphCompiler.ts:288` compiles per-case branch paths | `runner.ts:914` executes matched case steps | graph help documents case ports | `graphCompiler.test.ts:62` | reviewed |
| retry/recovery actions | `failed_steps`, `error_steps`, `fallback_steps`, `finally_steps` | `CompiledNestedAction[]` | recovery/cleanup nested paths | default empty arrays | graph ports author recovery paths | recursive validation exists | compiler maps retry/try/fallback ports in `graphCompiler.ts:349` through `graphCompiler.ts:383` | runner semantics in `runner.ts:908`, `runner.ts:942`, and `runner.ts:953` | graph help documents recovery ports | coverage overstated for recovery paths | reviewed; F-006 |
| `set_variable` action/node | `config.name` | `string \| null` | legacy single-variable name | graph node defaults to `name` | variable row UI converts legacy config into row model in `VariableConfigFields.tsx:119` | `graphCompiler.ts:827` requires name when no `variables[]` rows exist | graph compiler converts node config in `graphCompiler.ts:1691` | `runner.ts:2175` treats it as a one-row assignment when `variables[]` is absent | help lists Set Variables fields | `workflowStepForm.test.ts:368`, `runner.test.ts:788` | reviewed |
| `set_variable` action/node | `config.value` | `string \| null` | legacy single-variable value | default empty string | row UI exposes value input | not validated except through runtime parser | graph compiler preserves value or defaults empty in `graphCompiler.ts:1707` | `runner.ts:2197` renders templates before parsing | help lists Set Variables fields | `runner.test.ts:942`, `control-flow.e2e.ts:140` | reviewed |
| `set_variable` action/node | `config.value_type` | `VariableValueType \| null` | legacy single-variable type | UI defaults to `text` | `VariableConfigFields.tsx:70` limits visible values to valid enum options | compiler does not validate enum value | graph compiler sets node legacy value type to null in `graphCompiler.ts:1709` | `runner.ts:2192` parses known types and falls back to text for unknown types | help/docs describe typed values generally | happy-path typed tests exist; invalid type missing | reviewed; F-014 |
| `set_variable` action/node | `config.variables[]` | `VariableAssignment[]` | preferred multi-row variable assignments | default one text row | `VariableConfigFields.tsx:58` renders rows and add/remove controls | `graphCompiler.ts:827` validates row names only | graph compiler preserves rows in `graphCompiler.ts:1692` through `graphCompiler.ts:1701` | `runner.ts:2182` writes each row to outputs | graph/node help covers storing values | `graphCompiler.test.ts:78`, `runner.test.ts:952`, `control-flow.e2e.ts:140` | reviewed; F-014 for row value types |
| `set_variable` action/node | `variables[].name` | `string` | required row path | default `"name"` or empty new row | `VariableConfigFields.tsx:60` | `graphCompiler.ts:830` requires nonblank names; UI warns on duplicates in `VariableConfigFields.tsx:102` | preserved | `runner.ts:2183` skips blank names defensively | help covers variable path concept | `workflowGraph.test.ts:66`, `graphCompiler.test.ts:78` | reviewed |
| `set_variable` action/node | `variables[].value_type` | `VariableValueType` | required row type | default `text` | `VariableConfigFields.tsx:68` | not validated against enum or parse boundary | preserved | `runner.ts:2197` parses known types | settings tests cover valid typed rows; action invalid cases missing | `workflowSettings.test.ts:155`, `runner.test.ts:952` | reviewed; F-014 |
| `set_variable` action/node | `variables[].value` | `string` | required row value | default empty | `VariableConfigFields.tsx:83` | not validated except row-name presence | preserved | `runner.ts:2197` template-renders and parses | help covers value input | `runner.test.ts:952`, `batch-evidence.e2e.ts:26` | reviewed |
| `set_json_variables` action/node | `config.json` | `string` | required JSON object source | default `{}` in graph/defaults | JSON textarea/editor path in graph inspector/action output fields | `graphCompiler.ts:838` parses static JSON and requires object | graph compiler requires nonblank json in `graphCompiler.ts:406` | `runner.ts:859` template-renders, parses, requires object, and flattens | help covers JSON variables | `runner.test.ts:952`, `commands.test.ts:957`, `control-flow.e2e.ts:143` | reviewed |
| `navigate` | `config.url` | `string` | required | default empty string in `workflowActionDefaults.ts:5` | URL input in `ActionConfigCoreFields.tsx:22` | `graphCompiler.ts:653` requires nonblank URL | preserved by action node compile | `runner.ts:565` template-renders URL, checks domain policy, then calls `page.goto` | Navigate help documents URL | E2E navigation and runner domain policy tests cover URL behavior | reviewed |
| `navigate` | `config.wait_until` | `"load" \| "dom_content_loaded" \| "network_idle" \| null` | optional API/runtime timing field | omitted from visible default | no visible Navigate editor control found | not enum-validated in `graphCompiler.ts:653` | preserved if imported/API-provided | `runner.ts:568` passes mapped value through `waitUntil()` | help describes `Wait until`, but actual field list returns only `URL` | no invalid enum test found | reviewed; F-015 |
| `navigate` | `config.timeout_ms` | `number \| null` | optional API/runtime timing field | omitted from visible default | no visible Navigate editor control found | `graphCompiler.ts:656` requires positive value when present | preserved | `runner.ts:569` passes timeout to `page.goto` | help describes `Timeout ms`, but actual field list returns only `URL` | direct invalid timeout validation exists through generic action validation; UI/help drift under F-015 | reviewed; F-015 |
| `wait` | `config.condition` | wait condition enum | required discriminator | default `duration` in `workflowActionDefaults.ts:7` | select in `ActionConfigCoreFields.tsx:39` | `graphCompiler.ts:658` through `graphCompiler.ts:674` validates enum | preserved | `runner.ts:1155` dispatches each condition | wait help lists condition meanings | `runner.test.ts:858`, `wait-assertion-actions.e2e.ts:59` | reviewed |
| `wait` | `config.duration_ms` | `number \| null` | required when `condition=duration` | default `1000` | rendered only for duration condition | `graphCompiler.ts:675` requires positive duration | preserved | `runner.ts:1157` sleeps configured/default duration | wait help documents duration | `workflowStepForm.test.ts:9`, `runner.test.ts:662` | reviewed |
| `wait` | `config.target`/`config.xpath` | `ElementTarget \| null` / legacy selector | required for element conditions | default `target: null` | structured target fields when `condition.startsWith("element_")` | `graphCompiler.ts:678` requires an element target for element waits | legacy XPath migrates to target; config preserved | `runner.ts:1171` through `runner.ts:1218` uses shared locator resolver | wait help lists target fields | `runner.test.ts:858`, `wait-assertion-actions.e2e.ts:69` | reviewed |
| `wait` | `config.text` | `string \| null` | required for `text_visible` | default null | text input for text-visible | `graphCompiler.ts:684` requires nonblank text | preserved | `runner.ts:1191` waits for text locator visible | wait help documents text | `runner.test.ts:872`, `wait-assertion-actions.e2e.ts:74` | reviewed |
| `wait` | `config.url` | `string \| null` | required for `url_contains` | default null | URL contains input | `graphCompiler.ts:688` requires nonblank URL fragment | preserved | `runner.ts:1165` uses `page.waitForURL` includes predicate | wait help documents URL contains | `runner.test.ts:1074`, `wait-assertion-actions.e2e.ts:79` | reviewed |
| `wait` | `config.timeout_ms` | `number \| null` | optional wait timeout | omitted from visible default | no visible generic timeout control in current wait editor | `graphCompiler.ts:692` validates positive value when present | preserved | passed to wait APIs for non-duration waits | generic timeout help exists but not in visible wait field list | runner tests cover timeout propagation; UI currently treats it as API/advanced-only | reviewed |
| `random_wait` | `config.min_ms` | `number` | required lower bound | default `500` | minimum input in `ActionConfigCoreFields.tsx:101` | positive validation exists in graph compiler for random wait | preserved | `runner.ts:577` computes inclusive random delay | help documents min/max wait | `workflowStepForm.test.ts:20`, wait assertion E2E covers action presence | reviewed |
| `random_wait` | `config.max_ms` | `number` | required upper bound | default `1500` | maximum input in `ActionConfigCoreFields.tsx:115` | graph compiler validates positive and max >= min | preserved | `runner.ts:577` computes inclusive random delay | help documents min/max wait | `workflowStepForm.test.ts:20`, wait assertion E2E covers action presence | reviewed |
| navigation tab actions | `go_back`, `go_forward`, `reload` config | `Record<string, never>` | no configurable fields | empty object defaults | no fields rendered in `ActionConfigBrowserFields.tsx:18` | no validation needed | preserved | `runner.ts:807` through `runner.ts:814` calls page history/reload APIs | help marks no fields | `navigation-actions.e2e.ts:5` | reviewed |
| `open_new_tab` | `config.url` | `string \| null` | optional URL | default optional/blank | URL input in `ActionConfigBrowserFields.tsx:22` | no URL-specific validation; domain policy enforced at runtime when URL present | preserved | `runner.ts:816` creates new page and optionally navigates | help lists tab URL behavior | `runner.test.ts:1494`, `navigation-actions.e2e.ts:83` | reviewed |
| `switch_tab` | `config.index` | `number` | required zero-based tab index | default from action defaults | tab index input in `ActionConfigBrowserFields.tsx:35` | `graphCompiler.ts:812` requires zero-or-positive integer | preserved | `runner.ts:824` fails explicitly if tab missing | help documents tab index | `runner.test.ts:1512`, `navigation-actions.e2e.ts:83` | reviewed |
| `close_tab` | `config.index` | `number \| null` | optional; default current/last tab semantics | blank means current tab in UI copy; runner closes last tab by default | optional tab index input in `ActionConfigBrowserFields.tsx:49` | `graphCompiler.ts:814` validates nonnegative when present | preserved | `runner.ts:831` closes provided index or last context page, then resets active page | help documents tab index | `runner.test.ts:1539`, `navigation-actions.e2e.ts:83` | reviewed |
| `input_text` | `config.text` | `string` | required input value | default empty string | template textarea in `ActionConfigCoreFields.tsx:132` | target/timing validation only; empty text allowed | preserved | `runner.ts:587` and `runner.ts:591` template-render text before type/fill | help lists Text | runner and E2E cover happy path | reviewed |
| `input_text` | `config.clear_before_input` | `boolean` | required input behavior | default true | not visible in primary editor; update helper preserves imported/API value | no boolean validation beyond TypeScript | preserved | `runner.ts:585` clears only when true; `fill` mode still replaces value regardless | help lists clear-before-input in detailed content but visible field list does not | runner test covers true/type and false paths | reviewed |
| `input_text` | `config.typing_mode` / `config.delay_ms` | enum plus optional number | optional typing fidelity fields | omitted from visible default | not visible in primary editor; update helper supports both fields | `typing_mode` enum is validated; `delay_ms` range is still not validated for `input_text` | preserved | runner rejects malformed `typing_mode`, otherwise uses type mode and delay or falls back to fill for null/default set-value mode | detailed help describes Typing mode; visible field list omits it | runner happy path covers `typing_mode: type`; graph/runner invalid-enum tests cover malformed `typing_mode` | reviewed; F-023 fixed |
| element action timing | `config.wait_until` / `config.timeout_ms` / `config.retry_interval_ms` | readiness enum and optional positive/nonnegative numbers | optional API/runtime readiness fields | omitted from visible defaults | `ElementOptionalFields` exists but is not rendered by `ActionConfigEditor`; per-action update helpers preserve imported values | timing numbers and readiness enum are validated | preserved | `locatorForAction` applies wait/readiness for target actions; unknown wait values fail defensively at runtime | detailed help describes timing fields; visible field lists mostly omit them | `runner.test.ts` covers click/input readiness and malformed `wait_until`; UI exposure untested | reviewed; F-023 fixed |
| `clear_input` | `config.method` | `"select_all" \| "backspace" \| "dom" \| null` | optional clear strategy | omitted from visible default | no visible Method editor found | not enum-validated and not required | preserved | `runner.ts:595` through `runner.ts:597` always uses `fill("")`, ignoring method | detailed help documents Method strategies | no behavior test for clear method variants found | reviewed; F-022 |
| `click` | `config.mode` | `"real" \| "force_dom" \| null` | optional click mode | omitted from visible default | no visible Mode editor found | not enum-validated | preserved | runner uses DOM evaluation for `force_dom`; normal mode performs locator click | detailed help documents Real/Force DOM | runner covers force DOM execution | reviewed; F-021 fixed |
| `click` | `config.button` / `config.click_count` | pointer options | optional click parameters | omitted from visible default | no visible controls found | timing helper validates neither button enum nor positive click count | preserved | runner passes button and click count to locator click | detailed help documents Button and Click count | runner covers combined button/click-count with offset path; right-click action has dedicated runtime test | reviewed; F-021 fixed |
| `click` | `config.scroll_into_view`, `block`, `inline`, `position`, `offset_x`, `offset_y` | scroll/coordinate options | optional click targeting fields | omitted from visible default | no visible controls found | not validated for enum/range/required-offset combinations | preserved | runner applies DOM `scrollIntoView` alignment and passes offset/named click positions to locator click | detailed help documents scroll alignment and offset click | runner covers scroll alignment plus offset click | reviewed; F-021 fixed |
| `click` | `config.post_click_wait_ms` | `number \| null` | optional post-action wait | omitted from visible default | no visible control found | `graphCompiler.ts:1100` validates nonnegative when present | preserved | `runner.ts:603` through `runner.ts:605` sleeps after click when set | detailed help does not include Post-click wait in visible field list | no direct post-click wait test found | reviewed |
| `scroll` | `config.mode` | `"page" \| "container" \| "into_view" \| "until_visible"` | required/optional mode with current runtime support only for page | default undefined interpreted as page | UI select exposes all four modes | `graphCompiler.ts:721` through `graphCompiler.ts:725` rejects any non-page mode | preserved | runner only performs page-level `window.scrollBy` | help lists all modes | workflow form test covers updating `until_visible`, not valid run behavior | reviewed; F-020 |
| `scroll` | `config.direction` / `config.pixels` | direction enum plus number | required page scroll vector | default down/500 | UI exposes when mode is not `into_view` | direction enum not validated; pixels positive validation exists | preserved | `runner.ts:635` through `runner.ts:646` maps direction and pixels to delta | help lists Direction/Pixels | core E2E does not cover scroll; pointer E2E coverage owns it | reviewed |
| `scroll` | `config.behavior`, `target`, `max_attempts`, `wait_ms`, `block`, `inline` | optional advanced scroll fields | default behavior null/instant; target null | UI exposes behavior and target for non-page modes | non-page modes fail validation; max/wait validated but not visible | preserved | runner ignores behavior and all target/attempt/alignment fields | help lists behavior and mode semantics | no behavior/target runtime test found | reviewed; F-020 |
| `select_option` | `config.match_by` / `config.value` | enum plus required string | required option selector | default label and empty value | select/input in `ActionConfigFormFields.tsx:27` through `ActionConfigFormFields.tsx:47` | value required; match enum is validated | preserved | runner rejects malformed `match_by` before selecting by label or value | help lists Match by and Value | core E2E covers label path; graph/runner invalid-enum tests cover malformed `match_by` | reviewed; F-023 fixed |
| `set_checkbox` | `config.state` | `"checked" \| "unchecked"` | required checkbox state | default checked | state select in form fields | state enum is validated | preserved | runner rejects malformed state before dispatching check/uncheck | help lists State | F-011: compatibility coverage for legacy `set_checkbox` remains overstated; graph/runner invalid-enum tests cover malformed state | reviewed; F-011; F-023 fixed |
| simple target actions | `hover`, `double_click`, `right_click`, `focus_element`, `blur_element`, `paste_clipboard`, `check`, `uncheck`, `toggle_checkbox`, `select_radio` configs | shared `ElementTargetActionConfig` | required target plus optional timing | default target null | target fields only in form fields | target/timing validation shared | preserved | runner dispatches each method in `runner.ts:607` through `runner.ts:723` | help lists target fields | E2E/runner cover representative actions; per-action timing boundaries incomplete | reviewed |
| `drag_and_drop` | `source_target` / `target_target` and legacy source/target XPath fields | element targets | required source and destination | default source/target null | structured source/destination fields in `ActionConfigFormFields.tsx:105` | compiler validates both targets and timing | preserved | `runner.ts:1260` through `runner.ts:1283` waits source/target and calls `dragTo` | help lists source/destination fields | pointer E2E/runner cover drag support path | reviewed |
| keyboard actions | `press_key.config.key` / `hotkey.config.keys[]` | string and string array | required key input | defaults Enter and Control+S | inputs in `ActionConfigFormFields.tsx:68` through `ActionConfigFormFields.tsx:91` | key required; hotkey requires nonempty key list | preserved | runner calls keyboard press with key or joined combo | help lists Key/Keys | keyboard E2E covers key and hotkey | reviewed |
| `type_sequence` | `config.text` / `config.delay_ms` | required text plus optional delay | required typed text | default empty text | text textarea in form fields | text required; delay nonnegative | preserved | runner calls locator `type` with rendered text and delay | help lists text/typing behavior | keyboard E2E covers type sequence; delay boundary untested | reviewed |
| clipboard actions | `set_clipboard.config.text`, `paste_clipboard.config.target` | string plus target | required clipboard value / paste target | default empty text / target null | set text textarea; paste target fields | set_clipboard has no validation; paste target uses target validation | preserved | runner stores in runtime clipboard then fills paste target | help lists fields | keyboard E2E covers set/paste flow | reviewed |
| `upload_file` | `config.files[]` | `string[]` | required local file paths | default empty array | multiline file list in form fields | compiler requires nonempty list | preserved | runner calls locator `setInputFiles` | help lists Files | extended form E2E covers upload happy path | reviewed |
| `submit_form` | `config.target`/`xpath` | optional submit target | default target null | target fields rendered even though target is optional | if target/xpath present, compiler validates it; blank target allowed | preserved | runner submits resolved form when target exists, otherwise presses Enter on page | docs describe target/no-target behavior | core E2E covers target path; no-target Enter path less covered | reviewed |
| `select_custom_option` | `trigger_target` / `option_text` / `timeout_ms` | trigger target, required text, optional timeout | trigger null, option text empty | trigger target fields and option text input | compiler requires trigger target, option text, positive timeout | preserved | runner clicks trigger then text locator; timeout is not passed to text locator click | help lists fields | extended form E2E covers happy path; timeout behavior untested | reviewed |
| `set_contenteditable` | `config.text` / `clear_before_input` | required text plus clear flag | default empty text, clear true | text textarea and clear select | target/timing validation only; text empty allowed | preserved | runner fills rendered text and ignores clear flag because fill replaces value | help lists Clear before input | extended form E2E covers clear true happy path | reviewed; clear flag semantics gap remains |
| `assert_element` | `config.state` | `"attached" \| "visible" \| "hidden" \| "enabled" \| "disabled"` | required assertion state | default visible | state select in output fields | state enum not validated; target/timing validation only | preserved | runner checks attachment, visibility, hidden, enabled, and disabled states explicitly | help lists all states | runner covers pass/fail for every state; wait/assertion E2E covers visible path | reviewed; F-010 fixed |
| `assert_text` | `config.text` / `match_mode` / `timeout_ms` | required text, match enum, optional timeout | default empty text, contains | output fields render text/match/timeout | text required, timeout positive, and match enum validated | preserved | runner rejects malformed match mode before comparing `contains` or `equals` | help lists fields | E2E covers pass and failure for contains; graph/runner invalid-enum tests cover malformed match mode; equals/boundaries weaker | reviewed; F-023 fixed |
| capture element actions | `config.target`/`config.xpath` | `ElementTarget \| null` / legacy selector | required element target | defaults `target: null` | structured target fields in `ActionConfigCaptureFields.tsx:99` | `graphCompiler.ts:1104` through `graphCompiler.ts:1114` requires element target | legacy XPath migrates through shared target migration | `runner.ts:749` through `runner.ts:783` resolves locator per capture action | help lists target fields | `capture-network.e2e.ts:35`, `runner.test.ts:406`, `runner.test.ts:628` | reviewed |
| capture element actions | `config.output_name` | `string` | required output key | defaults based on action type in `workflowActionDefaults.ts:131` | output name input in `ActionConfigCaptureFields.tsx:109` | `graphCompiler.ts:1112` requires nonblank output name | preserved | capture actions write into `runtime.outputs[output_name]` | help lists output name | `capture-network.e2e.ts:35`, `workflowStepForm.test.ts:244` | reviewed |
| `extract_attribute` | `config.attribute` | `string` | required attribute name | default empty string | attribute input in `ActionConfigCaptureFields.tsx:28` | `graphCompiler.ts:793` through `graphCompiler.ts:797` requires nonblank attribute | preserved | `runner.ts:757` through `runner.ts:765` calls locator `getAttribute(attribute)` | help lists attribute | `capture-network.e2e.ts:40`, `graphCompiler.test.ts:596` | reviewed |
| data capture actions | `config.timeout_ms` | `number \| null` | optional API/runtime timeout | omitted from visible defaults | no visible capture timeout control found | `graphCompiler.ts:1113` validates positive value when present | preserved | not used by current capture runner paths; target readiness is not applied for capture actions | generic timeout help not listed for capture fields | no direct capture timeout behavior test found | reviewed; F-017 |
| `take_screenshot` | `config.path` | `string` | optional safe artifact name despite required TS field | default empty string | path input in `ActionConfigCaptureFields.tsx:44` | `graphCompiler.ts:798` and `graphCompiler.ts:1235` reject unsafe artifact names but allow blank | preserved | `runner.ts:786` resolves managed screenshot evidence artifact with fallback `screenshot` | help says filesystem path and gives invalid absolute-path example | `runner.test.ts:1583`, `graphCompiler.test.ts:609` | reviewed; F-016 |
| `take_screenshot` | `config.output_name` | `string \| null` | optional output key | default `screenshot_path` | output input in `ActionConfigCaptureFields.tsx:53` | not required or name-validated | preserved | `runner.ts:804` writes artifact path only when output name is set | help lists output name | `runner.test.ts:1583`, `batch-evidence.e2e.ts:49` | reviewed |
| `take_screenshot` | `config.full_page` | `boolean` | required screenshot mode | default false | select in `ActionConfigCaptureFields.tsx:64` | no explicit boolean validation beyond TypeScript | preserved | `runner.ts:797` passes `fullPage` to screenshot | help/test option labels exist | `workflowStepForm.test.ts:282`, `stepHelpContent.test.ts:293` | reviewed |
| dialog actions | `accept_dialog.config.prompt_text` | `string \| null` | optional prompt response | default null | prompt input in `ActionConfigBrowserFields.tsx:80` | no validation needed | preserved | `runner.ts:841` registers accept handler with optional prompt text | help lists prompt text | `keyboard-dialog.e2e.ts`, `runner.test.ts:1818` | reviewed |
| dialog actions | `dismiss_dialog.config` | `Record<string, never>` | no configurable fields | empty object default | no fields rendered | no validation needed | preserved | `runner.ts:844` registers dismiss handler | help marks no fields | `keyboard-dialog.e2e.ts`, `runner.test.ts:1821` | reviewed |
| `wait_for_download` | `config.output_name` | `string` | required output key/fallback artifact name | default `download_path` | output name input in reliability/download fields | `graphCompiler.ts:822` through `graphCompiler.ts:825` requires nonblank output name | preserved | `runner.ts:851` stores relative artifact path into output | help lists output name | `capture-network.e2e.ts:98`, `runner.test.ts:1850` | reviewed |
| `wait_for_download` | `config.timeout_ms` | `number \| null` | optional download wait timeout | omitted from default | timeout input exists in workflow step form/reliability fields | `graphCompiler.ts:825` validates positive value when present | preserved | `runner.ts:1303` passes timeout to `page.waitForEvent("download")` | help lists timeout | `workflowStepForm.test.ts:362`, `runner.test.ts:1850` | reviewed |
| `use_profile` | `config.name` | `string` | launch-time profile selector | default `default` | hidden from primary authoring by capability registry; compatibility field exists in session fields | graph validation blocks launch-time action nodes before field validation; action validation requires nonblank name | preserved for legacy import/load | runner rejects in-run execution through unsupported guard before dispatch | launch-time help directs users to Workflow Settings | launch-time guard coverage gap in F-003 | reviewed; F-003 |
| `save_session` / `load_session` | `config.path` | `string` | compatibility session path | default empty string | hidden compatibility session field exists | graph validation requires nonblank path if action is validated directly | preserved for legacy import/load | runner rejects in-run execution through unsupported guard before dispatch | help/docs classify session lifecycle under Workflow Settings | launch-time/compat guard coverage remains partial | reviewed; F-003 |
| `set_secret` | `config.name` / `config.value` | `string` | compatibility secret assignment | default `secret` and empty value | compatibility session field exists but primary capability is hidden | direct action validation requires both strings | preserved | runner unsupported guard behavior should be verified before dispatch for hidden action paths | no active authoring docs expected | hidden-action guard coverage is partial | reviewed; coverage gap remains under hidden action expansion |
| `use_proxy` | `config.server` | `string` | launch-time proxy server | default empty string | hidden from primary authoring; compatibility field exists | graph validation blocks launch-time action nodes; direct validation requires server | preserved for legacy workflows | runner rejects in-run execution through unsupported guard before dispatch | help directs users to Workflow Settings proxy fields | `runner.test.ts:1746` covers unsupported runtime for `use_proxy` | reviewed |
| `use_proxy` | `config.username` / `config.password` | `string \| null` | optional launch-time proxy credentials | default null | compatibility field exists with password input | no direct credential shape validation on action because launch-time action is blocked | preserved for legacy workflows; Workflow Settings path has stronger parse/sanitize tests | runner rejects in-run execution through unsupported guard before dispatch | credentials redaction covered by Browser Settings audit | package/evidence redaction tests cover settings path, not action path | reviewed |
| `set_user_agent` | `config.user_agent` | `string` | launch-time browser identity override | default empty string | hidden from primary authoring; compatibility textarea exists | graph validation blocks launch-time action nodes; direct validation requires nonblank user agent | preserved for legacy workflows | runner rejects in-run execution through unsupported guard before dispatch | F-002: Workflow Settings user-agent control missing | `runner.test.ts:1746` covers unsupported runtime for `set_user_agent` | reviewed; F-002 |
| `set_cookie` | `config.name` | `string` | required cookie name | default empty string | `ActionConfigSessionFields.tsx:47` renders Name | `graphCompiler.ts:947` requires nonblank name | preserved | `runner.ts:1026` passes name to `context.addCookies` | help lists Name | `workflowStepForm.test.ts:412`, `browser-context-storage.e2e.ts:75` | reviewed |
| `set_cookie` | `config.value` | `string` | required cookie value | default empty string | textarea in `ActionConfigSessionFields.tsx:56` | `graphCompiler.ts:949` requires nonblank value | preserved | `runner.ts:1027` passes value to `context.addCookies` | help lists Value | `workflowStepForm.test.ts:412`, `browser-context-storage.e2e.ts:75` | reviewed |
| `set_cookie` | `config.domain` | `string \| null` | optional domain with UI current-host intent | default null | Domain input placeholder says current host | blank domain allowed | preserved | runner infers current page host when blank and records the resolved domain | help lists Domain only | runner covers blank-domain inference; E2E covers explicit hostname | reviewed; F-018 fixed |
| `set_cookie` | `config.path` | `string \| null` | optional cookie path | default `/` | Path input in session fields | not validated | preserved | runner defaults blank path to `/` | help lists Path | field update test covers domain but not blank path boundary | reviewed |
| `clear_cookies` | `config.domain` | `string \| null` | optional clear filter | default null | Domain input placeholder says blank clears visible cookies | no validation needed | preserved | `runner.ts:1035` calls `context.clearCookies` with optional domain filter | help lists Domain | E2E clears by explicit hostname; broad clear path untested | reviewed |
| `set_viewport` | `config.width` / `config.height` | `number` | required viewport dimensions | default `1280x720` | numeric inputs in `ActionConfigSessionFields.tsx` | validates positive values | preserved | calls `page.setViewportSize` | help lists Width and Height | runner and E2E assert width/height | reviewed |
| `set_viewport` | `config.device_scale_factor` | `number \| null` | legacy compatibility launch-time device shape | default `1` | hidden from active Set Viewport editor | positive values accepted only when default `1`; non-default values fail graph validation | preserved for saved JSON compatibility | non-default value fails before viewport resize | help no longer lists this field for Set Viewport | `runner.test.ts`, `graphCompiler.test.ts`, `ActionConfigEditor.test.tsx`, `stepHelpContent.test.ts` | reviewed; F-007 fixed |
| `set_viewport` | `config.mobile` / `config.touch` | `boolean` | legacy compatibility launch-time device shape flags | default false | hidden from active Set Viewport editor | `true` values fail graph validation | preserved for saved JSON compatibility | `true` values fail before viewport resize | help no longer lists these fields for Set Viewport | `runner.test.ts`, `graphCompiler.test.ts`, `ActionConfigEditor.test.tsx`, `stepHelpContent.test.ts` | reviewed; F-007 fixed |
| `set_geolocation` | `config.latitude` / `config.longitude` | `number` | required coordinates | default `0,0` | numeric inputs in `ActionConfigSessionFields.tsx:240` through `ActionConfigSessionFields.tsx:260` | latitude/longitude validators enforce valid ranges | preserved | `runner.ts:1004` passes config to `context.setGeolocation` | help lists geolocation fields | runner and E2E cover page-visible coordinates | reviewed |
| `set_geolocation` | `config.accuracy` | `number \| null` | optional coordinate accuracy | default `100` | numeric input in `ActionConfigSessionFields.tsx:262` | `graphCompiler.ts:972` validates nonnegative when present | preserved | passed through with geolocation config | help lists Accuracy | runner test records accuracy; E2E rounds lat/long only | reviewed |
| `set_extra_headers` | `config.headers[]` | `HeaderPair[]` | required header list | default one sample header | multiline header editor in `ActionConfigSessionFields.tsx:276` | `graphCompiler.ts:974` validates header pairs | preserved | `runner.ts:1008` converts pairs to object for extra HTTP headers | help lists Headers | runner/E2E cover one valid header | reviewed |
| `set_extra_headers` | `headers[].name` / `headers[].value` | `string` | required header pair fields | parsed from `Name: value` lines | textarea parser in `workflowStepForm.ts:393` | header-pair validation rejects blank names | preserved | runner uses `Object.fromEntries`; duplicate names collapse to last value | help describes header lines | update/validation tests cover valid and blank-name cases; duplicate behavior untested | reviewed |
| `grant_permission` | `config.origin` | `string \| null` | optional origin scope | default null | Origin input placeholder says current origin | no validation requires origin or URL shape | preserved | `runner.ts:1017` passes `undefined` when blank; current origin is not inferred | help lists Origin | E2E always supplies explicit origin | reviewed; UI/runtime semantics gap remains |
| `grant_permission` | `config.permissions[]` | `string[]` | required permission names | default `geolocation` | multiline permissions editor | `graphCompiler.ts:977` requires nonempty list | preserved | `runner.ts:1017` passes list to `context.grantPermissions` | help lists Permissions | runner/E2E cover geolocation | reviewed |
| `execute_js` | `config.script` | `string` | required JavaScript body | default `return document.title;` | textarea in `ActionConfigReliabilityFields.tsx:181` | `graphCompiler.ts:1012` requires nonblank script | preserved | `runner.ts:1063` wraps and executes script with `page.evaluate` | docs describe return/output semantics | runner/E2E cover output happy path and strict-humanized block | reviewed |
| `execute_js` | `config.output_name` | `string \| null` | optional output key | default `js_result` | output input in reliability fields | not name-validated; blank becomes null | preserved | runner stores result only when output name is set | help lists Output name | workflow form and E2E cover output result | reviewed |
| `execute_js` | `config.timeout_ms` | `number \| null` | optional execution timeout | omitted from default but UI shows `1000` fallback | timeout input in Execute JS fields | validates positive value when present | preserved | runner wraps page evaluation in a per-action timeout | help lists Timeout ms through shared advanced fields | runner covers timeout failure and normal output storage | reviewed; F-019 fixed |
| `wait_for_request` | `config.url_contains` | `string` | required URL substring | default `/api/` | `NetworkWaitFields.tsx:17` | `graphCompiler.ts:1018` requires nonblank value | preserved | `runner.ts:1075` uses request URL substring predicate | help lists URL contains | E2E asserts captured URL contains expected value | reviewed |
| `wait_for_request` | `config.timeout_ms` | `number \| null` | optional network wait timeout | omitted from default but UI shows `5000` fallback | timeout input in `NetworkWaitFields.tsx:40` | `graphCompiler.ts:1019` validates positive value when present | preserved | `runner.ts:1076` passes timeout to `waitForRequest` | help lists Timeout ms | happy-path E2E omits timeout; boundary validation covered generically | reviewed |
| `wait_for_response` | `config.url_contains` | `string` | required URL substring | default `/api/` | `NetworkWaitFields.tsx:17` | `graphCompiler.ts:1023` requires nonblank value | preserved | `runner.ts:1083` uses response URL substring predicate | help lists URL contains | E2E asserts captured URL contains expected value | reviewed |
| `wait_for_response` | `config.status` | `number \| null` | optional HTTP status filter | default `200` | status input in `NetworkWaitFields.tsx:26` | `graphCompiler.ts:1024` requires 100-599 when present | preserved | `runner.ts:1084` requires matching status when set | help lists Status | graph compiler invalid-status test and E2E happy path exist | reviewed |
| `wait_for_response` | `config.timeout_ms` | `number \| null` | optional network wait timeout | omitted from default but UI shows `5000` fallback | timeout input in `NetworkWaitFields.tsx:40` | `graphCompiler.ts:1025` validates positive value when present | preserved | `runner.ts:1085` passes timeout to `waitForResponse` | help lists Timeout ms | happy-path E2E omits timeout; boundary validation covered generically | reviewed |
| `block_request` | `config.url_patterns[]` | `string[]` | required Playwright route patterns | default `analytics` | multiline editor in reliability fields | `graphCompiler.ts:1028` requires nonempty list | preserved | `runner.ts:1090` registers each pattern as a route to abort | help says matching requests are blocked | E2E uses a full URL pattern; substring/default pattern behavior not covered | reviewed |
| `mock_response` | `config.url_contains` | `string` | required URL substring by contract/help | default `/api/mock` | URL contains input in reliability fields | `graphCompiler.ts:1031` requires nonblank value | preserved | runner registers a URL predicate and fulfills only when `url.includes(config.url_contains)` | help says mock matching response by URL contains | `runner.test.ts` covers substring against a full URL; E2E covers full fixture URL path | reviewed; F-008 fixed |
| `mock_response` | `config.status` | `number` | required response status | default `200` | status input in reliability fields | `graphCompiler.ts:1032` validates 100-599 | preserved | passed to `route.fulfill` | help lists Status | graph compiler invalid-status and E2E happy path exist | reviewed |
| `mock_response` | `config.body` | `string` | required response body by TS/default | default `{}` | body textarea in reliability fields | not validated for nonblank or JSON shape | preserved | passed as raw fulfill body | help lists Body | E2E checks raw text body | reviewed |
| `mock_response` | `config.content_type` | `string \| null` | optional response content type | default `application/json` | content type input in reliability fields | not MIME-validated | preserved | defaults to `text/plain` at runtime when blank | help lists Content type | E2E covers explicit `text/plain`; blank-default runtime mismatch untested | reviewed |
| storage actions | `config.key` | `string` | required storage key | default `key` | key input in reliability fields | `graphCompiler.ts:1034` requires nonblank key | preserved | `runner.ts:1104` and `runner.ts:1108` write web storage and output by key | help lists Key | graph compiler invalid-key and E2E happy paths exist | reviewed |
| storage actions | `config.value` | `string` | required storage value | default `value` | value textarea in reliability fields | not required; empty value allowed | preserved | `setWebStorage` writes raw string value | help lists Value | E2E covers nonempty local/session values | reviewed |
| `repeat_times` | `config.times` / `steps[]` | positive number plus nested actions | required loop count/body | default 3 and empty body | graph inspector loop fields and body port authoring | positive times and nested array validation | compiled from graph loop body | `runner.ts:890` through `runner.ts:894` iterates body and honors break | graph help documents loop body | control-flow E2E and runner tests cover happy path | reviewed |
| `repeat_for_each` | `item_name`, `array_variable`, `items[]`, `steps[]` | loop item name plus array/manual source | required item name and source | graph defaults item/manual values | graph inspector exposes list/variable source | compiler requires item name, items when no array variable, and nested body | compiled from loop body port | `runner.ts:896` through `runner.ts:905` iterates array source and writes item variable | graph help documents manual/variable modes | control-flow E2E and graph compiler tests cover both compile/runtime paths | reviewed |
| `retry_block` | `max_attempts`, `delay_ms`, `steps[]`, `failed_steps[]` | retry count/delay/body/recovery | required try body, optional failed path | defaults max attempts 3, delay 100 | hidden from primary logic palette; compatibility graph/editor paths exist | positive attempts, nonnegative delay, nested arrays validated | graph compiler maps retry try/failed ports | `runner.ts:908` through `runner.ts:910` calls shared retry executor | graph help documents retry branches | F-006: recovery behavior coverage overstated | reviewed; F-006 |
| `while_loop` / `repeat_until` | `condition`, `max_attempts`, `timeout_ms`, body arrays | condition plus loop limits and nested bodies | condition/body required; limits optional | graph defaults condition and safety limits | graph inspector exposes condition/limits | `graphCompiler.ts:891` through `graphCompiler.ts:902` validates condition, limits, nested arrays | graph ports compile body/timeout paths | `runner.ts:917` through `runner.ts:940` executes predicate loops and timeout steps | graph help documents limits and timeout path | condition validation F-013; timeout path covered by runner test | reviewed; F-013 |
| `try_catch` / `fallback_block` | branch arrays | required primary/try and optional recovery branches | defaults empty arrays | hidden compatibility graph nodes; branch ports author nested paths | nested arrays validated | graph compiler maps recovery branch ports | `runner.ts:942` through `runner.ts:959` executes recovery semantics | graph help documents recovery | F-006: recovery behavior coverage overstated | reviewed; F-006 |
| loop-control actions | `break_loop.config`, `continue_loop.config` | empty object | control-only | empty object | no fields rendered | no validation needed | compiled from loop-control graph nodes | `runner.ts:961` through `runner.ts:964` throws scoped loop-control | graph help documents loop control | loop-control context tests exist | reviewed |
| `stop_workflow` | `status`, `reason`, `close_browser` | status enum, optional reason, close flag | required status, optional browser close override | default success/reason null/close false | end palette/logic fields expose status/reason/close | compiler validates status only | graph terminal/stop nodes compile stop config | `runner.ts:965` through `runner.ts:970` raises `RunnerStop` with status/reason/close flag | graph/action help lists fields | control-flow E2E covers stop status; close-browser override covered in runner lifecycle tests | reviewed |
| `transform_variable` | `source_name`, `target_name`, `expression` | required names and expression | compatibility output transform | default source/target/expression in action defaults | hidden compatibility graph inspector path exists | validates source and target only; expression may be empty | preserved/compiled from graph node | `runner.ts:971` through `runner.ts:973` renders expression to target output and does not read `source_name` directly | graph help describes output transform | F-005: coverage matrix overstates transform behavior coverage | reviewed; F-005 |
| `assert_output` | `name`, `match_mode`, `value` | output name, match enum, expected value | compatibility output assertion | default output/value/contains | hidden compatibility graph inspector path exists | name/value required; match enum validated | preserved/compiled from graph node | runner rejects malformed match mode before checking equals/contains | graph help documents Match | F-005 remains for compile-path coverage; graph/runner invalid-enum tests cover malformed match mode | reviewed; F-005; F-023 fixed |
| `domain_allowlist` | `domains[]` | required domain array | runtime safety policy | default empty array | hidden compatibility graph inspector/domain fields exist | compiler requires nonempty string list | graph compiler promotes graph nodes into run-scope policy and preserves runtime assertion node | `runner.ts:987` through `runner.ts:995` checks current page hostname against allowlist | docs describe run-scope navigation policy | E2E covers navigation policy; runtime assertion boundary less broad | reviewed |
| `detect_challenge` | `output_name`, `patterns[]`, `timeout_ms` | planned-hidden challenge detector fields | planned hidden | default output and patterns | reliability field editor exists but primary authoring hidden | validates output, patterns, positive timeout when directly validated | preserved for compatibility import | runner unsupported guard rejects planned-hidden action before dispatch | help identifies planned challenge detection | F-004: per-action unsupported guard coverage partial | reviewed; F-004 |
| `pause_for_human` | `reason`, `timeout_ms` | planned-hidden human pause fields | planned hidden | default reason, timeout null | reliability field editor exists but primary authoring hidden | validates reason and positive timeout when present | preserved for compatibility import | runner unsupported guard rejects planned-hidden action before dispatch | help says manual checkpoint only | F-004: per-action unsupported guard coverage partial | reviewed; F-004 |
| `resume_when_condition` | `condition`, `timeout_ms` | compatibility resume condition | compatibility hidden | default text-visible condition, 60000 ms | reliability field editor exposes only timeout; condition editing not exposed | validates condition and timeout | preserved | `runner.ts:1436` through `runner.ts:1449` polls until condition or timeout | help documents resume condition | runner tests cover polling timeout/pass; condition UI depth remains limited | reviewed |
| `fallback_selector` | `output_name`, `xpaths[]`, `timeout_ms` | planned-hidden selector fallback fields | planned hidden | default output and XPath list | reliability field editor exposes output/xpaths/timeout | validates output, nonempty XPath list, positive timeout | preserved | runner currently writes first XPath to output instead of probing DOM; action is planned/hidden | help describes first matching selector | F-004 planned hidden guard coverage partial | reviewed; F-004 |
| `retry_step` | `max_attempts`, `delay_ms`, `step` | planned-hidden single-step retry | planned hidden | default attempts/delay/wait step | reliability field editor exposes attempts/delay, not nested step editor | validates attempts, delay, and nested action value | preserved | runner can execute retry on nested step, but capability class hides/plans it | help describes one-step retry | F-004 planned hidden guard coverage partial | reviewed; F-004 |
| `checkpoint` | `name`, `screenshot_path` | planned-hidden checkpoint fields | planned hidden | default name and null screenshot | reliability field editor exposes both | validates name and safe screenshot artifact name | preserved | runner unsupported guard rejects planned-hidden action before dispatch | help documents optional screenshot | runner unsupported table covers checkpoint; screenshot path help parallels F-016 risk | reviewed; F-004 |
| `run_subworkflow` | `config.workflow_id` | `string` | required subworkflow reference | default empty string | graph inspector/default config path exists; primary action authoring hidden by compatibility capability | `graphCompiler.ts:933` requires nonblank workflow id | graph node compiler emits required id in `graphCompiler.ts:435` | blocked before runner dispatch by `unsupportedInRunReason` in `actionCapabilities.ts:126` | graph/action help describes subworkflow placeholder | runner unsupported table covers action; compile shape coverage gap in F-005 | reviewed; F-005 |
| `run_subworkflow` | `config.input_mapping[]` | `Array<{ source: string; target: string }>` | required array, may be empty | default empty array | graph inspector config path exists; hidden compatibility action has no full nested editor | `graphCompiler.ts:1203` validates array and nonblank source/target | graph compiler normalizes via `variableMappings` in `graphCompiler.ts:1715` | not consumed because `run_subworkflow` is explicitly unsupported at runtime | help lists input mapping concept | compile behavior coverage gap in F-005 | reviewed; F-005 |
| `run_subworkflow` | `input_mapping[].source` | `string` | required parent output/input source | no default row | mapping UI coverage not verified | `graphCompiler.ts:1206` requires nonblank source | preserved | not consumed until subworkflow lifecycle exists | help lists input mapping | missing compiler test under F-005 | reviewed; F-005 |
| `run_subworkflow` | `input_mapping[].target` | `string` | required child variable target | no default row | mapping UI coverage not verified | `graphCompiler.ts:1209` requires nonblank target | preserved | not consumed until subworkflow lifecycle exists | help lists input mapping | missing compiler test under F-005 | reviewed; F-005 |
| `run_subworkflow` | `config.output_mapping[]` | `Array<{ source: string; target: string }>` | required array, may be empty | default empty array | graph inspector config path exists; hidden compatibility action has no full nested editor | `graphCompiler.ts:1203` validates array and nonblank source/target | graph compiler normalizes via `variableMappings` in `graphCompiler.ts:1715` | not consumed because `run_subworkflow` is explicitly unsupported at runtime | help lists output mapping concept | compile behavior coverage gap in F-005 | reviewed; F-005 |
| `run_subworkflow` | `output_mapping[].source` | `string` | required child output source | no default row | mapping UI coverage not verified | `graphCompiler.ts:1206` requires nonblank source | preserved | not consumed until subworkflow lifecycle exists | help lists output mapping | missing compiler test under F-005 | reviewed; F-005 |
| `run_subworkflow` | `output_mapping[].target` | `string` | required parent output target | no default row | mapping UI coverage not verified | `graphCompiler.ts:1209` requires nonblank target | preserved | not consumed until subworkflow lifecycle exists | help lists output mapping | missing compiler test under F-005 | reviewed; F-005 |
| graph ports | `start.out` | output port | required graph entry | `nodePorts("start")` returns `out` | rendered in graph editor via node port data | backend expected ports require `out` source direction | `compileWorkflowGraph` starts at next target from `start.out` | progress-only, no runner action | graph help covers start semantics | graph editor/compiler tests use start port | reviewed |
| graph ports | `end_success.in`, `end_failure.in` | input ports | terminal inputs | `nodePorts` returns `in` | rendered as terminal nodes | backend expected ports require only input | compiler emits terminal stop configs when reached | runner executes stop/success/failure semantics | graph help covers terminal nodes | graph/compiler E2E coverage exists | reviewed |
| graph ports | default action-like `in/out` | input plus output | required linear continuation | default `nodePorts` returns `in`, `out` for action/variables/compat utility nodes | rendered in graph editor | backend expected ports use default `in/out` | compiler follows `out` continuation after step emission | runner executes action then progress continuation | graph help covers standard action flow | graphCompiler and editor tests cover action dispatch | reviewed |
| graph ports | `if.true`, `if.false`, `if.done` | branch outputs plus continuation | true/false optional branches, done continuation optional | `nodePorts("if")` returns true/false/done | rendered in graph editor | compiler warns missing true/false/done in `graphCompiler.ts:522` through `graphCompiler.ts:527` | true/false compile into nested branch arrays; done compiles top-level continuation | runner executes only matched branch, then compiled top-level done continuation | graph help documents branch no-op semantics | `graphCompiler.test.ts:62`, `control-flow.e2e.ts` | reviewed |
| graph ports | `switch.case_N`, `switch.default`, `switch.done` | dynamic branch outputs plus continuation | case/default optional branches, done optional continuation | frontend default has `case_1`; backend expected ports derive case count | rendered/updated through graph config/editor | backend validates stale case ports and default/done warnings | cases compile into `cases[].steps`; done is top-level continuation | runner executes matched case or default | graph help documents switch ports | switch compiler tests cover dynamic case ports | reviewed |
| graph ports | loop `loop/done` | body output plus continuation | loop body required, done optional continuation | repeat/while node ports use `loop`/`done` | rendered in graph editor | `requireBodyPort` enforces loop body; done warning exists | body compiles into nested `steps`; done compiles continuation | runner loop-control context handles body and continuation | graph help documents loop body/done | `graphCompiler.test.ts:33`, `runner.test.ts:1005`, `control-flow.e2e.ts` | reviewed |
| graph ports | `repeat_until.timeout` | optional timeout branch | timeout branch optional | `nodePorts("repeat_until")` includes timeout | rendered in graph editor | warning if missing timeout branch | compiles into `timeout_steps` | runner executes timeout steps after max/timeout when condition still false | graph help documents timeout path | `runner.test.ts:1074` covers timeout steps | reviewed |
| graph ports | `retry.try`, `retry.failed`, `retry.success` | required try body, optional failed branch, success continuation | try required, failed/success optional with warnings | `nodePorts("retry")` includes try/success/failed | rendered in graph editor | try required; failed/success warnings in graph compiler | try/failed compile into nested arrays; success is top-level continuation | runner retries try steps and executes failed steps after exhaustion | graph help documents retry branches | coverage gaps for deeper retry failure semantics tracked in F-006 | reviewed; F-006 |
| graph ports | `try_catch.try`, `success`, `error`, `finally`, `done` | required try, optional success/error/finally/done paths | try required, others warned or optional | `nodePorts("try_catch")` includes all ports | rendered in graph editor | try required; success/error/done warnings exist | branch ports compile into nested arrays; done is continuation | runner executes try/success/error/finally semantics | graph help documents recovery ports | recovery behavior coverage overstated in F-006 | reviewed; F-006 |
| graph ports | `fallback.primary`, `fallback.fallback`, `fallback.done` | required primary, optional fallback/done | primary required, fallback/done warned | `nodePorts("fallback")` includes primary/fallback/done | rendered in graph editor | primary required; fallback/done warnings exist | branches compile into nested arrays; done continuation | runner executes fallback only on primary failure | graph help documents fallback paths | recovery behavior coverage overstated in F-006 | reviewed; F-006 |
| graph ports | loop-control/terminal-only `in` | input-only | no continuation | `nodePorts` returns only `in` for break/continue/stop and terminal ends | rendered in graph editor | backend treats these as terminal node types for path traversal | compiler emits stop/control actions and does not follow continuation | runner throws scoped loop-control or stop signal | graph help covers control nodes | loop-control context tests exist | reviewed |

Reviewed recursion targets in the field matrix above:

- `ElementTarget.locators[]`, `constraints`, and nested `iframe`.
- `WorkflowCondition` variants and nested `ElementTarget`.
- `CompiledNestedAction[]` under branch, loop, retry, try/catch, fallback, and graph port bodies.
- `set_variable.variables[]` and typed value parsing.
- Browser context/session actions, advanced runtime/network actions, and storage actions.
- `run_subworkflow.input_mapping[]` and `output_mapping[]`.
- `switch_condition.cases[]` and case body paths.
- Graph ports for every `GraphNodeType`.
- Planned/reliability compatibility action configs: `detect_challenge`, `pause_for_human`, `resume_when_condition`, `fallback_selector`, `retry_step`, `checkpoint`, `transform_variable`, `assert_output`, `domain_allowlist`, and stop/loop-control configs.

## Reviewed Evidence - Launch-Time Browser Identity Actions - 2026-05-15

Reviewed actions:

- `set_download_directory`
- `use_profile`
- `use_proxy`
- `set_user_agent`

Evidence:

- Capability registry classifies these four actions as `launch_time_only` in `src/lib/actionCapabilities.ts:83`.
- Primary palette visibility test asserts these actions are hidden from primary authoring in `src/lib/actionCapabilities.test.ts:13`.
- `workflowUi.ts` builds visible `actionGroups` by filtering `actionGroupCatalog` through `isActionVisibleInPrimaryPalette` in `src/lib/workflowUi.ts:217`.
- Graph validation blocks launch-time actions generically in `electron/backend/graphCompiler.ts:506`.
- `electron/backend/graphCompiler.test.ts:220` tests the compiler guard with `use_proxy`.
- Runner rejects unsupported launch-time actions before dispatch in `electron/backend/runner.ts:556`.
- `electron/backend/runner.test.ts:1746` tests in-run unsupported errors for `use_proxy`, `set_user_agent`, and `set_download_directory`.

Confirmed gaps:

- F-002: `set_user_agent` directs operators to Workflow Settings, but `browser_launch.user_agent` is not editable in the Workflow Settings UI.
- F-003: launch-time guard tests do not explicitly cover every launch-time action; `use_profile` is missing runner guard coverage and only `use_proxy` is covered at graph-validation level.

## Reviewed Evidence - Planned Hidden And Resume Compatibility Actions - 2026-05-15

Reviewed actions:

- `switch_frame`
- `save_session`
- `load_session`
- `set_secret`
- `detect_challenge`
- `pause_for_human`
- `fallback_selector`
- `retry_step`
- `checkpoint`
- `resume_when_condition`

Evidence:

- Capability registry marks `switch_frame`, session/secret, challenge, fallback selector, retry step, and checkpoint actions as `planned_hidden` in `src/lib/actionCapabilities.ts:52`, `src/lib/actionCapabilities.ts:78`, and `src/lib/actionCapabilities.ts:89`.
- `unsupportedInRunReason` rejects all `planned_hidden` actions before runner dispatch in `src/lib/actionCapabilities.ts:115` and `electron/backend/runner.ts:556`.
- Runner has unreachable legacy/stub branches for these action types after the unsupported guard in `electron/backend/runner.ts:839`, `electron/backend/runner.ts:1041`, and `electron/backend/runner.ts:1048`.
- The unsupported runner test covers only `detect_challenge`, `pause_for_human`, and `checkpoint` from this group in `electron/backend/runner.test.ts:1746`.
- Coverage matrix claims runner unsupported coverage for additional planned actions in `tests/e2e/support/coverageMatrix.ts:119`.
- `resume_when_condition` is `compatibility_hidden`, not planned; it has actual runner semantics in `electron/backend/runner.ts:1054` and pass/fail runner coverage in `electron/backend/runner.test.ts:1348`.

Confirmed gaps:

- F-004: planned-hidden coverage matrix overstates unsupported runner test coverage for `switch_frame`, `save_session`, `load_session`, `set_secret`, `fallback_selector`, and `retry_step`.

## Reviewed Evidence - Compatibility Output And Domain Actions - 2026-05-15

Reviewed action/node pairs:

- `transform_variable`
- `assert_output`
- `run_subworkflow`
- `domain_allowlist`

Evidence:

- Compiler emits config for these graph nodes in `electron/backend/graphCompiler.ts:413`, `electron/backend/graphCompiler.ts:424`, `electron/backend/graphCompiler.ts:435`, and `electron/backend/graphCompiler.ts:446`.
- Compiler validates required config fields in `electron/backend/graphCompiler.ts:612`, `electron/backend/graphCompiler.ts:616`, `electron/backend/graphCompiler.ts:620`, and `electron/backend/graphCompiler.ts:630`.
- These graph nodes continue through `out` ports according to `mainContinuationPort` in `electron/backend/graphCompiler.ts:1497`.
- Runner implements `transform_variable` and `assert_output` behavior in `electron/backend/runner.ts:971`.
- `run_subworkflow` is explicitly rejected before dispatch through `unsupportedInRunReason` in `src/lib/actionCapabilities.ts:126` and runner guard in `electron/backend/runner.ts:556`; the later switch branch is unreachable.
- Runner enforces current-domain `domain_allowlist` in `electron/backend/runner.ts:987` and pre-navigation domain policy in `electron/backend/runner.ts:1251`.
- Runner tests cover `run_subworkflow` unsupported behavior in `electron/backend/runner.test.ts:1746`.
- Runner tests cover `domain_allowlist` pass/fail and navigation preflight policy in `electron/backend/runner.test.ts:1412`.
- Compiler tests cover promoted `domain_policy` and run-from-selected upstream policy in `electron/backend/graphCompiler.test.ts:494`.
- Desktop E2E covers navigation blocked by a graph domain allowlist in `tests/e2e/run-validation-and-stop.e2e.ts:27`.

Confirmed gaps:

- F-005: coverage matrix claims backend runner/compiler behavior coverage for `transform_variable`, `assert_output`, and `run_subworkflow`, but direct test search only found source implementation and coverage registry entries, not behavior/compiler assertions for the first two or compiler assertions for `run_subworkflow`.

## Reviewed Evidence - Graph Control Flow Actions And Nodes - 2026-05-15

Reviewed action/node pairs:

- `if_condition` / `if`
- `switch_condition` / `switch`
- `repeat_times`
- `repeat_for_each`
- `while_loop` / `while`
- `repeat_until`
- `retry_block` / `retry`
- `try_catch`
- `fallback_block` / `fallback`
- `break_loop`
- `continue_loop`
- `stop_workflow`, `end_success`, and `end_failure`

Evidence:

- Compiler emits control-flow action configs from graph-native nodes in `electron/backend/graphCompiler.ts:246`, `electron/backend/graphCompiler.ts:268`, `electron/backend/graphCompiler.ts:282`, `electron/backend/graphCompiler.ts:295`, `electron/backend/graphCompiler.ts:306`, `electron/backend/graphCompiler.ts:324`, `electron/backend/graphCompiler.ts:335`, `electron/backend/graphCompiler.ts:351`, `electron/backend/graphCompiler.ts:362`, `electron/backend/graphCompiler.ts:375`, `electron/backend/graphCompiler.ts:386`, and `electron/backend/graphCompiler.ts:392`.
- Compiler validates structural graph issues and loop-control context in `electron/backend/graphCompiler.test.ts:32`.
- Compiler tests branch, repeat-for-each, retry, and terminal compile shapes in `electron/backend/graphCompiler.test.ts:62`.
- Compiler tests branch body vs done continuation semantics in `electron/backend/graphCompiler.test.ts:316` and `electron/backend/graphCompiler.test.ts:345`.
- Runner implements branch, switch, loop, retry, try/catch, fallback, loop-control, and stop behavior in `electron/backend/runner.ts:882`.
- Runner tests repeat-for-each variable arrays in `electron/backend/runner.test.ts:950`.
- Runner tests break/continue loop behavior in `electron/backend/runner.test.ts:1005`.
- Runner tests condition and repeat-until timeout behavior in `electron/backend/runner.test.ts:1074`.
- Runner tests nested branch progress mapping in `electron/backend/runner.test.ts:1268`.
- E2E covers visible graph variables, branches, loops, retry, and terminal nodes in `tests/e2e/control-flow.e2e.ts:12`, loop controls in `tests/e2e/control-flow.e2e.ts:65`, and terminal failure/stop in `tests/e2e/control-flow.e2e.ts:100`.

Confirmed gaps:

- F-006: `try_catch` and `fallback` matrix entries claim backend runner/compiler semantics coverage, but direct test search did not find behavior assertions for those recovery blocks.

## Reviewed Evidence - Browser Context Runtime Actions - 2026-05-15

Reviewed actions:

- `set_cookie`
- `clear_cookies`
- `set_viewport`
- `set_geolocation`
- `set_extra_headers`
- `grant_permission`

Evidence:

- Config contracts define cookie, viewport, geolocation, headers, and permission fields in `src/types/workflow.ts:727`, `src/types/workflow.ts:730`, `src/types/workflow.ts:738`, `src/types/workflow.ts:748`, `src/types/workflow.ts:751`, and `src/types/workflow.ts:753`.
- Defaults exist in `src/features/workflows/lib/workflowActionDefaults.ts:270`, `src/features/workflows/lib/workflowActionDefaults.ts:272`, `src/features/workflows/lib/workflowActionDefaults.ts:280`, `src/features/workflows/lib/workflowActionDefaults.ts:285`, `src/features/workflows/lib/workflowActionDefaults.ts:287`, and `src/features/workflows/lib/workflowActionDefaults.ts:292`.
- UI fields render in `src/features/workflows/components/ActionConfigSessionFields.tsx:44`, `src/features/workflows/components/ActionConfigSessionFields.tsx:86`, `src/features/workflows/components/ActionConfigSessionFields.tsx:168`, `src/features/workflows/components/ActionConfigSessionFields.tsx:237`, `src/features/workflows/components/ActionConfigSessionFields.tsx:276`, and `src/features/workflows/components/ActionConfigSessionFields.tsx:290`.
- Help fields are listed in `src/features/workflows/lib/stepHelpContent.ts:1015`, `src/features/workflows/lib/stepHelpContent.ts:1017`, `src/features/workflows/lib/stepHelpContent.ts:1025`, `src/features/workflows/lib/stepHelpContent.ts:1027`, `src/features/workflows/lib/stepHelpContent.ts:1029`, and `src/features/workflows/lib/stepHelpContent.ts:1031`.
- Compiler validation covers required cookie values, viewport numeric range, geolocation range, header names, and permission lists in `electron/backend/graphCompiler.ts:946` through `electron/backend/graphCompiler.ts:977`.
- Runner dispatches cookie, viewport, geolocation, headers, and permissions through browser driver APIs in `electron/backend/runner.ts:997` through `electron/backend/runner.ts:1038`.
- Runner unit test covers driver API calls for headers, permissions, cookies, geolocation, and viewport size in `electron/backend/runner.test.ts:1705` through `electron/backend/runner.test.ts:1743`.
- Graph compiler invalid-config table covers invalid viewport, geolocation, headers, and permissions in `electron/backend/graphCompiler.test.ts:627` through `electron/backend/graphCompiler.test.ts:642`.
- Desktop E2E covers viewport width/height, cookie set/clear, extra headers, geolocation permission, and geolocation override in `tests/e2e/browser-context-storage.e2e.ts:12` through `tests/e2e/browser-context-storage.e2e.ts:138`.
- Docs route browser context action coverage through `docs/domain/action-taxonomy.md:25` and `docs/architecture/testing.md:81`.

Confirmed gaps:

- F-007 fixed: active `set_viewport` authoring/help expose only width and height; graph validation and runner execution reject non-default launch-time device-shape fields.

## Reviewed Evidence - Advanced Runtime, Network, And Storage Actions - 2026-05-15

Reviewed actions:

- `execute_js`
- `wait_for_request`
- `wait_for_response`
- `block_request`
- `mock_response`
- `set_local_storage`
- `set_session_storage`

Evidence:

- Config contracts define JavaScript, request/response wait, route block/mock, and web storage fields in `src/types/workflow.ts:781` through `src/types/workflow.ts:807`.
- Defaults exist in `src/features/workflows/lib/workflowActionDefaults.ts:329` through `src/features/workflows/lib/workflowActionDefaults.ts:355`.
- UI fields render in `src/features/workflows/components/ActionConfigReliabilityFields.tsx:178`, `src/features/workflows/components/ActionConfigReliabilityFields.tsx:212`, `src/features/workflows/components/ActionConfigReliabilityFields.tsx:218`, `src/features/workflows/components/ActionConfigReliabilityFields.tsx:230`, and `src/features/workflows/components/ActionConfigReliabilityFields.tsx:274`.
- Help fields are listed in `src/features/workflows/lib/stepHelpContent.ts:1045` through `src/features/workflows/lib/stepHelpContent.ts:1057`.
- Compiler validates required JavaScript, URL/status, route pattern, and storage key fields in `electron/backend/graphCompiler.ts:1011` through `electron/backend/graphCompiler.ts:1036`.
- Runner executes JavaScript, waits for request/response predicates, registers route block/mock handlers, and writes web storage in `electron/backend/runner.ts:1063` through `electron/backend/runner.ts:1110`.
- Runner strict-humanized tests cover `execute_js` blocking as CDP-sensitive in `electron/backend/runner.test.ts:468`.
- Runner unit tests cover local/session storage writes in `electron/backend/runner.test.ts:909`.
- Graph compiler invalid-config table covers `execute_js`, invalid response status, block pattern, and storage key validation in `electron/backend/graphCompiler.test.ts:647` through `electron/backend/graphCompiler.test.ts:662`.
- Desktop E2E covers `execute_js`, `wait_for_request`, `wait_for_response`, `block_request`, and `mock_response` in `tests/e2e/capture-network.e2e.ts:125` through `tests/e2e/capture-network.e2e.ts:245`.
- Desktop E2E covers local/session storage writes through page-visible state in `tests/e2e/browser-context-storage.e2e.ts:50` through `tests/e2e/browser-context-storage.e2e.ts:69`.

Confirmed gaps:

- F-008 fixed: `mock_response.config.url_contains` now uses contains semantics in the runner, with unit coverage for substring matching against a full URL.

## Reviewed Evidence - Graph Terminals, Action Dispatch, Variables, And Hidden Utility Nodes - 2026-05-15

Reviewed action/node pairs:

- `start`
- `end_success`
- `end_failure`
- `action`
- `set_variable`
- `set_json_variables`
- `manual_approval`
- `rate_limit`

Evidence:

- Graph node contract lists these node types in `src/types/workflow.ts:884` through `src/types/workflow.ts:908`.
- Compiler maps `end_success` and `end_failure` to terminal `stop_workflow` configs in `electron/backend/graphCompiler.ts:246` and `electron/backend/graphCompiler.ts:251`.
- Compiler passes graph `action` node configs through to action dispatch in `electron/backend/graphCompiler.ts:261`.
- Compiler maps `set_variable` and `set_json_variables` graph nodes to action configs in `electron/backend/graphCompiler.ts:402` and `electron/backend/graphCompiler.ts:406`.
- Compiler maps `manual_approval` to `pause_for_human` and `rate_limit` to duration `wait` in `electron/backend/graphCompiler.ts:453` and `electron/backend/graphCompiler.ts:463`.
- Compiler treats `start`, `action`, variable nodes, `manual_approval`, and `rate_limit` as `out` continuation nodes in `electron/backend/graphCompiler.ts:1497`.
- Runner implements variable writes and JSON flattening in `electron/backend/runner.ts:856` through `electron/backend/runner.ts:864`.
- Runner variable parsing writes typed values through `setVariables` in `electron/backend/runner.ts:2173`.
- Desktop E2E covers `start`, variable graph nodes, action dispatch through nested `action` nodes, and `end_success` in `tests/e2e/control-flow.e2e.ts:12` through `tests/e2e/control-flow.e2e.ts:63`.
- Desktop E2E covers `end_failure` terminal behavior in `tests/e2e/control-flow.e2e.ts:100` through `tests/e2e/control-flow.e2e.ts:125`.
- Graph compiler unit tests cover `start`, `action`, `set_variable`, and terminal graph compile shapes in `electron/backend/graphCompiler.test.ts:62` through `electron/backend/graphCompiler.test.ts:150`.
- Frontend graph tests verify hidden utility nodes are not in the simplified logic palette in `src/features/workflows/components/WorkflowGraphEditor.test.tsx:1046`.
- Port tests verify `manual_approval` has `in` and `out` ports in `src/features/workflows/lib/workflowGraph.test.ts:123`.

Confirmed gaps:

- F-009: coverage matrix claims `manual_approval` and `rate_limit` have graph compiler tests, but direct search found no compiler assertions for their emitted `pause_for_human` and `wait` configs.

## Reviewed Evidence - Navigation And Wait Actions - 2026-05-15

Reviewed actions:

- `navigate`
- `wait`
- `random_wait`
- `go_back`
- `go_forward`
- `reload`
- `open_new_tab`
- `switch_tab`
- `close_tab`

Evidence:

- Config contracts define navigation, wait, random wait, and tab/history fields in `src/types/workflow.ts:307` through `src/types/workflow.ts:341` and `src/types/workflow.ts:581` through `src/types/workflow.ts:586`.
- Public defaults for `navigate`, `wait`, and `random_wait` are in `src/features/workflows/lib/workflowActionDefaults.ts:5` through `src/features/workflows/lib/workflowActionDefaults.ts:19`; tab defaults are covered by the browser-context default cases in the same file.
- Simplified public defaults intentionally omit advanced `wait_until`, `timeout_ms`, and related timing fields via `src/features/workflows/lib/workflowActionDefaults.test.ts:6` through `src/features/workflows/lib/workflowActionDefaults.test.ts:34`.
- UI fields render in `src/features/workflows/components/ActionConfigCoreFields.tsx:22`, `src/features/workflows/components/ActionConfigCoreFields.tsx:36`, `src/features/workflows/components/ActionConfigCoreFields.tsx:101`, and `src/features/workflows/components/ActionConfigBrowserFields.tsx:18` through `src/features/workflows/components/ActionConfigBrowserFields.tsx:62`.
- Help fields for history/tab actions are listed in `src/features/workflows/lib/stepHelpContent.ts:954` through `src/features/workflows/lib/stepHelpContent.ts:963`.
- Compiler validation covers navigation URL/timeout, wait conditions and required condition fields, and random wait range in `electron/backend/graphCompiler.ts:653` through `electron/backend/graphCompiler.ts:698`.
- Runner executes navigation, wait, random wait, history, reload, open/switch/close tab behavior in `electron/backend/runner.ts:564` through `electron/backend/runner.ts:581` and `electron/backend/runner.ts:807` through `electron/backend/runner.ts:837`.
- Runner unit tests cover wait cancellation/session close in `electron/backend/runner.test.ts:645`, retained wait reuse in `electron/backend/runner.test.ts:699`, missing switch-tab failure in `electron/backend/runner.test.ts:1518`, and missing close-tab failure in `electron/backend/runner.test.ts:1539`.
- Desktop E2E covers navigate, wait text, random wait timing, URL wait, history back/forward, reload, open tab, switch tab, and close tab in `tests/e2e/core-execution.e2e.ts:5`, `tests/e2e/wait-assertion-actions.e2e.ts:15`, and `tests/e2e/navigation-actions.e2e.ts:5`.

Confirmed gaps:

- None recorded for this batch. Field-level recursion still needs the global field matrix pass before the audit can be closed.

## Reviewed Evidence - Capture, Download, And Dialog Actions - 2026-05-15

Reviewed actions:

- `extract_text`
- `extract_attribute`
- `extract_input_value`
- `extract_table`
- `extract_list`
- `take_screenshot`
- `accept_dialog`
- `dismiss_dialog`
- `wait_for_download`

Evidence:

- Config contracts define capture, screenshot, dialog, and download fields in `src/types/workflow.ts:552` through `src/types/workflow.ts:593`.
- Defaults exist in `src/features/workflows/lib/workflowActionDefaults.ts:131` through `src/features/workflows/lib/workflowActionDefaults.ts:171`.
- UI fields render in `src/features/workflows/components/ActionConfigCaptureFields.tsx:19` through `src/features/workflows/components/ActionConfigCaptureFields.tsx:78` and `src/features/workflows/components/ActionConfigBrowserFields.tsx:80` through `src/features/workflows/components/ActionConfigBrowserFields.tsx:132`.
- Help fields are listed in `src/features/workflows/lib/stepHelpContent.ts:945` through `src/features/workflows/lib/stepHelpContent.ts:970`.
- Compiler validation covers data-capture targets/output names, extract-attribute field, screenshot safe artifact paths, and download output/timeout fields in `electron/backend/graphCompiler.ts:788` through `electron/backend/graphCompiler.ts:825`.
- Runner executes capture actions, writes screenshot evidence, registers dialog handlers, and waits for download evidence in `electron/backend/runner.ts:749` through `electron/backend/runner.ts:805` and `electron/backend/runner.ts:841` through `electron/backend/runner.ts:855`.
- Runner unit tests cover screenshot path rejection and evidence in `electron/backend/runner.test.ts:1566` and `electron/backend/runner.test.ts:1604`.
- Runner unit tests cover dialog handlers and download evidence in `electron/backend/runner.test.ts:1814` and `electron/backend/runner.test.ts:1837`.
- Graph compiler invalid-config table covers extract attribute, screenshot path, and download output validation in `electron/backend/graphCompiler.test.ts:595` through `electron/backend/graphCompiler.test.ts:616`.
- Desktop E2E covers extract text/attribute/input/list/table, screenshot evidence, and download evidence in `tests/e2e/capture-network.e2e.ts:6` through `tests/e2e/capture-network.e2e.ts:123`.
- Desktop E2E covers accept/dismiss dialog behavior in `tests/e2e/keyboard-dialog.e2e.ts:99` through `tests/e2e/keyboard-dialog.e2e.ts:165`.

Confirmed gaps:

- None recorded for this batch. Element target field recursion remains part of the global field matrix pass.

## Reviewed Evidence - Element Interaction, Form, Pointer, Keyboard, And Assertion Actions - 2026-05-15

Reviewed actions:

- `input_text`, `clear_input`, `click`, `scroll`, `select_option`, `set_checkbox`
- `press_key`, `hotkey`, `focus_element`, `blur_element`, `type_sequence`, `set_clipboard`, `paste_clipboard`
- `hover`, `double_click`, `right_click`, `drag_and_drop`
- `check`, `uncheck`, `toggle_checkbox`, `select_radio`
- `upload_file`, `submit_form`, `select_custom_option`, `set_contenteditable`
- `assert_element`, `assert_text`

Evidence:

- Config contracts for these element, form, pointer, keyboard, clipboard, and assertion actions are in `src/types/workflow.ts:344` through `src/types/workflow.ts:547` and `src/types/workflow.ts:606` through `src/types/workflow.ts:624`.
- Defaults are in `src/features/workflows/lib/workflowActionDefaults.ts:20` through `src/features/workflows/lib/workflowActionDefaults.ts:127` and `src/features/workflows/lib/workflowActionDefaults.ts:179` through `src/features/workflows/lib/workflowActionDefaults.ts:189`.
- Compiler validation covers element targets, timing, scroll range, select value, key/hotkey lists, drag source/target, upload files, contenteditable text, and assertion fields in `electron/backend/graphCompiler.ts:699` through `electron/backend/graphCompiler.ts:787` and `electron/backend/graphCompiler.ts:848` through `electron/backend/graphCompiler.ts:858`.
- Runner executes element interaction, pointer, form, keyboard, clipboard, and assertion actions in `electron/backend/runner.ts:584` through `electron/backend/runner.ts:748` and `electron/backend/runner.ts:865` through `electron/backend/runner.ts:879`.
- Desktop E2E covers form actions in `tests/e2e/core-execution.e2e.ts:56` through `tests/e2e/core-execution.e2e.ts:155`.
- Desktop E2E covers upload, custom select, and contenteditable actions in `tests/e2e/extended-form-actions.e2e.ts:5` through `tests/e2e/extended-form-actions.e2e.ts:80`.
- Desktop E2E covers pointer actions and page scroll in `tests/e2e/pointer-actions.e2e.ts:4` through `tests/e2e/pointer-actions.e2e.ts:87`.
- Desktop E2E covers focus, blur, key, hotkey, clipboard, paste, and type sequence in `tests/e2e/keyboard-dialog.e2e.ts:4` through `tests/e2e/keyboard-dialog.e2e.ts:98`.
- Desktop E2E covers visible `assert_element`, passing `assert_text`, and failing `assert_text` in `tests/e2e/wait-assertion-actions.e2e.ts:80` through `tests/e2e/wait-assertion-actions.e2e.ts:168`.
- Runner unit tests cover strict behavior traces for input/click/extract in `electron/backend/runner.test.ts:388`, select-radio strict blocking in `electron/backend/runner.test.ts:540`, scroll page execution in `electron/backend/runner.test.ts:563`, right-click native input in `electron/backend/runner.test.ts:587`, drag-and-drop driver support in `electron/backend/runner.test.ts:1776`, and unsupported driver method failure in `electron/backend/runner.test.ts:1876`.

Confirmed gaps:

- F-010 fixed: `assert_element` exposes five states and runner tests now verify pass/fail behavior for each state.
- F-011: `set_checkbox` compatibility coverage is overstated; direct search found no behavior or migration test asserting saved legacy `set_checkbox` execution.
- ElementTarget nested field recursion remains part of the global field matrix pass.

## Graph Flow Checks

For every graph node, verify:

- Input and output ports match frontend adapters and backend compiler.
- Required body ports vs optional branch/continuation ports are explicit.
- Missing optional branches are no-ops.
- Missing continuation ports end the path successfully.
- Nested compile paths preserve `graph_node_id` and `graph_label`.
- Loop-control nodes are reachable only inside loop bodies.
- Runtime progress maps `current_step_id`, `completed_step_ids`, and failure highlight back to graph nodes.
