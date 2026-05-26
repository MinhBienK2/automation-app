import type { ActionType, GraphNodeType } from "../../../src/types/workflow";

export type CoverageDepth =
  | "desktop_e2e"
  | "desktop_e2e_and_backend"
  | "backend_contract"
  | "backend_guard"
  | "staging_opt_in";

export type CoverageEntry = {
  files: string[];
  depth: CoverageDepth;
  notes?: string;
};

const coreExecution = ["tests/e2e/core-execution.e2e.ts"];
const captureNetwork = ["tests/e2e/capture-network.e2e.ts"];
const keyboardDialog = ["tests/e2e/keyboard-dialog.e2e.ts"];
const pointerActions = ["tests/e2e/pointer-actions.e2e.ts"];
const navigationActions = ["tests/e2e/navigation-actions.e2e.ts"];
const extendedForm = ["tests/e2e/extended-form-actions.e2e.ts"];
const waitAssertion = ["tests/e2e/wait-assertion-actions.e2e.ts"];
const controlFlow = ["tests/e2e/control-flow.e2e.ts"];
const contextStorage = ["tests/e2e/browser-context-storage.e2e.ts"];
const runValidation = ["tests/e2e/run-validation-and-stop.e2e.ts"];
const batchEvidence = ["tests/e2e/batch-evidence.e2e.ts"];
const workflowJourneys = ["tests/e2e/workflow-user-journeys.e2e.ts"];
const workflowPackage = ["tests/e2e/workflow-package.e2e.ts"];
const compilerTests = ["electron/backend/graph/compiler.test.ts"];
const runnerTests = ["electron/backend/runtime/runner.test.ts"];
const graphEditorTests = ["src/features/workflows/components/WorkflowGraphEditor.test.tsx"];

export const actionCoverage = {
  navigate: entry([...coreExecution, ...navigationActions, ...waitAssertion]),
  wait: entry([...coreExecution, ...waitAssertion, ...keyboardDialog]),
  random_wait: entry(waitAssertion),
  input_text: entry(coreExecution),
  clear_input: entry(coreExecution),
  click: entry([...coreExecution, ...pointerActions, ...keyboardDialog]),
  scroll: entry(pointerActions),
  select_option: entry(coreExecution),
  press_key: entry(keyboardDialog),
  hotkey: entry(keyboardDialog),
  hover: entry(pointerActions),
  double_click: entry(pointerActions),
  right_click: entry(pointerActions),
  drag_and_drop: entry(pointerActions),
  focus_element: entry(keyboardDialog),
  blur_element: entry(keyboardDialog),
  type_sequence: entry(keyboardDialog),
  set_clipboard: entry(keyboardDialog),
  paste_clipboard: entry(keyboardDialog),
  check: entry(coreExecution),
  uncheck: entry(coreExecution),
  toggle_checkbox: entry(coreExecution),
  select_radio: entry(coreExecution),
  upload_file: entry(extendedForm),
  submit_form: entry(coreExecution),
  select_custom_option: entry(extendedForm),
  set_contenteditable: entry(extendedForm),
  extract_text: entry([
    ...coreExecution,
    ...captureNetwork,
    ...navigationActions,
    ...pointerActions,
    ...waitAssertion,
  ]),
  extract_attribute: entry(captureNetwork),
  extract_input_value: entry([...coreExecution, ...captureNetwork, ...keyboardDialog]),
  extract_table: entry(captureNetwork),
  extract_list: entry(captureNetwork),
  take_screenshot: entry(captureNetwork),
  go_back: entry(navigationActions),
  go_forward: entry(navigationActions),
  reload: entry(navigationActions),
  open_new_tab: entry(navigationActions),
  switch_tab: entry(navigationActions),
  close_tab: entry(navigationActions),
  accept_dialog: entry(keyboardDialog),
  dismiss_dialog: entry(keyboardDialog),
  wait_for_download: entry(captureNetwork),
  set_variable: entry(controlFlow),
  set_json_variables: entry(controlFlow),
  assert_element: entry(waitAssertion),
  assert_text: entry(waitAssertion),
  set_cookie: entry(contextStorage),
  clear_cookies: entry(contextStorage),
  set_viewport: entry(contextStorage),
  set_geolocation: entry(contextStorage),
  set_extra_headers: entry(contextStorage),
  grant_permission: entry(contextStorage),
  execute_js: entry([...captureNetwork, ...waitAssertion, ...controlFlow, ...contextStorage]),
  wait_for_request: entry(captureNetwork),
  wait_for_response: entry(captureNetwork),
  block_request: entry(captureNetwork),
  mock_response: entry(captureNetwork),
  set_local_storage: entry(contextStorage),
  set_session_storage: entry(contextStorage),
} satisfies Partial<Record<ActionType, CoverageEntry>>;

