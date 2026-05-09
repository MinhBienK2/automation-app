import type { ActionConfig, ActionType } from "../../../types/workflow";

export function defaultActionConfig(actionType: ActionType): ActionConfig {
  switch (actionType) {
    case "navigate":
      return { type: actionType, config: { url: "", wait_until: null, timeout_ms: null } };
    case "wait":
      return {
        type: actionType,
        config: {
          condition: "duration",
          xpath: null,
          target: null,
          text: null,
          url: null,
          duration_ms: 1000,
          timeout_ms: null,
        },
      };
    case "random_wait":
      return { type: actionType, config: { min_ms: 500, max_ms: 1500 } };
    case "input_text":
      return {
        type: actionType,
        config: {
          xpath: "",
          target: null,
          iframe_xpath: null,
          text: "",
          clear_before_input: true,
          typing_mode: "set_value",
          delay_ms: null,
          wait_until: null,
          timeout_ms: null,
        },
      };
    case "clear_input":
      return {
        type: actionType,
        config: {
          xpath: "",
          target: null,
          iframe_xpath: null,
          method: "select_all",
          wait_until: null,
          timeout_ms: null,
        },
      };
    case "click":
      return {
        type: actionType,
        config: {
          xpath: "",
          target: null,
          iframe_xpath: null,
          mode: null,
          button: null,
          click_count: null,
          scroll_into_view: null,
          block: null,
          inline: null,
          position: null,
          offset_x: null,
          offset_y: null,
          wait_until: null,
          timeout_ms: null,
          retry_interval_ms: null,
          post_click_wait_ms: null,
        },
      };
    case "scroll":
      return {
        type: actionType,
        config: {
          mode: undefined,
          direction: "down",
          pixels: 500,
          xpath: null,
          target: null,
          iframe_xpath: null,
          behavior: null,
          block: null,
          inline: null,
          max_attempts: null,
          wait_ms: null,
        },
      };
    case "select_option":
      return {
        type: actionType,
        config: {
          xpath: "",
          target: null,
          iframe_xpath: null,
          match_by: "label",
          value: "",
          wait_until: null,
          timeout_ms: null,
        },
      };
    case "set_checkbox":
      return {
        type: actionType,
        config: {
          xpath: "",
          target: null,
          iframe_xpath: null,
          state: "checked",
          wait_until: null,
          timeout_ms: null,
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
        config: { xpath: "", target: null, iframe_xpath: null, wait_until: null, timeout_ms: null },
      } as ActionConfig;
    case "drag_and_drop":
      return {
        type: actionType,
        config: {
          source_xpath: "",
          source_target: null,
          target_xpath: "",
          target_target: null,
          iframe_xpath: null,
          wait_until: null,
          timeout_ms: null,
        },
      };
    case "type_sequence":
      return {
        type: actionType,
        config: {
          xpath: "",
          target: null,
          iframe_xpath: null,
          text: "",
          delay_ms: null,
          wait_until: null,
          timeout_ms: null,
        },
      };
    case "set_clipboard":
      return { type: actionType, config: { text: "" } };
    case "upload_file":
      return {
        type: actionType,
        config: { xpath: "", target: null, iframe_xpath: null, files: [], wait_until: null, timeout_ms: null },
      };
    case "submit_form":
      return {
        type: actionType,
        config: { xpath: null, target: null, iframe_xpath: null, wait_until: null, timeout_ms: null },
      };
    case "select_custom_option":
      return {
        type: actionType,
        config: { trigger_xpath: "", trigger_target: null, option_text: "", iframe_xpath: null, timeout_ms: null },
      };
    case "set_contenteditable":
      return {
        type: actionType,
        config: {
          xpath: "",
          target: null,
          iframe_xpath: null,
          text: "",
          clear_before_input: true,
          wait_until: null,
          timeout_ms: null,
        },
      };
    case "extract_text":
    case "extract_input_value":
    case "extract_table":
    case "extract_list":
      return {
        type: actionType,
        config: { xpath: "", target: null, iframe_xpath: null, output_name: actionType.replace("extract_", ""), timeout_ms: null },
      } as ActionConfig;
    case "extract_attribute":
      return {
        type: actionType,
        config: {
          xpath: "",
          target: null,
          iframe_xpath: null,
          attribute: "",
          output_name: "attribute",
          timeout_ms: null,
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
    case "switch_frame":
      return { type: actionType, config: { xpath: null, target: null } };
    case "accept_dialog":
      return { type: actionType, config: { prompt_text: null } };
    case "set_download_directory":
      return { type: actionType, config: { path: "" } };
    case "wait_for_download":
      return { type: actionType, config: { output_name: "download_path", timeout_ms: null } };
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
        config: { xpath: "", target: null, iframe_xpath: null, state: "visible", timeout_ms: null },
      };
    case "assert_text":
      return {
        type: actionType,
        config: { xpath: null, target: null, iframe_xpath: null, text: "", match_mode: "contains", timeout_ms: null },
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
    case "run_subworkflow":
      return {
        type: actionType,
        config: { workflow_id: "", input_mapping: [], output_mapping: [] },
      };
    case "domain_allowlist":
      return { type: actionType, config: { domains: [] } };
    case "use_profile":
      return { type: actionType, config: { name: "default" } };
    case "save_session":
    case "load_session":
      return { type: actionType, config: { path: "" } } as ActionConfig;
    case "set_cookie":
      return { type: actionType, config: { name: "", value: "", domain: null, path: "/" } };
    case "clear_cookies":
      return { type: actionType, config: { domain: null } };
    case "set_secret":
      return { type: actionType, config: { name: "secret", value: "" } };
    case "use_proxy":
      return { type: actionType, config: { server: "", username: null, password: null } };
    case "set_user_agent":
      return { type: actionType, config: { user_agent: "" } };
    case "set_viewport":
      return {
        type: actionType,
        config: { width: 1280, height: 720, device_scale_factor: 1, mobile: false, touch: false },
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
    case "detect_challenge":
      return {
        type: actionType,
        config: {
          output_name: "challenge_found",
          patterns: ["captcha", "verify you are human", "challenge"],
          timeout_ms: 1000,
        },
      };
    case "pause_for_human":
      return {
        type: actionType,
        config: { reason: "Human verification required", timeout_ms: null },
      };
    case "resume_when_condition":
      return {
        type: actionType,
        config: { condition: { kind: "text_visible", text: "Welcome" }, timeout_ms: 60000 },
      };
    case "fallback_selector":
      return {
        type: actionType,
        config: { output_name: "target_xpath", xpaths: ["//*[@id='target']"], timeout_ms: 1000 },
      };
    case "retry_step":
      return {
        type: actionType,
        config: {
          max_attempts: 3,
          delay_ms: 100,
          step: defaultActionConfig("wait"),
        },
      };
    case "checkpoint":
      return { type: actionType, config: { name: "checkpoint", screenshot_path: null } };
    case "execute_js":
      return {
        type: actionType,
        config: { script: "return document.title;", output_name: "js_result", timeout_ms: 1000 },
      };
    case "wait_for_request":
      return { type: actionType, config: { url_contains: "/api/", timeout_ms: 5000 } };
    case "wait_for_response":
      return {
        type: actionType,
        config: { url_contains: "/api/", status: 200, timeout_ms: 5000 },
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
