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
    case "find_element":
      return {
        type: actionType,
        config: {
          target: null,
          output_name: "element_ref",
          filter: { in_viewport: true },
          rank: "nearest_viewport_center",
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
    case "count_elements":
      return {
        type: actionType,
        config: { target: null, output_name: "element_count" },
      };
    case "extract_regex_matches":
      return {
        type: actionType,
        config: {
          source_name: "text",
          pattern: "",
          flags: "g",
          output_name: "matches",
          append: true,
          dedupe: true,
        },
      };
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
    case "write_text_file":
      return {
        type: actionType,
        config: {
          source_name: "matches",
          path: "output.txt",
          output_name: "text_file_path",
          separator: "\n",
          include_trailing_newline: true,
        },
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
    case "check_conditions":
      return {
        type: actionType,
        config: {
          output_name: "is_valid",
          mode: "visual",
          script: "",
          rules_group: {
            operator: "and",
            rules: [],
          },
          evaluation_type: "static",
        },
      };
    case "calculate_value":
      return {
        type: actionType,
        config: {
          output_name: "result",
          expression: "",
          evaluation_type: "static",
        },
      };
    case "update_number_variable":
      return {
        type: actionType,
        config: { name: "", operation: "increment", value: "" },
      };
    case "update_text_variable":
      return {
        type: actionType,
        config: { name: "", operation: "append", value: "", search_pattern: "" },
      };
    case "update_flag_variable":
      return {
        type: actionType,
        config: { name: "", operation: "toggle" },
      };
    case "update_list_variable":
      return {
        type: actionType,
        config: { name: "", operation: "push", value: "", value_type: "text", index: null },
      };
    case "create_empty_list":
      return {
        type: actionType,
        config: { output_name: "empty_list" },
      };
    case "create_list_manual":
      return {
        type: actionType,
        config: { output_name: "my_list", value_type: "text", items: [] },
      };
    case "split_text_to_list":
      return {
        type: actionType,
        config: { output_name: "split_list", source_text: "", delimiter: "," },
      };
    case "generate_number_range":
      return {
        type: actionType,
        config: { output_name: "range_list", start: 1, end: 10, step: 1 },
      };
    case "add_to_list":
      return {
        type: actionType,
        config: { name: "", position: "end", value_type: "text", value: "" },
      };
    case "remove_from_list_by_index":
      return {
        type: actionType,
        config: { name: "", index: 0 },
      };
    case "remove_from_list_by_value":
      return {
        type: actionType,
        config: { name: "", value_type: "text", value: "" },
      };
    case "merge_lists":
      return {
        type: actionType,
        config: { name: "", value: "", unique: false },
      };
    case "get_list_item":
      return {
        type: actionType,
        config: { source: "", position: "first", index: null, output_name: "list_item" },
      };
    case "get_list_length":
      return {
        type: actionType,
        config: { source: "", output_name: "list_length" },
      };
    case "slice_list":
      return {
        type: actionType,
        config: { source: "", start: 0, end: null, output_name: "sliced_list" },
      };
    case "join_list":
      return {
        type: actionType,
        config: { source: "", separator: ", ", output_name: "joined_string" },
      };
    case "filter_list":
      return {
        type: actionType,
        config: { source: "", rules_group: { operator: "and", rules: [] }, output_name: "filtered_list" },
      };
    case "map_list_property":
      return {
        type: actionType,
        config: { source: "", property_key: "", output_name: "mapped_list" },
      };
    case "sort_reverse_list":
      return {
        type: actionType,
        config: { source: "", action: "sort_asc", sort_key: "", output_name: "sorted_list" },
      };
    case "execute_list_script":
      return {
        type: actionType,
        config: { source: "", script: "return list.map(item => item);", output_name: "script_result" },
      };
    case "check_list_empty":
      return {
        type: actionType,
        config: { source: "", output_name: "is_empty" },
      };
    case "check_list_contains":
      return {
        type: actionType,
        config: { source: "", value_type: "text", value: "", output_name: "contains_item" },
      };
    case "check_list_any_match":
      return {
        type: actionType,
        config: { source: "", rules_group: { operator: "and", rules: [] }, output_name: "any_match" },
      };
    case "check_list_all_match":
      return {
        type: actionType,
        config: { source: "", rules_group: { operator: "and", rules: [] }, output_name: "all_match" },
      };
    case "create_empty_object":
      return {
        type: actionType,
        config: { output_name: "my_object" },
      };
    case "create_object_manual":
      return {
        type: actionType,
        config: { output_name: "my_object", fields: [] },
      };
    case "parse_json_to_object":
      return {
        type: actionType,
        config: { source_text: "{}", output_name: "my_object" },
      };
    case "set_object_property":
      return {
        type: actionType,
        config: { name: "", property_key: "", value_type: "text", value: "" },
      };
    case "remove_object_property":
      return {
        type: actionType,
        config: { name: "", property_key: "" },
      };
    case "merge_objects":
      return {
        type: actionType,
        config: { name: "", value: "{}", deep: false },
      };
    case "rename_object_property":
      return {
        type: actionType,
        config: { name: "", old_key: "", new_key: "" },
      };
    case "get_object_property":
      return {
        type: actionType,
        config: { source: "", property_key: "", output_name: "property_value" },
      };
    case "get_object_keys":
      return {
        type: actionType,
        config: { source: "", output_name: "object_keys" },
      };
    case "get_object_values":
      return {
        type: actionType,
        config: { source: "", output_name: "object_values" },
      };
    case "stringify_object":
      return {
        type: actionType,
        config: { source: "", output_name: "json_string" },
      };
    case "execute_object_script":
      return {
        type: actionType,
        config: { source: "", script: "return obj;", output_name: "script_result" },
      };
    case "check_object_key_exists":
      return {
        type: actionType,
        config: { source: "", property_key: "", output_name: "key_exists" },
      };
    case "check_object_empty":
      return {
        type: actionType,
        config: { source: "", output_name: "is_empty" },
      };
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
    case "graph_noop":
      return { type: actionType, config: { kind: "merge" } };
    case "if_condition":
      return {
        type: actionType,
        config: {
          condition: { kind: "variable_is_true", name: "name" },
          then_steps: [],
          else_steps: [],
        },
      };
    case "router_condition":
      return {
        type: actionType,
        config: {
          mode: "first_match",
          cases: [
            {
              id: "1",
              label: "Case 1",
              condition: { kind: "variable_is_true", name: "name" },
              steps: [],
            },
          ],
          default_steps: [],
        },
      };
    case "random_choice":
      return {
        type: actionType,
        config: {
          output_name: "random_choice",
          choices: [
            { id: "1", label: "Choice 1", weight: 1, steps: [] },
            { id: "2", label: "Choice 2", weight: 1, steps: [] },
          ],
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
          condition: { kind: "variable_is_true", name: "name" },
          max_attempts: 1,
          timeout_ms: null,
          steps: [],
        },
      };
    case "repeat_until":
      return {
        type: actionType,
        config: {
          condition: { kind: "variable_is_true", name: "name" },
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
    case "get_current_url":
      return { type: actionType, config: {} } as ActionConfig;
    case "read_text_file":
      return { type: actionType, config: { path: "", output_name: "file_content", encoding: "utf-8" } };
    case "parse_csv_excel":
      return { type: actionType, config: { path: "", output_name: "parsed_data", has_headers: true, delimiter: "," } };
    case "write_csv_excel":
      return { type: actionType, config: { path: "", source_name: "parsed_data", mode: "overwrite", has_headers: true } };
    case "file_operation":
      return { type: actionType, config: { operation: "exists", path: "", target_path: null, output_name: null } };
    case "http_request":
      return { type: actionType, config: { method: "GET", url: "", headers: null, body: null, content_type: null, timeout_ms: 30000, output_name: "http_response" } };
    case "date_time_operation":
      return { type: actionType, config: { operation: "current_timestamp", value: null, format_pattern: null, offset_value: null, offset_unit: null, output_name: "date_time_result" } };
    case "crypto_operation":
      return { type: actionType, config: { operation: "sha256", value: "", output_name: "crypto_result" } };
    case "switch_frame":
      return { type: actionType, config: { iframe_xpath: "" } };
    case "switch_to_parent_frame":
      return { type: actionType, config: {} } as ActionConfig;
  }
}
