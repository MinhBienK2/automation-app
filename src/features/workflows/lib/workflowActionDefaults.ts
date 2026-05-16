import type { ActionConfig, ActionType } from "../../../types/workflow";

export function defaultActionConfig(actionType: ActionType): ActionConfig {
  switch (actionType) {
    case "navigate":
      return { type: actionType, config: { url: "" } };
    case "wait":
      return {
        type: actionType,
        config: {
          condition: "duration",
          target: null,
          text: null,
          url: null,
          duration_ms: 1000,
        },
      };
    case "random_wait":
      return { type: actionType, config: { min_ms: 500, max_ms: 1500 } };
    case "input_text":
      return {
        type: actionType,
        config: {
          target: null,
          text: "",
          clear_before_input: true,
        },
      };
    case "clear_input":
      return {
        type: actionType,
        config: {
          target: null,
        },
      };
    case "click":
      return {
        type: actionType,
        config: {
          target: null,
        },
      };
    case "scroll":
      return {
        type: actionType,
        config: {
          mode: "page",
          direction: "down",
          pixels: 500,
        },
      };
    case "select_option":
      return {
        type: actionType,
        config: {
          target: null,
          match_by: "label",
          value: "",
        },
      };
    case "press_key":
      return { type: actionType, config: { key: "Enter" } };
    case "hotkey":
      return { type: actionType, config: { keys: ["Control", "S"] } };
    case "hover":
    case "double_click":
    case "right_click":
    case "focus_element":
    case "blur_element":
    case "paste_clipboard":
    case "check":
    case "uncheck":
    case "toggle_checkbox":
    case "select_radio":
      return {
        type: actionType,
        config: { target: null },
      } as ActionConfig;
    case "drag_and_drop":
      return {
        type: actionType,
        config: {
          source_target: null,
          target_target: null,
        },
      };
    case "type_sequence":
      return {
        type: actionType,
        config: {
          target: null,
          text: "",
        },
      };
    case "set_clipboard":
      return { type: actionType, config: { text: "" } };
    case "upload_file":
      return {
        type: actionType,
        config: { target: null, files: [] },
      };
    case "submit_form":
      return {
        type: actionType,
        config: { target: null },
      };
    case "select_custom_option":
      return {
        type: actionType,
        config: { trigger_target: null, option_text: "" },
      };
    case "set_contenteditable":
      return {
        type: actionType,
        config: {
          target: null,
          text: "",
          clear_before_input: true,
        },
      };
    case "extract_text":
    case "extract_input_value":
    case "extract_table":
    case "extract_list":
      return {
        type: actionType,
        config: { target: null, output_name: actionType.replace("extract_", "") },
      } as ActionConfig;
    case "extract_attribute":
      return {
        type: actionType,
        config: {
          target: null,
          attribute: "",
          output_name: "attribute",
        },
      };
    case "take_screenshot":
      return {
        type: actionType,
        config: { path: "", output_name: "screenshot_path", full_page: false },
      };
    case "go_back":
    case "go_forward":
    case "reload":
    case "dismiss_dialog":
      return { type: actionType, config: {} } as ActionConfig;
    case "open_new_tab":
      return { type: actionType, config: { url: null } };
    case "switch_tab":
      return { type: actionType, config: { index: 0 } };
    case "close_tab":
      return { type: actionType, config: { index: null } };
    case "accept_dialog":
      return { type: actionType, config: { prompt_text: null } };
    case "wait_for_download":
      return { type: actionType, config: { output_name: "download_path" } };
    case "set_variable":
      return {
        type: actionType,
        config: { variables: [{ name: "name", value_type: "text", value: "" }] },
      };
    case "set_json_variables":
      return { type: actionType, config: { json: "{\n  \"name\": \"value\"\n}" } };
    case "assert_element":
      return {
        type: actionType,
        config: { target: null, state: "visible" },
      };
    case "assert_text":
      return {
        type: actionType,
        config: { target: null, text: "", match_mode: "contains" },
      };
    case "if_condition":
      return {
        type: actionType,
        config: {
          condition: { kind: "output_equals", name: "name", value: "" },
          then_steps: [],
          else_steps: [],
        },
      };
    case "repeat_times":
      return { type: actionType, config: { times: 1, steps: [] } };
    case "repeat_for_each":
      return {
        type: actionType,
        config: { item_name: "item", array_variable: null, items: ["item"], steps: [] },
      };
    case "retry_block":
      return { type: actionType, config: { max_attempts: 3, delay_ms: null, steps: [] } };
    case "switch_condition":
      return {
        type: actionType,
        config: { expression: "name", cases: [], default_steps: [] },
      };
    case "while_loop":
      return {
        type: actionType,
        config: {
          condition: { kind: "output_equals", name: "name", value: "true" },
          max_attempts: 1,
          timeout_ms: null,
          steps: [],
        },
      };
    case "repeat_until":
      return {
        type: actionType,
        config: {
          condition: { kind: "output_equals", name: "name", value: "true" },
          max_attempts: 1,
          timeout_ms: null,
          steps: [],
          timeout_steps: [],
        },
      };
    case "try_catch":
      return {
        type: actionType,
        config: { try_steps: [], success_steps: [], error_steps: [], finally_steps: [] },
      };
    case "fallback_block":
      return { type: actionType, config: { primary_steps: [], fallback_steps: [] } };
    case "break_loop":
    case "continue_loop":
      return { type: actionType, config: {} };
    case "stop_workflow":
      return {
        type: actionType,
        config: { status: "success", reason: null, close_browser: false },
      };
    case "transform_variable":
      return {
        type: actionType,
        config: { source_name: "input", target_name: "output", expression: "" },
      };
    case "assert_output":
      return {
        type: actionType,
        config: { name: "output", match_mode: "equals", value: "" },
      };
    case "domain_allowlist":
      return { type: actionType, config: { domains: [] } };
    case "set_cookie":
      return { type: actionType, config: { name: "", value: "", domain: null, path: "/" } };
    case "clear_cookies":
      return { type: actionType, config: { domain: null } };
    case "set_viewport":
      return {
        type: actionType,
        config: { width: 1280, height: 720 },
      };
    case "set_geolocation":
      return { type: actionType, config: { latitude: 0, longitude: 0, accuracy: 100 } };
    case "set_extra_headers":
      return {
        type: actionType,
        config: { headers: [{ name: "X-WAM-Header", value: "value" }] },
      };
    case "grant_permission":
      return { type: actionType, config: { origin: null, permissions: ["geolocation"] } };
    case "execute_js":
      return {
        type: actionType,
        config: { script: "return document.title;", output_name: "js_result" },
      };
    case "wait_for_request":
      return { type: actionType, config: { url_contains: "/api/" } };
    case "wait_for_response":
      return {
        type: actionType,
        config: { url_contains: "/api/", status: 200 },
      };
    case "block_request":
      return { type: actionType, config: { url_patterns: ["analytics"] } };
    case "mock_response":
      return {
        type: actionType,
        config: {
          url_contains: "/api/mock",
          status: 200,
          body: "{}",
          content_type: "application/json",
        },
      };
    case "set_local_storage":
    case "set_session_storage":
      return { type: actionType, config: { key: "key", value: "value" } } as ActionConfig;
  }
}
