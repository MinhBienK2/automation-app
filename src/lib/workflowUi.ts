import type {
  ActionType,
  CommandError,
  GraphValidationIssue,
  RunState,
  WorkflowRunSnapshot,
} from "../types/workflow";
import { allActionTypes, isActionVisibleInPrimaryPalette } from "./actionCapabilities";

export const actionLabels: Record<ActionType, string> = {
  navigate: "Navigate",
  wait: "Wait",
  random_wait: "Random Wait",
  input_text: "Fill Field",
  clear_input: "Clear Field",
  click: "Click",
  find_element: "Find Element",
  scroll: "Scroll",
  select_option: "Select Option",
  press_key: "Press Key",
  hotkey: "Hotkey",
  hover: "Hover",
  double_click: "Double Click",
  right_click: "Right Click",
  drag_and_drop: "Drag and Drop",
  focus_element: "Focus Element",
  blur_element: "Blur Element",
  type_sequence: "Type Keys",
  set_clipboard: "Set Clipboard",
  paste_clipboard: "Paste Into Field",
  check: "Check",
  uncheck: "Uncheck",
  toggle_checkbox: "Toggle Checkbox",
  select_radio: "Select Radio",
  upload_file: "Upload File",
  submit_form: "Submit Form",
  select_custom_option: "Select Custom Option",
  set_contenteditable: "Fill Rich Text",
  extract_text: "Extract Text",
  extract_attribute: "Extract Attribute",
  extract_input_value: "Extract Field Value",
  extract_table: "Extract Table",
  extract_list: "Extract List",
  count_elements: "Count Elements",
  extract_regex_matches: "Extract Regex Matches",
  take_screenshot: "Take Screenshot",
  write_text_file: "Write Text File",
  go_back: "Go Back",
  go_forward: "Go Forward",
  reload: "Reload",
  open_new_tab: "Open New Tab",
  switch_tab: "Switch Tab",
  close_tab: "Close Tab",
  accept_dialog: "Accept Dialog",
  dismiss_dialog: "Dismiss Dialog",
  wait_for_download: "Wait For Download",
  set_variable: "Set Variables",
  set_json_variables: "Set JSON Variables",
  assert_element: "Assert Element",
  assert_text: "Assert Text",
  graph_noop: "Graph No-op",
  if_condition: "If Condition",
  router_condition: "Router Condition",
  random_choice: "Random Choice",
  repeat_times: "Repeat Times",
  repeat_for_each: "Repeat For Each",
  retry_block: "Retry Block",
  switch_condition: "Switch Condition",
  while_loop: "While Loop",
  repeat_until: "Repeat Until",
  try_catch: "Try Catch",
  fallback_block: "Fallback Block",
  break_loop: "Break Loop",
  continue_loop: "Continue Loop",
  stop_workflow: "Stop Workflow",
  transform_variable: "Transform Variable",
  update_number_variable: "Update Number Variable",
  update_text_variable: "Update Text Variable (Legacy)",
  set_text_variable: "Set Text Variable",
  append_text: "Append Text",
  prepend_text: "Prepend Text",
  replace_text: "Replace Text",
  trim_text: "Trim Text",
  change_text_case: "Change Text Case",
  slice_text: "Slice Text",
  regex_extract: "Regex Extract",
  get_text_length: "Get Text Length",
  check_text_empty: "Check Text Empty",
  check_text_contains: "Check Text Contains",
  check_text_regex_matches: "Check Text Regex Matches",
  update_flag_variable: "Update Flag Variable (Yes/No)",
  update_list_variable: "Update List Variable",
  create_empty_list: "Create Empty List",
  create_list_manual: "Create List Manual",
  split_text_to_list: "Split Text to List",
  generate_number_range: "Generate Number Range",
  add_to_list: "Add to List",
  remove_from_list_by_index: "Remove from List (Index)",
  remove_from_list_by_value: "Remove from List (Value)",
  merge_lists: "Merge Lists",
  get_list_item: "Get List Item",
  get_list_length: "Get List Length",
  slice_list: "Slice List",
  join_list: "Join List",
  filter_list: "Filter List",
  map_list_property: "Map List Property",
  sort_reverse_list: "Sort / Reverse List",
  execute_list_script: "Execute List Script",
  check_list_empty: "Check List Empty",
  check_list_contains: "Check List Contains",
  check_list_any_match: "Check List Any Match",
  check_list_all_match: "Check List All Match",
  create_empty_object: "Create Empty Object",
  create_object_manual: "Create Object (Manual)",
  parse_json_to_object: "Parse JSON to Object",
  set_object_property: "Set Object Property",
  remove_object_property: "Remove Object Property",
  merge_objects: "Merge Objects",
  rename_object_property: "Rename Object Property",
  get_object_property: "Get Object Property",
  get_object_keys: "Get Object Keys",
  get_object_values: "Get Object Values",
  stringify_object: "Stringify Object",
  execute_object_script: "Run Script on Object",
  check_object_key_exists: "Check Object Key Exists",
  check_object_empty: "Check Object Empty",
  assert_output: "Assert Output",
  domain_allowlist: "Domain Allowlist",
  check_conditions: "Check Conditions",
  calculate_value: "Calculate Value",
  set_cookie: "Set Cookie",
  clear_cookies: "Clear Cookies",
  set_viewport: "Set Viewport",
  set_geolocation: "Set Geolocation",
  set_extra_headers: "Set Request Headers",
  grant_permission: "Grant Permission",
  execute_js: "Run JavaScript",
  wait_for_request: "Wait For Request",
  wait_for_response: "Wait For Response",
  block_request: "Block Request",
  mock_response: "Mock Response",
  set_local_storage: "Set Local Storage",
  set_session_storage: "Set Session Storage",
  get_current_url: "Get Current URL",
  read_text_file: "Read Text File",
  parse_csv_excel: "Parse CSV/Excel File",
  write_csv_excel: "Write CSV/Excel File",
  file_operation: "File Operation",
  http_request: "HTTP API Request",
  date_time_operation: "Date-Time Operation",
  crypto_operation: "Crypto Hashing & Base64",
  switch_frame: "Switch Frame Context",
  switch_to_parent_frame: "Switch to Parent Frame",
};