export const hiddenActionCoverage = {
  graph_noop: graphInternal(controlFlow),
  if_condition: graphInternal(controlFlow),
  router_condition: graphInternal(controlFlow),
  repeat_times: graphInternal(controlFlow),
  repeat_for_each: graphInternal(controlFlow),
  retry_block: graphInternal(controlFlow),
  switch_condition: graphInternal(controlFlow),
  while_loop: graphInternal(controlFlow),
  repeat_until: graphInternal(controlFlow),
  try_catch: backendGuard("hidden graph-internal action; backend runner tests cover semantics"),
  fallback_block: backendGuard("hidden graph-internal action; backend runner tests cover semantics"),
  break_loop: graphInternal(controlFlow),
  continue_loop: graphInternal(controlFlow),
  stop_workflow: graphInternal(controlFlow),
  transform_variable: backendGuard("hidden graph-internal action; backend runner tests cover transformation"),
  assert_output: backendGuard("hidden graph-internal action; backend runner tests cover output assertion"),
  domain_allowlist: entry([...runValidation, "electron/backend/runtime/runner.test.ts"], "desktop_e2e_and_backend", "Hidden graph-internal node; E2E verifies navigation policy."),
} satisfies Partial<Record<ActionType, CoverageEntry>>;

export const graphNodeCoverage = {
  start: entry(controlFlow),
  action: entry([
    ...coreExecution,
    ...captureNetwork,
    ...keyboardDialog,
    ...pointerActions,
    ...navigationActions,
    ...extendedForm,
    ...waitAssertion,
    ...contextStorage,
  ]),
  merge: entry([...controlFlow, ...compilerTests, ...runnerTests, ...graphEditorTests], "desktop_e2e_and_backend", "Graph-native fan-in node covered through a local Router/Merge convergence scenario."),
  router: entry([...controlFlow, ...compilerTests, ...runnerTests, ...graphEditorTests], "desktop_e2e_and_backend", "Graph-native first-match decision node covered through a local Router/Merge convergence scenario."),
  end_success: entry(controlFlow),
  end_failure: entry(controlFlow),
  if: entry(controlFlow),
  switch: entry(controlFlow),
  repeat_times: entry(controlFlow),
  repeat_for_each: entry(controlFlow),
  repeat_until: entry(controlFlow),
  while: entry(controlFlow),
  retry: entry(controlFlow),
  try_catch: entry(["electron/backend/runtime/runner.test.ts", "electron/backend/graph/compiler.test.ts"], "backend_guard", "Hidden from simplified Add Logic but compiled and executed by backend tests."),
  fallback: entry(["electron/backend/runtime/runner.test.ts", "electron/backend/graph/compiler.test.ts"], "backend_guard", "Hidden from simplified Add Logic but compiled and executed by backend tests."),
  break_loop: entry(controlFlow),
  continue_loop: entry(controlFlow),
  stop_workflow: entry(controlFlow),
  set_variable: entry(controlFlow),
  set_json_variables: entry(controlFlow),
  transform_variable: entry(["electron/backend/runtime/runner.test.ts", "electron/backend/graph/compiler.test.ts"], "backend_guard", "Graph node covered below desktop visible-node level."),
  assert_output: entry(["electron/backend/runtime/runner.test.ts", "electron/backend/graph/compiler.test.ts"], "backend_guard", "Graph node covered below desktop visible-node level."),
  domain_allowlist: entry([...runValidation, "electron/backend/runtime/runner.test.ts"], "desktop_e2e_and_backend", "Safety boundary covered by E2E navigation policy."),
} satisfies Partial<Record<GraphNodeType, CoverageEntry>>;

