import type { z } from "zod";
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
  configSchema?: z.ZodSchema;
  deprecated?: {
    since: string;
    replacement?: ActionType;
    reason: string;
  };
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
  "quarantined",
  "set_number_variable",
  "generate_random_number",
  "parse_text_to_number",
  "math_operation",
  "round_number",
  "format_number",
  "compare_numbers",
  "check_number_range",
  "check_number_property",
  "set_boolean_variable",
  "generate_random_boolean",
  "parse_to_boolean",
  "boolean_logical_op",
  "compare_booleans",
  "check_boolean_property",
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
  definition("count_elements", "capture"),
  definition("extract_regex_matches", "capture"),
  definition("extract_text_content", "capture"),
  definition("extract_inner_html", "capture"),
  definition("extract_outer_html", "capture"),
  definition("extract_computed_style", "capture"),
  definition("extract_all_attributes", "capture"),
  definition("extract_data_attributes", "capture"),
  definition("extract_class_list", "capture"),
  definition("extract_descendant_attributes", "capture"),
  definition("extract_select_value", "capture"),
  definition("extract_select_options", "capture"),
  definition("extract_checkbox_state", "capture"),
  definition("extract_form_data", "capture"),
  definition("extract_table_headers", "capture"),
  definition("extract_table_row", "capture"),
  definition("extract_table_column", "capture"),
  definition("extract_table_cell", "capture"),
  definition("extract_list_attributes", "capture"),
  definition("extract_structured_list", "capture"),
  definition("extract_dimensions", "capture"),
  definition("extract_visibility", "capture"),
  definition("extract_element_state", "capture"),
  definition("check_element_exists", "capture"),
  definition("get_page_title", "capture"),
  definition("get_meta_content", "capture"),
  definition("extract_page_links", "capture"),
  definition("extract_numbers", "capture"),
  definition("extract_urls", "capture"),
  definition("extract_emails", "capture"),
  definition("take_screenshot", "capture"),
  definition("write_text_file", "capture"),
  definition("go_back", "navigation"),
  definition("go_forward", "navigation"),
  definition("reload", "navigation"),
  definition("open_new_tab", "navigation"),
  definition("click_open_tab", "navigation"),
  definition("switch_tab", "navigation"),
  definition("close_tab", "navigation"),
  definition("accept_dialog", "browser_context"),
  definition("dismiss_dialog", "browser_context"),
  definition("wait_for_download", "capture"),
  definition("set_variable", "variables"),
  definition("set_json_variables", "variables"),
  definition("check_conditions", "variables"),
  definition("calculate_value", "variables"),
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
  definition("set_number_variable", "graph_internal"),
  definition("generate_random_number", "graph_internal"),
  definition("parse_text_to_number", "graph_internal"),
  definition("math_operation", "graph_internal"),
  definition("round_number", "graph_internal"),
  definition("format_number", "graph_internal"),
  definition("compare_numbers", "graph_internal"),
  definition("check_number_range", "graph_internal"),
  definition("check_number_property", "graph_internal"),
  definition("update_text_variable", "graph_internal"),
  definition("set_text_variable", "graph_internal"),
  definition("append_text", "graph_internal"),
  definition("prepend_text", "graph_internal"),
  definition("replace_text", "graph_internal"),
  definition("trim_text", "graph_internal"),
  definition("change_text_case", "graph_internal"),
  definition("slice_text", "graph_internal"),
  definition("regex_extract", "graph_internal"),
  definition("get_text_length", "graph_internal"),
  definition("check_text_empty", "graph_internal"),
  definition("check_text_contains", "graph_internal"),
  definition("check_text_regex_matches", "graph_internal"),
  definition("update_flag_variable", "graph_internal"),
  definition("set_boolean_variable", "graph_internal"),
  definition("generate_random_boolean", "graph_internal"),
  definition("parse_to_boolean", "graph_internal"),
  definition("boolean_logical_op", "graph_internal"),
  definition("compare_booleans", "graph_internal"),
  definition("check_boolean_property", "graph_internal"),
  definition("update_list_variable", "graph_internal"),
  definition("create_empty_list", "graph_internal"),
  definition("create_list_manual", "graph_internal"),
  definition("split_text_to_list", "graph_internal"),
  definition("generate_number_range", "graph_internal"),
  definition("add_to_list", "graph_internal"),
  definition("remove_from_list_by_index", "graph_internal"),
  definition("remove_from_list_by_value", "graph_internal"),
  definition("merge_lists", "graph_internal"),
  definition("get_list_item", "graph_internal"),
  definition("get_list_length", "graph_internal"),
  definition("slice_list", "graph_internal"),
  definition("join_list", "graph_internal"),
  definition("filter_list", "graph_internal"),
  definition("map_list_property", "graph_internal"),
  definition("sort_reverse_list", "graph_internal"),
  definition("execute_list_script", "graph_internal"),
  definition("check_list_empty", "graph_internal"),
  definition("check_list_contains", "graph_internal"),
  definition("check_list_any_match", "graph_internal"),
  definition("check_list_all_match", "graph_internal"),
  definition("create_empty_object", "graph_internal"),
  definition("create_object_manual", "graph_internal"),
  definition("parse_json_to_object", "graph_internal"),
  definition("set_object_property", "graph_internal"),
  definition("remove_object_property", "graph_internal"),
  definition("merge_objects", "graph_internal"),
  definition("rename_object_property", "graph_internal"),
  definition("get_object_property", "graph_internal"),
  definition("get_object_keys", "graph_internal"),
  definition("get_object_values", "graph_internal"),
  definition("stringify_object", "graph_internal"),
  definition("execute_object_script", "graph_internal"),
  definition("check_object_key_exists", "graph_internal"),
  definition("check_object_empty", "graph_internal"),
  definition("assert_output", "graph_internal"),
  definition("domain_allowlist", "graph_internal"),
  definition("quarantined", "graph_internal"),
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
  definition("get_current_url", "capture"),
  definition("read_text_file", "capture"),
  definition("parse_csv_excel", "capture"),
  definition("write_csv_excel", "capture"),
  definition("file_operation", "capture"),
  definition("http_request", "network"),
  definition("date_time_operation", "variables"),
  definition("crypto_operation", "variables"),
  definition("switch_frame", "element_interaction"),
  definition("switch_to_parent_frame", "element_interaction"),
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