const actionGroupCatalog: Array<{ label: string; actions: ActionType[] }> = [
  {
    label: "Navigation",
    actions: [
      "navigate",
      "go_back",
      "go_forward",
      "reload",
      "open_new_tab",
      "switch_tab",
      "close_tab",
    ],
  },
  {
    label: "Element Interaction",
    actions: [
      "click",
      "find_element",
      "double_click",
      "right_click",
      "hover",
      "drag_and_drop",
      "focus_element",
      "blur_element",
      "scroll",
    ],
  },
  {
    label: "Form Fields",
    actions: [
      "input_text",
      "clear_input",
      "select_option",
      "check",
      "uncheck",
      "toggle_checkbox",
      "select_radio",
      "upload_file",
      "submit_form",
      "select_custom_option",
      "set_contenteditable",
    ],
  },
  {
    label: "Keyboard",
    actions: [
      "press_key",
      "hotkey",
      "type_sequence",
      "set_clipboard",
      "paste_clipboard",
    ],
  },
  {
    label: "Wait",
    actions: ["wait", "random_wait"],
  },
  {
    label: "Capture Data",
    actions: [
      "extract_text",
      "extract_attribute",
      "extract_input_value",
      "extract_table",
      "extract_list",
      "count_elements",
      "extract_regex_matches",
      "take_screenshot",
      "write_text_file",
      "wait_for_download",
      "get_current_url",
    ],
  },
  {
    label: "Browser Context",
    actions: [
      "accept_dialog",
      "dismiss_dialog",
      "set_viewport",
      "set_geolocation",
      "grant_permission",
      "switch_frame",
      "switch_to_parent_frame",
    ],
  },
  {
    label: "Variables & Checks",
    actions: ["set_variable", "set_json_variables", "assert_element", "assert_text"],
  },
  {
    label: "Session & Storage",
    actions: [
      "set_cookie",
      "clear_cookies",
      "set_local_storage",
      "set_session_storage",
    ],
  },
  {
    label: "Network",
    actions: [
      "set_extra_headers",
      "wait_for_request",
      "wait_for_response",
      "block_request",
      "mock_response",
    ],
  },
  {
    label: "File Operations",
    actions: [
      "read_text_file",
      "parse_csv_excel",
      "write_csv_excel",
      "file_operation",
    ],
  },
  {
    label: "Integrations",
    actions: [
      "http_request",
    ],
  },
  {
    label: "Advanced Utilities",
    actions: [
      "date_time_operation",
      "crypto_operation",
    ],
  },
  {
    label: "Advanced",
    actions: ["execute_js"],
  },
];

