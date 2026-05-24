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
  if_condition: graphInternal(controlFlow),
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
  return entry(["electron/backend/runtime/runner.test.ts", "electron/backend/graph/compiler.test.ts"], "backend_guard", notes);
}
