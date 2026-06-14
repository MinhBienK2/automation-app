import type { ActionConfig } from "../../../src/types/workflow.js";

export type ActionType = ActionConfig["type"];

export type ActionOwner =
  | "navigation"
  | "element_interaction"
  | "form"
  | "keyboard"
  | "capture"
  | "browser_context"
  | "variables"
  | "network"
  | "advanced"
  | "graph_internal";

export type ActionDefinition = {
  type: ActionType;
  owner: ActionOwner;
  hiddenFromPalette: boolean;
  auditRisk: "normal" | "high";
};

const graphInternalActionTypes = new Set<ActionType>([
  "graph_noop",
  "if_condition",
  "router_condition",
  "random_choice",
  "repeat_times",
  "repeat_for_each",
  "retry_block",
  "switch_condition",
  "while_loop",
  "repeat_until",
  "try_catch",
  "fallback_block",
  "break_loop",
  "continue_loop",
  "stop_workflow",
  "transform_variable",
  "assert_output",
  "domain_allowlist",
]);

export const actionDefinitions: ActionDefinition[] = [
  definition("navigate", "navigation"),
  definition("wait", "browser_context"),
  definition("random_wait", "browser_context"),
  definition("input_text", "form"),
  definition("clear_input", "form"),
  definition("click", "element_interaction"),
  definition("find_element", "element_interaction"),
  definition("scroll", "element_interaction"),
  definition("select_option", "form"),
  definition("press_key", "keyboard"),
  definition("hotkey", "keyboard"),
  definition("hover", "element_interaction"),
  definition("double_click", "element_interaction"),
  definition("right_click", "element_interaction"),
  definition("drag_and_drop", "element_interaction"),
  definition("focus_element", "element_interaction"),
  definition("blur_element", "element_interaction"),
  definition("type_sequence", "keyboard"),
  definition("set_clipboard", "keyboard"),
  definition("paste_clipboard", "keyboard"),
  definition("check", "form"),
  definition("uncheck", "form"),
  definition("toggle_checkbox", "form"),
  definition("select_radio", "form"),
  definition("upload_file", "form"),
  definition("submit_form", "form"),
  definition("select_custom_option", "form"),
  definition("set_contenteditable", "form"),
  definition("extract_text", "capture"),
  definition("extract_attribute", "capture"),
  definition("extract_input_value", "capture"),
  definition("extract_table", "capture"),
  definition("extract_list", "capture"),
  definition("extract_regex_matches", "capture"),
  definition("take_screenshot", "capture"),
  definition("write_text_file", "capture"),
  definition("go_back", "navigation"),
  definition("go_forward", "navigation"),
  definition("reload", "navigation"),
  definition("open_new_tab", "navigation"),
  definition("switch_tab", "navigation"),
  definition("close_tab", "navigation"),
  definition("accept_dialog", "browser_context"),
  definition("dismiss_dialog", "browser_context"),
  definition("wait_for_download", "capture"),
  definition("set_variable", "variables"),
  definition("set_json_variables", "variables"),
  definition("assert_element", "capture"),
  definition("assert_text", "capture"),
  definition("graph_noop", "graph_internal"),
  definition("if_condition", "graph_internal"),
  definition("router_condition", "graph_internal"),
  definition("random_choice", "graph_internal"),
  definition("repeat_times", "graph_internal"),
  definition("repeat_for_each", "graph_internal"),
  definition("retry_block", "graph_internal"),
  definition("switch_condition", "graph_internal"),
  definition("while_loop", "graph_internal"),
  definition("repeat_until", "graph_internal"),
  definition("try_catch", "graph_internal"),
  definition("fallback_block", "graph_internal"),
  definition("break_loop", "graph_internal"),
  definition("continue_loop", "graph_internal"),
  definition("stop_workflow", "graph_internal"),
  definition("transform_variable", "graph_internal"),
  definition("update_number_variable", "graph_internal"),
  definition("update_text_variable", "graph_internal"),
  definition("update_flag_variable", "graph_internal"),
  definition("update_list_variable", "graph_internal"),
  definition("update_object_variable", "graph_internal"),
  definition("assert_output", "graph_internal"),
  definition("domain_allowlist", "graph_internal"),
  definition("set_cookie", "browser_context"),
  definition("clear_cookies", "browser_context"),
  definition("set_viewport", "browser_context"),
  definition("set_geolocation", "browser_context"),
  definition("set_extra_headers", "network"),
  definition("grant_permission", "browser_context"),
  definition("execute_js", "advanced", "high"),
  definition("wait_for_request", "network"),
  definition("wait_for_response", "network"),
  definition("block_request", "network"),
  definition("mock_response", "network"),
  definition("set_local_storage", "browser_context"),
  definition("set_session_storage", "browser_context"),
];

const definitionsByType = new Map(actionDefinitions.map((definition) => [definition.type, definition]));

export function getActionDefinition(type: unknown): ActionDefinition | undefined {
  return typeof type === "string"
    ? definitionsByType.get(type as ActionType)
    : undefined;
}

export function isKnownActionType(type: unknown): type is ActionType {
  return Boolean(getActionDefinition(type));
}

export function unsupportedActionTypeMessage(actionType: unknown) {
  return `Unsupported action type: ${
    typeof actionType === "string" && actionType ? actionType : "unknown"
  }`;
}

function definition(
  type: ActionType,
  owner: ActionOwner,
  auditRisk: ActionDefinition["auditRisk"] = "normal",
): ActionDefinition {
  return {
    type,
    owner,
    hiddenFromPalette: graphInternalActionTypes.has(type),
    auditRisk,
  };
}