export const workflowJourneyCoverage = {
  workflow_crud: entry([
    ...workflowJourneys,
    "src/features/workflows/pages/WorkflowListPage.test.tsx",
    "tests/e2e/electron-isolation.e2e.ts",
  ], "desktop_e2e_and_backend"),
  graph_authoring: entry([
    "src/features/workflows/components/WorkflowGraphEditor.test.tsx",
    "tests/e2e/control-flow.e2e.ts",
  ], "desktop_e2e_and_backend"),
  settings_before_run: entry([
    ...workflowJourneys,
    "src/features/workflows/pages/WorkflowDetailPage.test.tsx",
    "electron/backend/runtime/runner.test.ts",
  ], "desktop_e2e_and_backend"),
  workflow_run_success: entry([
    ...workflowJourneys,
    "tests/e2e/core-execution.e2e.ts",
    "tests/e2e/control-flow.e2e.ts",
  ], "desktop_e2e"),
  workflow_run_failure: entry([
    ...runValidation,
    "tests/e2e/wait-assertion-actions.e2e.ts",
    "tests/e2e/control-flow.e2e.ts",
  ], "desktop_e2e"),
  workflow_stop: entry([...runValidation, "electron/backend/runtime/runner.test.ts"], "desktop_e2e_and_backend"),
  evidence_persistence: entry([
    ...batchEvidence,
    "tests/e2e/capture-network.e2e.ts",
    "electron/backend/commands.test.ts",
  ], "desktop_e2e_and_backend"),
  import_export: entry([
    ...workflowPackage,
    "src/features/workflows/pages/WorkflowListPage.test.tsx",
    "electron/backend/commands.test.ts",
  ], "desktop_e2e_and_backend"),
  batch_execution: entry([...batchEvidence, "electron/backend/commands.test.ts"], "desktop_e2e_and_backend"),
  staging_owned_target: entry(["tests/e2e/staging-owned-targets.e2e.ts"], "staging_opt_in"),
} satisfies Record<string, CoverageEntry>;

export type BehaviorCapabilityStatus = "covered" | "gap" | "not_applicable";

export type BehaviorScenario = {
  id: string;
  domain: string;
  user_intent: string;
  preconditions: string[];
  workflow_authoring: string[];
  browser_behavior: string[];
  actions_and_fields: string[];
  expected_outcomes: string[];
  recovery_variants?: string[];
  capability_status: BehaviorCapabilityStatus;
  evidence: {
    files?: string[];
    gap_ids?: string[];
    notes?: string;
  };
};

export type CapabilityGap = {
  gap_id: string;
  scenario_id: string;
  user_behavior: string;
  current_limitation: string;
  proposed_capability: string;
  blocked_e2e: string;
  risk_or_value: string;
  decision_status: "proposed" | "accepted" | "rejected";
};

export type CapabilityTraceabilityEntry = {
  capability: string;
  scenario_ids: string[];
  status: BehaviorCapabilityStatus;
  evidence_files?: string[];
  gap_ids?: string[];
  reason?: string;
};

export type BehaviorFieldVariant = {
  capability: string;
  variants: string[];
  status: BehaviorCapabilityStatus;
  scenario_ids: string[];
  evidence_files?: string[];
  gap_ids?: string[];
  reason?: string;
};

export const capabilityGaps: CapabilityGap[] = [];

