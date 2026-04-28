import type {
  ActionType,
  CommandError,
  RunState,
  WorkflowStep,
} from "../types/workflow";

export const actionLabels: Record<ActionType, string> = {
  navigate: "Navigate",
  open_url: "Open URL",
  sleep: "Sleep",
  wait: "Wait",
  input_text: "Input Text",
  type_text: "Type Text",
  clear_input: "Clear Input",
  click: "Click",
  scroll: "Scroll",
  select_option: "Select Option",
  set_checkbox: "Set Checkbox",
  press_key: "Press Key",
  hotkey: "Hotkey",
  hover: "Hover",
  double_click: "Double Click",
  right_click: "Right Click",
  drag_and_drop: "Drag and Drop",
  focus_element: "Focus Element",
  blur_element: "Blur Element",
  type_sequence: "Type Sequence",
  set_clipboard: "Set Clipboard",
  paste_clipboard: "Paste Clipboard",
  check: "Check",
  uncheck: "Uncheck",
  toggle_checkbox: "Toggle Checkbox",
  select_radio: "Select Radio",
  upload_file: "Upload File",
  submit_form: "Submit Form",
  select_custom_option: "Select Custom Option",
  set_contenteditable: "Set Contenteditable",
  extract_text: "Extract Text",
  extract_attribute: "Extract Attribute",
  extract_input_value: "Extract Input Value",
  extract_table: "Extract Table",
  extract_list: "Extract List",
  take_screenshot: "Take Screenshot",
  go_back: "Go Back",
  go_forward: "Go Forward",
  reload: "Reload",
  open_new_tab: "Open New Tab",
  switch_tab: "Switch Tab",
  close_tab: "Close Tab",
  switch_frame: "Switch Frame",
  accept_dialog: "Accept Dialog",
  dismiss_dialog: "Dismiss Dialog",
  set_download_directory: "Set Download Directory",
  wait_for_download: "Wait For Download",
  set_variable: "Set Variable",
  assert_element: "Assert Element",
  assert_text: "Assert Text",
  if_condition: "If Condition",
  repeat_times: "Repeat Times",
  repeat_for_each: "Repeat For Each",
  retry_block: "Retry Block",
  stop_workflow: "Stop Workflow",
  use_profile: "Use Profile",
  save_session: "Save Session",
  load_session: "Load Session",
  set_cookie: "Set Cookie",
  clear_cookies: "Clear Cookies",
  set_secret: "Set Secret",
};

export const actionGroups: Array<{ label: string; actions: ActionType[] }> = [
  {
    label: "Core",
    actions: ["navigate", "click", "input_text", "clear_input", "scroll", "wait"],
  },
  {
    label: "Forms",
    actions: [
      "select_option",
      "check",
      "uncheck",
      "toggle_checkbox",
      "select_radio",
      "upload_file",
      "submit_form",
      "select_custom_option",
      "set_contenteditable",
      "set_checkbox",
    ],
  },
  {
    label: "Keyboard",
    actions: [
      "press_key",
      "hotkey",
      "type_sequence",
      "focus_element",
      "blur_element",
      "set_clipboard",
      "paste_clipboard",
    ],
  },
  {
    label: "Mouse",
    actions: ["hover", "double_click", "right_click", "drag_and_drop"],
  },
  {
    label: "Data",
    actions: [
      "extract_text",
      "extract_attribute",
      "extract_input_value",
      "extract_table",
      "extract_list",
      "take_screenshot",
    ],
  },
  {
    label: "Browser",
    actions: [
      "go_back",
      "go_forward",
      "reload",
      "open_new_tab",
      "switch_tab",
      "close_tab",
      "switch_frame",
      "accept_dialog",
      "dismiss_dialog",
      "set_download_directory",
      "wait_for_download",
    ],
  },
  {
    label: "Logic",
    actions: [
      "set_variable",
      "assert_element",
      "assert_text",
      "if_condition",
      "repeat_times",
      "repeat_for_each",
      "retry_block",
      "stop_workflow",
    ],
  },
  {
    label: "Session",
    actions: [
      "use_profile",
      "save_session",
      "load_session",
      "set_cookie",
      "clear_cookies",
      "set_secret",
    ],
  },
  {
    label: "Legacy",
    actions: ["open_url", "sleep", "type_text"],
  },
];

export const actionOptions: ActionType[] = actionGroups.flatMap((group) => group.actions);

export const initialRunState: RunState = {
  status: "idle",
  mode: "none",
  target_step_id: null,
  current_step_id: null,
  current_step_number: null,
  completed_step_ids: [],
  error: null,
};

