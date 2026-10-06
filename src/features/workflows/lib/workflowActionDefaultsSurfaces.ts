import type {
  ActionConfig,
  ActionType,
  DesktopStepTargetConfig,
} from "../../../types/workflow";

export function defaultSurfaceActionConfig(actionType: ActionType): ActionConfig | null {
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
    case "open_link_in_new_tab":
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
    case "extract_text_content":
    case "extract_inner_html":
    case "extract_outer_html":
    case "extract_all_attributes":
    case "extract_data_attributes":
    case "extract_class_list":
    case "extract_descendant_attributes":
    case "extract_select_value":
    case "extract_select_options":
    case "extract_checkbox_state":
    case "extract_form_data":
    case "extract_table_headers":
    case "extract_dimensions":
    case "extract_visibility":
    case "extract_element_state":
    case "check_element_exists":
      return {
        type: actionType,
        config: { target: null, output_name: actionType.replace("extract_", "") },
      } as ActionConfig;
    case "extract_computed_style":
      return {
        type: actionType,
        config: { target: null, property: "", output_name: "style" },
      } as ActionConfig;
    case "extract_table_row":
      return {
        type: actionType,
        config: { target: null, row_index: 0, output_name: "row" },
      } as ActionConfig;
    case "extract_table_column":
      return {
        type: actionType,
        config: { target: null, column: "", output_name: "column" },
      } as ActionConfig;
    case "extract_table_cell":
      return {
        type: actionType,
        config: { target: null, row: 0, column: 0, output_name: "cell" },
      } as ActionConfig;
    case "extract_list_attributes":
      return {
        type: actionType,
        config: { target: null, attribute: "", output_name: "list_attributes" },
      } as ActionConfig;
    case "extract_structured_list":
      return {
        type: actionType,
        config: { target: null, mappings: [], output_name: "structured_list" },
      } as ActionConfig;
    case "get_page_title":
      return {
        type: actionType,
        config: { output_name: "page_title" },
      } as ActionConfig;
    case "get_meta_content":
      return {
        type: actionType,
        config: { meta_name: "", output_name: "meta_content" },
      } as ActionConfig;
    case "extract_page_links":
      return {
        type: actionType,
        config: { output_name: "page_links" },
      } as ActionConfig;
    case "extract_numbers":
      return {
        type: actionType,
        config: { source_name: "text", output_name: "numbers" },
      } as ActionConfig;
    case "extract_urls":
      return {
        type: actionType,
        config: { source_name: "text", output_name: "urls" },
      } as ActionConfig;
    case "extract_emails":
      return {
        type: actionType,
        config: { source_name: "text", output_name: "emails" },
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
    default:
      return null;
  }
}