export const behaviorScenarios: BehaviorScenario[] = [
  {
    id: "workflow_author_create_run_delete",
    domain: "workflow_authoring",
    user_intent:
      "Create a workflow through the desktop UI, inspect graph/settings affordances, run it from the list, and delete it with confirmation.",
    preconditions: ["Fresh isolated Electron app data", "Local fixture server"],
    workflow_authoring: ["Create workflow", "Open visual graph", "Open settings", "Run saved workflow", "Confirm delete"],
    browser_behavior: ["Navigate fixture page", "Run terminal status appears in the desktop UI"],
    actions_and_fields: ["workflow CRUD", "settings_before_run", "workflow_run_success", "workflow_stop"],
    expected_outcomes: ["Workflow row status reaches success", "Delete confirmation removes the workflow"],
    capability_status: "covered",
    evidence: { files: workflowJourneys },
  },
  {
    id: "basic_navigation_click_wait_extract",
    domain: "page_navigation",
    user_intent:
      "Open a page, click a control, wait for the page-visible result, and extract the resulting text.",
    preconditions: ["Local /basic fixture"],
    workflow_authoring: ["Linear graph with Navigate, Click, Wait, Extract Text"],
    browser_behavior: ["Button click changes status text from idle to clicked"],
    actions_and_fields: ["navigate.url", "click.target", "wait.condition=text_visible", "extract_text.output_name"],
    expected_outcomes: ["Output status_text equals clicked", "All graph steps complete"],
    capability_status: "covered",
    evidence: { files: coreExecution },
  },
  {
    id: "navigation_history_and_tabs",
    domain: "page_navigation",
    user_intent:
      "Move through browser history, reload the current page, open a detail page in a tab, switch back, and close the extra tab.",
    preconditions: ["Local /history and /tabs fixtures"],
    workflow_authoring: ["Linear graph with navigation history and tab action nodes"],
    browser_behavior: ["Browser history and active tab markers change according to operator-authored navigation actions"],
    actions_and_fields: [
      "go_back",
      "go_forward",
      "reload",
      "open_new_tab.url",
      "switch_tab.index",
      "close_tab.index",
      "extract_text.output_name",
    ],
    expected_outcomes: ["Extracted markers prove history, reload, active-tab switch, and tab close behavior"],
    capability_status: "covered",
    evidence: { files: navigationActions },
  },
  {
    id: "complete_form_submit_summary",
    domain: "form_completion",
    user_intent:
      "Fill a realistic form, clear stale text, choose options, toggle boolean controls, submit, and verify the submitted summary.",
    preconditions: ["Local /form fixture"],
    workflow_authoring: ["Linear graph with form field action nodes and submit"],
    browser_behavior: ["Form inputs mutate page state and submit handler renders a summary"],
    actions_and_fields: [
      "input_text.clear_before_input",
      "clear_input.target",
      "select_option.match_by=label",
      "select_option.match_by=value",
      "check.target",
      "uncheck.target",
      "toggle_checkbox.target",
      "select_radio.target",
      "submit_form.target",
      "extract_input_value.output_name",
    ],
    expected_outcomes: ["Summary contains submitted values", "Extracted input value matches typed contact value"],
    capability_status: "covered",
    evidence: { files: coreExecution },
  },
  {
    id: "extended_form_upload_custom_rich_text",
    domain: "form_completion",
    user_intent:
      "Attach files, choose an option from a custom dropdown, write into rich editable content, and verify page-visible form state.",
    preconditions: ["Local /extended-form fixture", "Temporary upload file"],
    workflow_authoring: ["Linear graph with upload, custom select, contenteditable, and extraction action nodes"],
    browser_behavior: ["File input, custom option UI, and contenteditable region update observable page state"],
    actions_and_fields: [
      "upload_file.files",
      "select_custom_option.trigger_target",
      "select_custom_option.option_text",
      "set_contenteditable.clear_before_input",
      "set_contenteditable.text",
      "extract_text.output_name",
    ],
    expected_outcomes: ["Upload status, custom option status, and rich text extraction match configured values"],
    capability_status: "covered",
    evidence: { files: extendedForm },
  },
  {
    id: "pointer_page_interaction",
    domain: "element_interaction",
    user_intent:
      "Interact with page controls using pointer behavior, drag an item into a drop zone, and scroll the page to reveal state changes.",
    preconditions: ["Local /pointer fixture"],
    workflow_authoring: ["Linear graph with pointer and scroll action nodes"],
    browser_behavior: ["Pointer events update page-visible counters and drag/drop state; page scroll marks the fixture as scrolled"],
    actions_and_fields: [
      "click.target",
      "double_click.target",
      "right_click.target",
      "hover.target",
      "drag_and_drop.source_target",
      "drag_and_drop.target_target",
      "scroll.mode=page",
      "scroll.mode=into_view",
      "scroll.mode=until_visible",
    ],
    expected_outcomes: ["Pointer summary records click, double click, right click, hover, drop, and scroll states"],
    capability_status: "covered",
    evidence: { files: pointerActions },
  },
  {
    id: "keyboard_clipboard_dialog_flow",
    domain: "keyboard_dialog",
    user_intent:
      "Focus fields, use keys and hotkeys, paste clipboard content, type a sequence, and handle browser prompt/confirm dialogs.",
    preconditions: ["Local /keyboard and /dialog fixtures"],
    workflow_authoring: ["Linear graph with keyboard, clipboard, paste, type-sequence, and dialog actions"],
    browser_behavior: ["Keyboard and dialog events update page-visible status and field values"],
    actions_and_fields: [
      "focus_element.target",
      "blur_element.target",
      "press_key.key",
      "hotkey.keys",
      "set_clipboard.text",
      "paste_clipboard.target",
      "type_sequence.delay_ms",
      "accept_dialog.prompt_text",
      "dismiss_dialog",
    ],
    expected_outcomes: ["Keyboard status and field values match expected key/dialog behavior"],
    capability_status: "covered",
    evidence: { files: keyboardDialog },
  },
  {
    id: "capture_network_evidence",
    domain: "content_capture",
    user_intent:
      "Capture text, attributes, inputs, list/table data, screenshot artifacts, download artifacts, and network route behavior.",
    preconditions: ["Local /capture and /network fixtures", "Run-scoped evidence directory"],
    workflow_authoring: ["Linear graph with capture, JavaScript, download, request wait, response wait, block, and mock actions"],
    browser_behavior: ["Fixture data is read from the page; network requests are observed, blocked, and mocked"],
    actions_and_fields: [
      "extract_attribute.attribute",
      "extract_list.output_name",
      "extract_table.output_name",
      "take_screenshot.full_page=false",
      "wait_for_download.output_name",
      "wait_for_request.url_contains",
      "wait_for_response.status",
      "block_request.url_patterns",
      "mock_response.status",
      "execute_js.output_name",
    ],
    expected_outcomes: ["Captured outputs match page data", "Screenshot/download files exist", "Network outputs reflect observed routes"],
    capability_status: "covered",
    evidence: { files: captureNetwork },
  },
  {
    id: "network_request_policy",
    domain: "network_behavior",
    user_intent:
      "Observe requests and responses, block an unwanted request, and mock an owned endpoint response during workflow execution.",
    preconditions: ["Local /network fixture"],
    workflow_authoring: ["Linear graph with wait_for_request, wait_for_response, block_request, and mock_response nodes"],
    browser_behavior: ["Fixture page issues fetch calls that the workflow observes, blocks, and mocks"],
    actions_and_fields: [
      "wait_for_request.url_contains",
      "wait_for_response.status=200",
      "block_request.url_patterns",
      "mock_response.status=203",
      "mock_response.content_type",
    ],
    expected_outcomes: ["Run outputs include observed request/response URLs, blocked fetch result, and mocked response body"],
    capability_status: "covered",
    evidence: { files: captureNetwork },
  },
  {
    id: "dynamic_wait_assert_failure",
    domain: "dynamic_behavior",
    user_intent:
      "Wait for asynchronous page state and surface a clear workflow failure when an assertion does not match.",
    preconditions: ["Local /wait-assertion fixture"],
    workflow_authoring: ["Linear graph with waits, assertions, and failure variant"],
    browser_behavior: ["Page status changes asynchronously and URL is updated before assertions run"],
    actions_and_fields: [
      "wait.condition=duration",
      "wait.condition=page_load",
      "wait.condition=element_visible",
      "wait.condition=element_hidden",
      "wait.condition=element_attached",
      "wait.condition=element_detached",
      "wait.condition=element_enabled",
      "wait.condition=element_disabled",
      "wait.condition=text_visible",
      "wait.condition=url_contains",
      "random_wait.min_ms",
      "assert_element.state=visible",
      "assert_element.state=hidden",
      "assert_element.state=attached",
      "assert_element.state=enabled",
      "assert_element.state=disabled",
      "assert_text.match_mode=contains",
      "assert_text.match_mode=equals",
      "assert_text.failure",
    ],
    expected_outcomes: ["Passing run records wait timings", "Failing run identifies assert_text step and reason"],
    capability_status: "covered",
    evidence: { files: waitAssertion },
  },
  {
    id: "browser_context_storage_headers_location",
    domain: "browser_context",
    user_intent:
      "Mutate runtime viewport, storage, cookies, headers, permissions, and geolocation and verify page-observable state.",
    preconditions: ["Local /context-storage and /headers fixtures"],
    workflow_authoring: ["Linear graph with browser context and storage actions"],
    browser_behavior: ["Page reads mutated context state through browser APIs and server-rendered headers"],
    actions_and_fields: [
      "set_viewport.width",
      "set_viewport.height",
      "set_local_storage.key",
      "set_session_storage.key",
      "set_cookie.domain",
      "clear_cookies.domain",
      "set_extra_headers.headers",
      "grant_permission.permissions",
      "set_geolocation.accuracy",
    ],
    expected_outcomes: ["Viewport, storage, cookie, header, and geolocation outputs match configured values"],
    capability_status: "covered",
    evidence: { files: contextStorage },
  },
  {
    id: "data_flow_variables_templates",
    domain: "data_flow",
    user_intent:
      "Seed typed variables and JSON data, use variables inside graph loops/templates, and carry output values into later steps.",
    preconditions: ["No external page required"],
    workflow_authoring: ["Graph-native variable nodes and loop nodes"],
    browser_behavior: ["Runner output store is updated and later graph nodes consume the values"],
    actions_and_fields: [
      "set_variable.variables",
      "set_variable.value_type=text",
      "set_json_variables.json",
      "repeat_for_each.array_variable",
      "repeat_for_each.literal_items",
      "template={{item}}",
    ],
    expected_outcomes: ["Outputs prove JSON array variables and loop item templates were consumed"],
    capability_status: "covered",
    evidence: { files: controlFlow },
  },
  {
    id: "graph_variables_loops_retry_terminal",
    domain: "decisions_and_recovery",
    user_intent:
      "Use graph-native variables, branches, loops, retry, loop control, and terminal outcomes to control execution.",
    preconditions: ["No external page required"],
    workflow_authoring: ["Graph-native nodes connected through branch, loop, retry, and terminal ports"],
    browser_behavior: ["Runner output store changes according to selected graph paths"],
    actions_and_fields: [
      "set_variable.variables",
      "set_json_variables.json",
      "if.condition",
      "switch.cases",
      "repeat_times.times",
      "repeat_for_each.array_variable",
      "repeat_for_each.literal_items",
      "while.max_attempts",
      "repeat_until.max_attempts",
      "retry.max_attempts",
      "break_loop",
      "continue_loop",
      "stop_workflow.status",
    ],
    expected_outcomes: ["Outputs prove selected branches and loop bodies executed", "Failure terminal reports expected reason"],
    capability_status: "covered",
    evidence: { files: controlFlow },
  },
  {
    id: "run_failure_stop_timeout_outcome",
    domain: "run_outcome",
    user_intent:
      "Block invalid workflow execution, fail a run with clear step context, and stop an active long-running workflow.",
    preconditions: ["Local invalid graph and long wait workflow"],
    workflow_authoring: ["Draft action graph, failure graph, and long wait workflow"],
    browser_behavior: ["Invalid graph never launches browser; long wait can be canceled by operator"],
    actions_and_fields: [
      "run_validation.error",
      "assert_text.failure",
      "stop_run",
      "wait.condition=duration",
      "stop_workflow.status=failure",
    ],
    expected_outcomes: ["Invalid run returns command error", "Failure identifies step/action/reason", "Stop reports stopped state"],
    capability_status: "covered",
    evidence: { files: [...runValidation, ...waitAssertion, ...controlFlow] },
  },
  {
    id: "session_retained_run_from_selected",
    domain: "session_continuity",
    user_intent:
      "Run a workflow with a persistent retained browser session, select a graph node, and rerun from that node without relaunching.",
    preconditions: ["Persistent profile settings", "Browser retention set to retain", "Run from selected enabled"],
    workflow_authoring: ["Save graph/settings, run full workflow, select node in graph, invoke Run from selected"],
    browser_behavior: ["Existing retained page/session is reused for selected-node execution"],
    actions_and_fields: [
      "run_policy.browser_retention=retain",
      "run_policy.run_from_selected_enabled",
      "run_policy.run_from_selected_mode=from_selected",
      "browser_launch.session_mode=persistent_profile",
    ],
    expected_outcomes: ["Retained session available", "Run from selected succeeds with target_step_id"],
    capability_status: "covered",
    evidence: { files: ["tests/e2e/run-from-selected-real.e2e.ts"] },
  },
  {
    id: "decision_router_merge_recovery_path",
    domain: "decisions_and_recovery",
    user_intent:
      "Route state through prioritized Router cases, converge with Merge, and continue through shared downstream verification.",
    preconditions: ["Graph-native router and merge nodes"],
    workflow_authoring: ["Router with stable case ids", "Case branches converging through Merge", "Downstream action after Merge"],
    browser_behavior: ["Selected case and downstream continuation both produce observable outputs"],
    actions_and_fields: ["router.mode=first_match", "router.case_<id>", "router.default", "merge.in multi-edge", "graph_noop.kind=merge"],
    expected_outcomes: ["Only first matching case executes", "Default route executes when no case matches", "Merge step completes", "Downstream verification executes"],
    capability_status: "covered",
    evidence: { files: controlFlow },
  },
  {
    id: "package_batch_evidence_audit",
    domain: "package_batch_audit",
    user_intent:
      "Export/import a workflow package safely and run batch rows with persisted evidence and row-level output history.",
    preconditions: ["Saved workflow package", "Batch rows", "Run evidence directory"],
    workflow_authoring: ["Workflow package export/import commands", "Batch execution through saved graph"],
    browser_behavior: ["Imported flow preserves graph behavior; batch rows interpolate row values and capture evidence"],
    actions_and_fields: [
      "workflow_package.version=2",
      "settings sanitization",
      "batch rows",
      "take_screenshot evidence",
      "run_steps persistence",
    ],
    expected_outcomes: ["Imported workflow is new", "Sensitive package fields are omitted", "Batch row evidence persists"],
    capability_status: "covered",
    evidence: { files: [...workflowPackage, ...batchEvidence] },
  },
];