export function stepSummary(step: WorkflowStep) {
  switch (step.config.type) {
    case "navigate":
      return step.config.config.url || "No URL";
    case "open_url":
      return step.config.config.url || "No URL";
    case "sleep":
      return `${step.config.config.seconds}s`;
    case "wait":
      if (step.config.config.condition === "duration") {
        return `${step.config.config.duration_ms ?? 0}ms`;
      }
      return step.config.config.condition;
    case "input_text":
      return step.config.config.xpath || "No XPath";
    case "type_text":
      return step.config.config.xpath || "No XPath";
    case "clear_input":
      return step.config.config.xpath || "No XPath";
    case "click":
      return step.config.config.xpath || "No XPath";
    case "scroll": {
      const mode = step.config.config.mode ?? "page";
      if (mode === "into_view") return step.config.config.xpath || "No XPath";
      if (mode === "until_visible") {
        return `until visible ${step.config.config.xpath || "No XPath"}`;
      }
      return `${mode} ${step.config.config.direction} ${step.config.config.pixels}px`;
    }
    case "select_option":
      return `${step.config.config.match_by}: ${step.config.config.value || "No value"}`;
    case "set_checkbox":
      return `${step.config.config.state} ${step.config.config.xpath || "No XPath"}`;
    case "press_key":
      return step.config.config.key || "No key";
    case "hotkey":
      return step.config.config.keys.join("+") || "No keys";
    case "hover":
      return step.config.config.xpath || "No XPath";
    case "double_click":
      return step.config.config.xpath || "No XPath";
    case "right_click":
      return step.config.config.xpath || "No XPath";
    case "drag_and_drop":
      return `${step.config.config.source_xpath || "No source"} -> ${
        step.config.config.target_xpath || "No target"
      }`;
    case "focus_element":
      return step.config.config.xpath || "No XPath";
    case "blur_element":
      return step.config.config.xpath || "No XPath";
    case "type_sequence":
      return step.config.config.xpath || "No XPath";
    case "set_clipboard":
      return step.config.config.text || "No text";
    case "paste_clipboard":
      return step.config.config.xpath || "No XPath";
    case "check":
      return step.config.config.xpath || "No XPath";
    case "uncheck":
      return step.config.config.xpath || "No XPath";
    case "toggle_checkbox":
      return step.config.config.xpath || "No XPath";
    case "select_radio":
      return step.config.config.xpath || "No XPath";
    case "upload_file":
      return `${step.config.config.files.length} file(s)`;
    case "submit_form":
      return step.config.config.xpath || "Nearest form";
    case "select_custom_option":
      return step.config.config.option_text || "No option";
    case "set_contenteditable":
      return step.config.config.xpath || "No XPath";
    case "extract_text":
      return `${step.config.config.output_name || "No output"} <- ${
        step.config.config.xpath || "No XPath"
      }`;
    case "extract_attribute":
      return `${step.config.config.output_name || "No output"} <- ${
        step.config.config.attribute || "No attribute"
      }`;
    case "extract_input_value":
      return `${step.config.config.output_name || "No output"} <- ${
        step.config.config.xpath || "No XPath"
      }`;
    case "extract_table":
      return `${step.config.config.output_name || "No output"} table`;
    case "extract_list":
      return `${step.config.config.output_name || "No output"} list`;
    case "take_screenshot":
      return step.config.config.path || "No path";
    case "go_back":
      return "Browser back";
    case "go_forward":
      return "Browser forward";
    case "reload":
      return "Reload current tab";
    case "open_new_tab":
      return step.config.config.url || "Blank tab";
    case "switch_tab":
      return `tab ${step.config.config.index}`;
    case "close_tab":
      return step.config.config.index == null
        ? "Current tab"
        : `tab ${step.config.config.index}`;
    case "switch_frame":
      return step.config.config.xpath || "Top frame";
    case "accept_dialog":
      return step.config.config.prompt_text || "Accept dialog";
    case "dismiss_dialog":
      return "Dismiss dialog";
    case "set_download_directory":
      return step.config.config.path || "No directory";
    case "wait_for_download":
      return step.config.config.output_name || "No output";
    case "set_variable":
      return `${step.config.config.name} = ${step.config.config.value || "empty"}`;
    case "assert_element":
      return `${step.config.config.state} ${step.config.config.xpath || "No XPath"}`;
    case "assert_text":
      return `${step.config.config.match_mode} ${step.config.config.text || "No text"}`;
    case "if_condition":
      return step.config.config.condition.kind;
    case "repeat_times":
      return `${step.config.config.times} time(s)`;
    case "repeat_for_each":
      return `${step.config.config.item_name} over ${step.config.config.items.length} item(s)`;
    case "retry_block":
      return `${step.config.config.max_attempts} attempt(s)`;
    case "stop_workflow":
      return step.config.config.status;
    case "use_profile":
      return step.config.config.name || "No profile";
    case "save_session":
    case "load_session":
      return step.config.config.path || "No path";
    case "set_cookie":
      return `${step.config.config.name || "No cookie"} = ${step.config.config.value ? "[redacted]" : "empty"}`;
    case "clear_cookies":
      return step.config.config.domain || "All visible cookies";
    case "set_secret":
      return `${step.config.config.name || "No secret"} = [redacted]`;
  }
}

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
    error: state.error ?? null,
  };
}

export function monitorStepStatus(step: WorkflowStep, state: RunState) {
  if (state.error?.step_id === step.id) return "failed";
  if (state.current_step_id === step.id) return "running";
  if (state.completed_step_ids.includes(step.id)) return "passed";
  return "pending";
}

export function suggestionsFor(reason: string, actionType: string) {
  if (reason.includes("XPath not found")) {
    return [
      "Check the XPath in the Chromium window that remains open.",
      "Add a Sleep step before this step if the element loads slowly.",
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
  if (reason.includes("URL") || actionType === "open_url") {
    return [
      "Use a full URL with http:// or https://.",
      "Check for extra whitespace or missing characters.",
    ];
  }
  if (reason.includes("Seconds")) {
    return [
      "Use a Sleep value greater than 0.",
      "Try 0.5, 1, or 2 seconds depending on page speed.",
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