export const actionGroups: Array<{ label: string; actions: ActionType[] }> =
  actionGroupCatalog
    .map((group) => ({
      ...group,
      actions: group.actions.filter(isActionVisibleInPrimaryPalette),
    }))
    .filter((group) => group.actions.length > 0);

export const actionOptions: ActionType[] = actionGroups.flatMap((group) => group.actions);
export const allActionOptions: ActionType[] = allActionTypes;

export const initialRunState: RunState = {
  status: "idle",
  mode: "none",
  target_step_id: null,
  current_step_id: null,
  current_step_number: null,
  completed_step_ids: [],
  outputs: {},
  retained_session: {
    available: false,
    workflow_id: null,
    profile_name: null,
    reason: "No retained browser session",
  },
  error: null,
};

export function commandMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error) {
    return String((error as CommandError).message);
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error";
}

export function normalizeRunState(state: RunState): RunState {
  return {
    status: state.status,
    mode: state.mode ?? "none",
    target_step_id: state.target_step_id ?? null,
    current_step_id: state.current_step_id ?? null,
    current_step_number: state.current_step_number ?? null,
    completed_step_ids: state.completed_step_ids ?? [],
    outputs: state.outputs ?? {},
    retained_session: state.retained_session ?? null,
    error: state.error ?? null,
  };
}

export function normalizeRunSnapshot(snapshot: WorkflowRunSnapshot): WorkflowRunSnapshot {
  const state = normalizeRunState(snapshot.state ?? snapshot);
  return {
    ...state,
    run_id: snapshot.run_id,
    workflow_id: snapshot.workflow_id,
    workflow_name: snapshot.workflow_name,
    source: snapshot.source,
    started_at: snapshot.started_at,
    state,
  };
}

export function runStatusLabel(
  state: RunState,
  options: { appError?: string; hasBlockingIssues?: boolean } = {},
) {
  if (state.status === "running") {
    return state.current_step_number
      ? `Running step ${state.current_step_number}`
      : "Running";
  }
  if (state.status === "success") return "Run succeeded";
  if (state.status === "failed") return "Run failed";
  if (state.status === "stopped") return "Stopped";
  if (options.hasBlockingIssues) return "Run blocked";
  if (options.appError) return "Could not start run";
  return "Idle";
}

export type RunIssueSeverity = "blocking" | "runtime" | "system";

export type RunIssue = {
  id: string;
  severity: RunIssueSeverity;
  title: string;
  message: string;
  node_id?: string | null;
  edge_id?: string | null;
  step_number?: number | null;
  action_type?: string | null;
  context: string[];
  diagnostics: string[];
  suggestions: string[];
};

export function buildRunIssues({
  appError,
  graphIssuesNeedRecheck = false,
  graphIssues,
  runState,
}: {
  appError: string;
  graphIssuesNeedRecheck?: boolean;
  graphIssues: GraphValidationIssue[];
  runState: RunState;
}): RunIssue[] {
  const blockingIssues = graphIssues.filter((issue) => issue.level === "error");
  const blockingRunIssues: RunIssue[] = blockingIssues.slice(0, 5).map((issue, index) => ({
    id: `blocking-${issue.node_id ?? issue.edge_id ?? index}-${issue.message}`,
    severity: "blocking",
    title: issue.message,
    message: issueMessageContext(issue),
    node_id: issue.node_id,
    edge_id: issue.edge_id,
    context: [],
    diagnostics: [],
    suggestions: [],
  }));

  if (blockingRunIssues.length && !graphIssuesNeedRecheck) {
    return blockingRunIssues;
  }

  if (runState.status === "failed" && runState.error) {
    const actionLabel = actionLabelForRunError(runState.error.action_type);
    const stepLabel = runState.error.step_name?.trim() || actionLabel;
    const context = runtimeFailureContext(runState.error);
    const diagnostics = runtimeFailureDiagnostics(runState.error);
    return [
      {
        id: `runtime-${runState.error.step_id ?? runState.error.step_number}`,
        severity: "runtime",
        title: `Run failed at step ${runState.error.step_number}: ${stepLabel}`,
        message: runState.error.reason,
        node_id: runState.error.step_id,
        step_number: runState.error.step_number,
        action_type: runState.error.action_type,
        context,
        diagnostics,
        suggestions: suggestionsFor(
          runState.error.reason,
          runState.error.action_type,
        ),
      },
      ...blockingRunIssues,
    ];
  }

  if (appError.trim()) {
    return [
      {
        id: "system-error",
        severity: "system",
        title: "Could not start run",
        message: appError.trim(),
        context: [],
        diagnostics: [],
        suggestions: [],
      },
      ...blockingRunIssues,
    ];
  }

  if (blockingRunIssues.length) {
    return blockingRunIssues;
  }

  return [];
}