export const capabilityTraceability: CapabilityTraceabilityEntry[] = [
  trace("workflow_authoring", ["workflow_author_create_run_delete"], "covered", workflowJourneys),
  trace("navigate", ["basic_navigation_click_wait_extract", "navigation_history_and_tabs", "complete_form_submit_summary", "capture_network_evidence"], "covered", [...coreExecution, ...navigationActions]),
  trace("click", ["basic_navigation_click_wait_extract"], "covered", coreExecution),
  trace("form_actions", ["complete_form_submit_summary"], "covered", coreExecution),
  trace("extended_form_actions", ["extended_form_upload_custom_rich_text"], "covered", extendedForm),
  trace("history_and_tabs", ["navigation_history_and_tabs"], "covered", navigationActions),
  trace("element_interaction", ["pointer_page_interaction"], "covered", pointerActions),
  trace("keyboard_dialog", ["keyboard_clipboard_dialog_flow"], "covered", keyboardDialog),
  trace("capture_and_evidence", ["capture_network_evidence"], "covered", captureNetwork),
  trace("network_behavior", ["network_request_policy"], "covered", captureNetwork),
  trace("wait_and_assertions", ["dynamic_wait_assert_failure"], "covered", waitAssertion),
  trace("browser_context", ["browser_context_storage_headers_location"], "covered", contextStorage),
  trace("data_flow", ["data_flow_variables_templates"], "covered", controlFlow),
  trace("graph_control_flow", ["graph_variables_loops_retry_terminal"], "covered", controlFlow),
  trace("run_outcome", ["run_failure_stop_timeout_outcome"], "covered", [...runValidation, ...waitAssertion, ...controlFlow]),
  trace("session_continuity", ["session_retained_run_from_selected"], "covered", ["tests/e2e/run-from-selected-real.e2e.ts"]),
  trace("package_batch_audit", ["package_batch_evidence_audit"], "covered", [...workflowPackage, ...batchEvidence]),
  trace("router_merge_local_journey", ["decision_router_merge_recovery_path"], "covered", controlFlow),
];

