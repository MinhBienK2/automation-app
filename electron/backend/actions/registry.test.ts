// @vitest-environment node

import { describe, expect, test } from "vitest";
import {
  actionDefinitions,
  getActionDefinition,
  isKnownActionType,
  unsupportedActionTypeMessage,
} from "./registry";

describe("backend action registry", () => {
  test("registers every serialized action type with execution ownership metadata", () => {
    expect(actionDefinitions.map((definition) => definition.type)).toEqual([
      "navigate",
      "wait",
      "random_wait",
      "input_text",
      "clear_input",
      "click",
      "find_element",
      "scroll",
      "select_option",
      "press_key",
      "hotkey",
      "hover",
      "double_click",
      "right_click",
      "drag_and_drop",
      "focus_element",
      "blur_element",
      "type_sequence",
      "set_clipboard",
      "paste_clipboard",
      "check",
      "uncheck",
      "toggle_checkbox",
      "select_radio",
      "upload_file",
      "submit_form",
      "select_custom_option",
      "set_contenteditable",
      "extract_text",
      "extract_attribute",
      "extract_input_value",
      "extract_table",
      "extract_list",
      "extract_regex_matches",
      "take_screenshot",
      "write_text_file",
      "go_back",
      "go_forward",
      "reload",
      "open_new_tab",
      "switch_tab",
      "close_tab",
      "accept_dialog",
      "dismiss_dialog",
      "wait_for_download",
      "set_variable",
      "set_json_variables",
      "assert_element",
      "assert_text",
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
      "update_variable",
      "assert_output",
      "domain_allowlist",
      "set_cookie",
      "clear_cookies",
      "set_viewport",
      "set_geolocation",
      "set_extra_headers",
      "grant_permission",
      "execute_js",
      "wait_for_request",
      "wait_for_response",
      "block_request",
      "mock_response",
      "set_local_storage",
      "set_session_storage",
    ]);
    expect(getActionDefinition("execute_js")).toMatchObject({
      type: "execute_js",
      owner: "advanced",
      auditRisk: "high",
    });
    expect(getActionDefinition("if_condition")).toMatchObject({
      type: "if_condition",
      owner: "graph_internal",
      hiddenFromPalette: true,
    });
  });

  test("provides one unknown-action gate for compiler and runner defense", () => {
    expect(isKnownActionType("navigate")).toBe(true);
    expect(isKnownActionType("legacy_action")).toBe(false);
    expect(getActionDefinition("legacy_action")).toBeUndefined();
    expect(unsupportedActionTypeMessage("legacy_action")).toBe(
      "Unsupported action type: legacy_action",
    );
    expect(unsupportedActionTypeMessage("")).toBe("Unsupported action type: unknown");
  });
});