function actionLabelForRunError(actionType: string) {
  return actionLabels[actionType as ActionType] ?? actionType;
}

function runtimeFailureContext(error: NonNullable<RunState["error"]>) {
  const context: string[] = [];
  const labelPath = error.diagnostics?.label_path
    ?.map((part) => part.trim())
    .filter(Boolean);
  const location = labelPath?.length
    ? labelPath.join(" > ")
    : error.step_name?.trim() || null;
  if (location) context.push(`Location: ${location}`);
  const subflowContext = runtimeFailureSubflowContext(error);
  if (subflowContext) context.push(subflowContext);
  const actionSummary = error.diagnostics?.action_summary?.trim();
  if (actionSummary) context.push(`Action target: ${actionSummary}`);
  return context;
}

function runtimeFailureSubflowContext(error: NonNullable<RunState["error"]>) {
  const stepNumber = error.diagnostics?.subflow_step_number;
  const stepCount = error.diagnostics?.subflow_step_count;
  const actionType = error.action_type.trim();
  if (typeof stepNumber !== "number" && !actionType) return null;
  const stepLabel = typeof stepNumber === "number"
    ? `Subflow step: ${stepNumber}${typeof stepCount === "number" ? ` of ${stepCount}` : ""}`
    : "Subflow step";
  return actionType ? `${stepLabel} · node ${actionType}` : stepLabel;
}

function runtimeFailureDiagnostics(error: NonNullable<RunState["error"]>) {
  const diagnostics: string[] = [];
  const compiledStepId = error.diagnostics?.compiled_step_id?.trim();
  const parentStepId = error.diagnostics?.parent_step_id?.trim();
  const parentStepIds = error.diagnostics?.parent_step_ids;
  const subflowNodeId = error.diagnostics?.subflow_node_id?.trim();
  const subflowId = error.diagnostics?.subflow_id?.trim();
  const subflowName = error.diagnostics?.subflow_name?.trim();
  if (compiledStepId) diagnostics.push(`Compiled step id: ${compiledStepId}`);
  if (parentStepIds && parentStepIds.length > 0) {
    diagnostics.push(`Parent step hierarchy: ${parentStepIds.join(" > ")}`);
  } else if (parentStepId) {
    diagnostics.push(`Parent step id: ${parentStepId}`);
  }
  if (subflowNodeId) diagnostics.push(`Subflow node id: ${subflowNodeId}`);
  if (subflowId) diagnostics.push(`Subflow id: ${subflowId}`);
  if (subflowName) diagnostics.push(`Subflow name: ${subflowName}`);
  return diagnostics;
}

function issueMessageContext(issue: GraphValidationIssue) {
  if (issue.node_id) return "Fix this node before running.";
  if (issue.edge_id) return "Fix this link before running.";
  return "Fix this graph issue before running.";
}

function suggestionsFor(reason: string, actionType: string) {
  if (reason.includes("XPath not found")) {
    return [
      "Check the XPath in the Chromium window that remains open.",
      "Add a Wait step before this step if the element loads slowly.",
      "Prefer XPath based on id, name, placeholder, text, or stable attributes.",
      "Avoid absolute XPath such as /html/body/div[2]/...",
    ];
  }
  if (reason.includes("Element cannot receive text")) {
    return [
      "Make sure the XPath points to an input, textarea, or editable element.",
      "Check whether the XPath points to a label, div, button, or wrapper instead of the field.",
    ];
  }
  if (reason.includes("URL") || actionType === "navigate") {
    return [
      "Use a full URL with http:// or https://.",
      "Check for extra whitespace or missing characters.",
    ];
  }
  if (reason.includes("Pixels")) {
    return [
      "Use a Scroll pixels value greater than 0.",
      "Try 300 to 800 pixels for a single scroll.",
    ];
  }
  return [
    "Close old test browsers and try again.",
    "Check that Chrome or Chromium can start on this machine.",
  ];
}