export const behaviorFieldVariants: BehaviorFieldVariant[] = [
  fieldVariant("ElementTarget", [
    "locator.kind=attribute",
    "locator.kind=css",
    "locator.kind=label",
    "locator.kind=placeholder",
    "locator.kind=role",
    "locator.kind=test_id",
    "locator.kind=text",
    "locator.kind=xpath",
    "constraints.contains_text",
    "constraints.enabled",
    "constraints.index",
    "constraints.visible",
    "target.iframe",
    "legacy.iframe_xpath",
  ], [
    "basic_navigation_click_wait_extract",
    "complete_form_submit_summary",
    "pointer_page_interaction",
    "dynamic_wait_assert_failure",
  ], [...coreExecution, ...pointerActions, ...waitAssertion, ...runnerTests]),
  fieldVariant("wait.condition", [
    "duration",
    "element_visible",
    "element_hidden",
    "element_attached",
    "element_detached",
    "text_visible",
    "url_contains",
    "page_load",
    "element_enabled",
    "element_disabled",
  ], ["dynamic_wait_assert_failure"], [...waitAssertion, ...runnerTests]),
  fieldVariant("select_option.match_by", ["label", "value"], ["complete_form_submit_summary"], coreExecution),
  fieldVariant("scroll.mode", ["page", "into_view", "until_visible"], ["pointer_page_interaction"], [...pointerActions, ...runnerTests]),
  fieldVariant("assert_element.state", ["attached", "visible", "hidden", "enabled", "disabled"], ["dynamic_wait_assert_failure"], [...waitAssertion, ...runnerTests]),
  fieldVariant("assert_text.match_mode", ["contains", "equals", "failure"], ["dynamic_wait_assert_failure"], waitAssertion),
  fieldVariant("repeat_for_each.source", ["array_variable", "literal_items"], ["graph_variables_loops_retry_terminal", "data_flow_variables_templates"], [...controlFlow, ...runnerTests, ...compilerTests]),
  fieldVariant("stop_workflow.status", ["success", "failure", "close_browser"], ["graph_variables_loops_retry_terminal", "run_failure_stop_timeout_outcome"], [...controlFlow, ...runnerTests]),
  fieldVariant("wait_for_response.status", ["status-filtered", "unfiltered"], ["capture_network_evidence", "network_request_policy"], captureNetwork),
  fieldVariant("run_policy.browser_retention", ["retain", "close"], ["session_retained_run_from_selected"], ["tests/e2e/run-from-selected-real.e2e.ts", ...coreExecution]),
  fieldVariant("router_and_merge", ["router.mode=first_match", "router.case.priority", "router.default", "merge.in multi-edge"], ["decision_router_merge_recovery_path"], controlFlow),
];

function entry(
  files: string[],
  depth: CoverageDepth = "desktop_e2e",
  notes?: string,
): CoverageEntry {
  return { files: [...new Set(files)], depth, notes };
}

function graphInternal(files: string[]): CoverageEntry {
  return entry(files, "desktop_e2e", "Covered through graph-native node execution.");
}

function backendGuard(notes: string): CoverageEntry {
  return entry([...runnerTests, ...compilerTests], "backend_guard", notes);
}

function trace(
  capability: string,
  scenarioIds: string[],
  status: BehaviorCapabilityStatus,
  evidenceFiles?: string[],
  gapIds?: string[],
): CapabilityTraceabilityEntry {
  return {
    capability,
    scenario_ids: scenarioIds,
    status,
    evidence_files: evidenceFiles,
    gap_ids: gapIds,
  };
}

function fieldVariant(
  capability: string,
  variants: string[],
  scenarioIds: string[],
  evidenceFiles?: string[],
  gapIds?: string[],
): BehaviorFieldVariant {
  return {
    capability,
    variants,
    status: gapIds?.length ? "gap" : "covered",
    scenario_ids: scenarioIds,
    evidence_files: evidenceFiles,
    gap_ids: gapIds,
  };
}
