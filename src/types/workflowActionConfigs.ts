/**
 * The `ActionConfig` discriminated union — one member per serialized action type.
 *
 * Still one large union with its members declared inline. Once action definitions
 * own their Zod schema (see #31), per-action config types can be inferred from
 * those schemas and live beside them, and this module goes away. Splitting it
 * further by hand first would be work thrown away.
 */

import type { ListVariableOperation } from "./actionEnums.js";
import type {
  DragTargetPosition,
  ObjectFieldAssignment,
  ScrollDirection,
  ScrollMode,
  ScrollStyle,
  VariableAssignment,
  VariableValueType,
} from "./workflowRunEnums.js";
import type {
  CalculateValueConfig,
  CheckConditionsConfig,
  DataCaptureElementConfig,
  ElementTarget,
  ElementTargetActionConfig,
  FindElementFilter,
  FindElementRank,
  HeaderPair,
  LogicRuleGroup,
  WorkflowCondition,
} from "./workflowActionShapes.js";
import type { CompiledNestedAction } from "./workflowGraphOps.js";

/**
 * What a desktop step points at, and what must hold afterwards.
 *
 * The driver never reports success reliably — `isError` has been observed true
 * for a successful click — so a desktop action confirms its own effect. Where
 * no meaningful predicate exists, the run records that it could not verify
 * rather than claiming a success it did not confirm.
 *
 * See `docs/domain/desktop/action-family.md`.
 */
export type DesktopStepTargetConfig =
  | { kind: "element"; locator: DesktopLocatorConfig }
  | { kind: "pixel"; x: number; y: number; origin: "window" };

export type DesktopNameMatchConfig = {
  kind: "exact" | "prefix" | "pattern";
  value: string;
};

export type DesktopLocatorConfig = {
  role: string;
  name?: DesktopNameMatchConfig | null;
  /** Nearest-first, named ancestors only. */
  ancestors?: Array<{ role: string; name?: DesktopNameMatchConfig | null }> | null;
  /** Positional, so a last resort. */
  ordinal?: number | null;
  automation_id?: string | null;
};

export type DesktopPredicateConfig =
  | { kind: "window_exists" }
  | { kind: "element_present"; locator: DesktopLocatorConfig }
  | { kind: "element_value"; locator: DesktopLocatorConfig; expected: string };

export type DesktopStepConfig = {
  target: DesktopStepTargetConfig;
  /** Extra predicates ANDed with the action's own default verification. */
  expect?: DesktopPredicateConfig[] | null;
  timeout_ms?: number | null;
  sensitive?: boolean | null;
};

export type ActionConfig =
  | {
      type: "navigate";
      config: {
        url: string;
        wait_until?: "load" | "dom_content_loaded" | "network_idle" | null;
        timeout_ms?: number | null;
      };
    }
  | {
      type: "wait";
      config: {
        condition:
          | "duration"
          | "element_visible"
          | "element_hidden"
          | "element_attached"
          | "element_detached"
          | "text_visible"
          | "url_contains"
          | "page_load"
          | "element_enabled"
          | "element_disabled";
        xpath?: string | null;
        text?: string | null;
        url?: string | null;
        duration_ms?: number | null;
        timeout_ms?: number | null;
        target?: ElementTarget | null;
        target_ref?: string | null;
      };
    }
  | {
      type: "random_wait";
      config: {
        min_ms: number;
        max_ms: number;
      };
    }
  | {
      type: "input_text";
      config: {
        xpath?: string | null;
        target?: ElementTarget | null;
        target_ref?: string | null;
        iframe_xpath?: string | null;
        text: string;
        clear_before_input: boolean;
        wait_until?: "attached" | "visible" | "enabled" | "clickable" | null;
        timeout_ms?: number | null;
      };
    }
  | {
      type: "clear_input";
      config: {
        xpath?: string | null;
        target?: ElementTarget | null;
        target_ref?: string | null;
        iframe_xpath?: string | null;
        wait_until?: "attached" | "visible" | "enabled" | "clickable" | null;
        timeout_ms?: number | null;
      };
    }
  | {
      type: "click";
      config: {
        xpath?: string | null;
        target?: ElementTarget | null;
        target_ref?: string | null;
        iframe_xpath?: string | null;
        wait_until?: "attached" | "visible" | "enabled" | "clickable" | null;
        timeout_ms?: number | null;
      };
    }
  | {
      type: "find_element";
      config: {
        xpath?: string | null;
        target?: ElementTarget | null;
        iframe_xpath?: string | null;
        output_name: string;
        filter?: FindElementFilter | null;
        rank?: FindElementRank | null;
        timeout_ms?: number | null;
      };
    }
  | {
      type: "scroll";
      config: {
        mode?: ScrollMode | null;
        direction?: ScrollDirection;
        pixels?: number;
        scroll_style?: ScrollStyle | null;
        xpath?: string | null;
        target?: ElementTarget | null;
        target_ref?: string | null;
        iframe_xpath?: string | null;
        timeout_ms?: number | null;
      };
    }
  | {
      type: "select_option";
      config: {
        xpath?: string | null;
        target?: ElementTarget | null;
        target_ref?: string | null;
        iframe_xpath?: string | null;
        match_by: "label" | "value";
        value: string;
        wait_until?: "attached" | "visible" | "enabled" | "clickable" | null;
        timeout_ms?: number | null;
      };
    }
  | { type: "press_key"; config: { key: string } }
  | { type: "hotkey"; config: { keys: string[] } }
  | {
      type: "hover";
      config: ElementTargetActionConfig;
    }
  | {
      type: "double_click";
      config: ElementTargetActionConfig;
    }
  | {
      type: "right_click";
      config: ElementTargetActionConfig;
    }
  | {
      type: "drag_and_drop";
      config: {
        source_xpath?: string | null;
        source_target?: ElementTarget | null;
        source_ref?: string | null;
        target_xpath?: string | null;
        target_target?: ElementTarget | null;
        target_ref?: string | null;
        target_position?: DragTargetPosition | null;
        iframe_xpath?: string | null;
        wait_until?: "attached" | "visible" | "enabled" | "clickable" | null;
        timeout_ms?: number | null;
      };
    }
  | {
      type: "focus_element";
      config: ElementTargetActionConfig;
    }
  | {
      type: "blur_element";
      config: ElementTargetActionConfig;
    }
  | {
      type: "type_sequence";
      config: {
        xpath?: string | null;
        target?: ElementTarget | null;
        target_ref?: string | null;
        iframe_xpath?: string | null;
        text: string;
        delay_ms?: number | null;
        wait_until?: "attached" | "visible" | "enabled" | "clickable" | null;
        timeout_ms?: number | null;
      };
    }
  | { type: "set_clipboard"; config: { text: string } }
  | {
      type: "paste_clipboard";
      config: ElementTargetActionConfig;
    }
  | {
      type: "check";
      config: ElementTargetActionConfig;
    }
  | {
      type: "uncheck";
      config: ElementTargetActionConfig;
    }
  | {
      type: "toggle_checkbox";
      config: ElementTargetActionConfig;
    }
  | {
      type: "select_radio";
      config: ElementTargetActionConfig;
    }
  | {
      type: "upload_file";
      config: {
        xpath?: string | null;
        target?: ElementTarget | null;
        target_ref?: string | null;
        iframe_xpath?: string | null;
        files: string[];
        wait_until?: "attached" | "visible" | "enabled" | "clickable" | null;
        timeout_ms?: number | null;
      };
    }
  | {
      type: "submit_form";
      config: {
        xpath?: string | null;
        target?: ElementTarget | null;
        target_ref?: string | null;
        iframe_xpath?: string | null;
        wait_until?: "attached" | "visible" | "enabled" | "clickable" | null;
        timeout_ms?: number | null;
      };
    }
  | {
      type: "select_custom_option";
      config: {
        trigger_xpath?: string | null;
        trigger_target?: ElementTarget | null;
        trigger_ref?: string | null;
        option_text: string;
        iframe_xpath?: string | null;
        timeout_ms?: number | null;
      };
    }
  | {
      type: "set_contenteditable";
      config: {
        xpath?: string | null;
        target?: ElementTarget | null;
        target_ref?: string | null;
        iframe_xpath?: string | null;
        text: string;
        clear_before_input: boolean;
        wait_until?: "attached" | "visible" | "enabled" | "clickable" | null;
        timeout_ms?: number | null;
      };
    }
  | {
      type: "extract_text";
      config: DataCaptureElementConfig;
    }
  | {
      type: "extract_attribute";
      config: DataCaptureElementConfig & {
        attribute: string;
      };
    }
  | {
      type: "extract_input_value";
      config: DataCaptureElementConfig;
    }
  | {
      type: "extract_table";
      config: DataCaptureElementConfig;
    }
  | {
      type: "extract_list";
      config: DataCaptureElementConfig;
    }
  | {
      type: "count_elements";
      config: DataCaptureElementConfig;
    }
  | {
      type: "extract_regex_matches";
      config: {
        source_name: string;
        pattern: string;
        flags?: string | null;
        output_name: string;
        append?: boolean | null;
        dedupe?: boolean | null;
      };
    }
  | {
      type: "extract_text_content";
      config: DataCaptureElementConfig;
    }
  | {
      type: "extract_inner_html";
      config: DataCaptureElementConfig;
    }
  | {
      type: "extract_outer_html";
      config: DataCaptureElementConfig;
    }
  | {
      type: "extract_computed_style";
      config: DataCaptureElementConfig & {
        property: string;
      };
    }
  | {
      type: "extract_all_attributes";
      config: DataCaptureElementConfig;
    }
  | {
      type: "extract_data_attributes";
      config: DataCaptureElementConfig;
    }
  | {
      type: "extract_class_list";
      config: DataCaptureElementConfig;
    }
  | {
      type: "extract_descendant_attributes";
      config: DataCaptureElementConfig;
    }
  | {
      type: "extract_select_value";
      config: DataCaptureElementConfig;
    }
  | {
      type: "extract_select_options";
      config: DataCaptureElementConfig;
    }
  | {
      type: "extract_checkbox_state";
      config: DataCaptureElementConfig;
    }
  | {
      type: "extract_form_data";
      config: DataCaptureElementConfig;
    }
  | {
      type: "extract_table_headers";
      config: DataCaptureElementConfig;
    }
  | {
      type: "extract_table_row";
      config: DataCaptureElementConfig & {
        row_index: number;
      };
    }
  | {
      type: "extract_table_column";
      config: DataCaptureElementConfig & {
        column: string;
      };
    }
  | {
      type: "extract_table_cell";
      config: DataCaptureElementConfig & {
        row: number;
        column: number;
      };
    }
  | {
      type: "extract_list_attributes";
      config: DataCaptureElementConfig & {
        attribute: string;
      };
    }
  | {
      type: "extract_structured_list";
      config: DataCaptureElementConfig & {
        mappings: Array<{
          name: string;
          selector: string;
          capture_type: string;
          attribute?: string;
        }>;
      };
    }
  | {
      type: "extract_dimensions";
      config: DataCaptureElementConfig;
    }
  | {
      type: "extract_visibility";
      config: DataCaptureElementConfig;
    }
  | {
      type: "extract_element_state";
      config: DataCaptureElementConfig;
    }
  | {
      type: "check_element_exists";
      config: DataCaptureElementConfig;
    }
  | {
      type: "get_page_title";
      config: {
        output_name: string;
        timeout_ms?: number | null;
      };
    }
  | {
      type: "get_meta_content";
      config: {
        meta_name: string;
        output_name: string;
        timeout_ms?: number | null;
      };
    }
  | {
      type: "extract_page_links";
      config: {
        output_name: string;
        timeout_ms?: number | null;
      };
    }
  | {
      type: "extract_numbers";
      config: {
        source_name: string;
        output_name: string;
      };
    }
  | {
      type: "extract_urls";
      config: {
        source_name: string;
        output_name: string;
      };
    }
  | {
      type: "extract_emails";
      config: {
        source_name: string;
        output_name: string;
      };
    }
  | {
      type: "take_screenshot";
      config: {
        path: string;
        output_name?: string | null;
        full_page: boolean;
      };
    }
  | {
      type: "write_text_file";
      config: {
        source_name: string;
        path: string;
        output_name: string;
        separator?: string | null;
        include_trailing_newline?: boolean | null;
      };
    }
  | { type: "go_back"; config: Record<string, never> }
  | { type: "go_forward"; config: Record<string, never> }
  | { type: "reload"; config: Record<string, never> }
  | { type: "open_new_tab"; config: { url?: string | null } }
  | {
      type: "open_link_in_new_tab";
      config: {
        xpath?: string | null;
        target?: ElementTarget | null;
        target_ref?: string | null;
        iframe_xpath?: string | null;
        wait_until?: "attached" | "visible" | "enabled" | "clickable" | null;
        timeout_ms?: number | null;
      };
    }
  | { type: "switch_tab"; config: { index: number } }
  | { type: "close_tab"; config: { index?: number | null } }
  | { type: "accept_dialog"; config: { prompt_text?: string | null } }
  | { type: "dismiss_dialog"; config: Record<string, never> }
  | {
      type: "wait_for_download";
      config: { output_name: string; timeout_ms?: number | null };
    }
  | {
      type: "set_variable";
      config: {
        name?: string | null;
        value?: string | null;
        value_type?: VariableValueType | null;
        variables?: VariableAssignment[];
      };
    }
  | { type: "set_json_variables"; config: { json: string } }
  | {
      type: "update_number_variable";
      config: {
        name: string;
        operation: "increment" | "decrement" | "add" | "subtract" | "multiply" | "divide";
        value?: string | null;
      };
    }
  | {
      type: "set_number_variable";
      config: {
        output_name: string;
        value: string;
      };
    }
  | {
      type: "generate_random_number";
      config: {
        output_name: string;
        min: string;
        max: string;
        integer: boolean;
      };
    }
  | {
      type: "parse_text_to_number";
      config: {
        source: string;
        fallback?: string | null;
        output_name: string;
      };
    }
  | {
      type: "math_operation";
      config: {
        operand1: string;
        operation: "add" | "subtract" | "multiply" | "divide" | "modulo" | "power" | "abs" | "sqrt" | "min" | "max";
        operand2?: string | null;
        output_name: string;
      };
    }
  | {
      type: "round_number";
      config: {
        source: string;
        mode: "round" | "floor" | "ceil";
        decimals?: string | null;
        output_name: string;
      };
    }
  | {
      type: "format_number";
      config: {
        source: string;
        format: "decimal" | "currency" | "percent";
        decimals?: string | null;
        currency_code?: string | null;
        locale?: string | null;
        output_name: string;
      };
    }
  | {
      type: "compare_numbers";
      config: {
        operand1: string;
        operator: "gt" | "gte" | "lt" | "lte" | "eq" | "neq";
        operand2: string;
        output_name: string;
      };
    }
  | {
      type: "check_number_range";
      config: {
        value: string;
        min: string;
        max: string;
        inclusive: boolean;
        output_name: string;
      };
    }
  | {
      type: "check_number_property";
      config: {
        value: string;
        property: "even" | "odd" | "integer" | "positive" | "negative";
        output_name: string;
      };
    }
  | {
      type: "update_text_variable";
      config: {
        name: string;
        operation: "append" | "prepend" | "replace" | "uppercase" | "lowercase" | "trim";
        value?: string | null;
        search_pattern?: string | null;
      };
    }
  | {
      type: "set_text_variable";
      config: {
        output_name: string;
        value?: string | null;
      };
    }
  | {
      type: "append_text";
      config: {
        name: string;
        value?: string | null;
      };
    }
  | {
      type: "prepend_text";
      config: {
        name: string;
        value?: string | null;
      };
    }
  | {
      type: "replace_text";
      config: {
        name: string;
        search_pattern: string;
        replacement?: string | null;
      };
    }
  | {
      type: "trim_text";
      config: {
        name: string;
      };
    }
  | {
      type: "change_text_case";
      config: {
        name: string;
        to_case: "upper" | "lower";
      };
    }
  | {
      type: "slice_text";
      config: {
        source: string;
        start: number | string;
        end?: number | string | null;
        output_name: string;
      };
    }
  | {
      type: "regex_extract";
      config: {
        source: string;
        pattern: string;
        group_index?: number | string | null;
        output_name: string;
      };
    }
  | {
      type: "get_text_length";
      config: {
        source: string;
        output_name: string;
      };
    }
  | {
      type: "check_text_empty";
      config: {
        source: string;
        output_name: string;
      };
    }
  | {
      type: "check_text_contains";
      config: {
        source: string;
        substring: string;
        output_name: string;
      };
    }
  | {
      type: "check_text_regex_matches";
      config: {
        source: string;
        pattern: string;
        output_name: string;
      };
    }
  | {
      type: "update_flag_variable";
      config: {
        name: string;
        operation: "toggle" | "set_true" | "set_false";
      };
    }
  | {
      type: "set_boolean_variable";
      config: {
        output_name: string;
        value: string;
      };
    }
  | {
      type: "generate_random_boolean";
      config: {
        output_name: string;
        probability?: string | number | null;
      };
    }
  | {
      type: "parse_to_boolean";
      config: {
        source: string;
        fallback?: string | null;
        output_name: string;
      };
    }
  | {
      type: "boolean_logical_op";
      config: {
        operand1: string;
        operation: "and" | "or" | "not" | "xor";
        operand2?: string | null;
        output_name: string;
      };
    }
  | {
      type: "compare_booleans";
      config: {
        operand1: string;
        operator: "eq" | "neq";
        operand2: string;
        output_name: string;
      };
    }
  | {
      type: "check_boolean_property";
      config: {
        source: string;
        property: "is_true" | "is_false";
        output_name: string;
      };
    }
  | {
      type: "update_list_variable";
      config: {
        name: string;
        operation: ListVariableOperation;
        value?: string | null;
        value_type?: VariableValueType | null;
        index?: number | string | null;
      };
    }
  | {
      type: "create_empty_list";
      config: {
        output_name: string;
      };
    }
  | {
      type: "create_list_manual";
      config: {
        output_name: string;
        value_type: VariableValueType;
        items: string[];
      };
    }
  | {
      type: "split_text_to_list";
      config: {
        output_name: string;
        source_text: string;
        delimiter: string;
      };
    }
  | {
      type: "generate_number_range";
      config: {
        output_name: string;
        start: string | number;
        end: string | number;
        step?: string | number | null;
      };
    }
  | {
      type: "add_to_list";
      config: {
        name: string;
        position: "end" | "start" | "unique_end";
        value_type: VariableValueType;
        value: string;
      };
    }
  | {
      type: "remove_from_list_by_index";
      config: {
        name: string;
        index: string | number;
      };
    }
  | {
      type: "remove_from_list_by_value";
      config: {
        name: string;
        value_type: VariableValueType;
        value: string;
      };
    }
  | {
      type: "merge_lists";
      config: {
        name: string;
        value: string;
        unique: boolean;
      };
    }
  | {
      type: "get_list_item";
      config: {
        source: string;
        position: "first" | "last" | "index";
        index?: string | number | null;
        output_name: string;
      };
    }
  | {
      type: "get_list_length";
      config: {
        source: string;
        output_name: string;
      };
    }
  | {
      type: "slice_list";
      config: {
        source: string;
        start: string | number;
        end?: string | number | null;
        output_name: string;
      };
    }
  | {
      type: "join_list";
      config: {
        source: string;
        separator: string;
        output_name: string;
      };
    }
  | {
      type: "filter_list";
      config: {
        source: string;
        rules_group?: LogicRuleGroup | null;
        output_name: string;
      };
    }
  | {
      type: "map_list_property";
      config: {
        source: string;
        property_key: string;
        output_name: string;
      };
    }
  | {
      type: "sort_reverse_list";
      config: {
        source: string;
        action: "sort_asc" | "sort_desc" | "reverse";
        sort_key?: string | null;
        output_name: string;
      };
    }
  | {
      type: "execute_list_script";
      config: {
        source: string;
        script: string;
        output_name: string;
      };
    }
  | {
      type: "check_list_empty";
      config: {
        source: string;
        output_name: string;
      };
    }
  | {
      type: "check_list_contains";
      config: {
        source: string;
        value_type: VariableValueType;
        value: string;
        output_name: string;
      };
    }
  | {
      type: "check_list_any_match";
      config: {
        source: string;
        rules_group?: LogicRuleGroup | null;
        output_name: string;
      };
    }
  | {
      type: "check_list_all_match";
      config: {
        source: string;
        rules_group?: LogicRuleGroup | null;
        output_name: string;
      };
    }
  | {
      type: "create_empty_object";
      config: {
        output_name: string;
      };
    }
  | {
      type: "create_object_manual";
      config: {
        output_name: string;
        fields: ObjectFieldAssignment[];
      };
    }
  | {
      type: "parse_json_to_object";
      config: {
        source_text: string;
        output_name: string;
      };
    }
  | {
      type: "set_object_property";
      config: {
        name: string;
        property_key: string;
        value_type: VariableValueType;
        value: string;
      };
    }
  | {
      type: "remove_object_property";
      config: {
        name: string;
        property_key: string;
      };
    }
  | {
      type: "merge_objects";
      config: {
        name: string;
        value: string;
        deep: boolean;
      };
    }
  | {
      type: "rename_object_property";
      config: {
        name: string;
        old_key: string;
        new_key: string;
      };
    }
  | {
      type: "get_object_property";
      config: {
        source: string;
        property_key: string;
        output_name: string;
      };
    }
  | {
      type: "get_object_keys";
      config: {
        source: string;
        output_name: string;
      };
    }
  | {
      type: "get_object_values";
      config: {
        source: string;
        output_name: string;
      };
    }
  | {
      type: "stringify_object";
      config: {
        source: string;
        output_name: string;
      };
    }
  | {
      type: "execute_object_script";
      config: {
        source: string;
        script: string;
        output_name: string;
      };
    }
  | {
      type: "check_object_key_exists";
      config: {
        source: string;
        property_key: string;
        output_name: string;
      };
    }
  | {
      type: "check_object_empty";
      config: {
        source: string;
        output_name: string;
      };
    }
  | {
      type: "assert_element";
      config: {
        xpath?: string | null;
        target?: ElementTarget | null;
        target_ref?: string | null;
        iframe_xpath?: string | null;
        state: "attached" | "visible" | "hidden" | "enabled" | "disabled";
        timeout_ms?: number | null;
      };
    }
  | {
      type: "assert_text";
      config: {
        xpath?: string | null;
        target?: ElementTarget | null;
        target_ref?: string | null;
        iframe_xpath?: string | null;
        text: string;
        match_mode: "contains" | "equals";
        timeout_ms?: number | null;
      };
    }
  | {
      type: "graph_noop";
      config: {
        kind: "merge";
      };
    }
  | {
      type: "if_condition";
      config: {
        condition: WorkflowCondition;
        then_steps: CompiledNestedAction[];
        else_steps: CompiledNestedAction[];
      };
    }
  | {
      type: "router_condition";
      config: {
        mode: "first_match";
        cases: Array<{
          id: string;
          label: string;
          condition: WorkflowCondition;
          steps: CompiledNestedAction[];
        }>;
        default_steps: CompiledNestedAction[];
      };
    }
  | {
      type: "random_choice";
      config: {
        output_name?: string | null;
        choices: Array<{
          id: string;
          label: string;
          weight: number;
          steps: CompiledNestedAction[];
        }>;
      };
    }
  | { type: "repeat_times"; config: { times: number; steps: CompiledNestedAction[] } }
  | {
      type: "repeat_for_each";
      config: {
        item_name: string;
        array_variable?: string | null;
        items: string[];
        steps: CompiledNestedAction[];
        start_index?: string | null;
        end_index?: string | null;
        max_loops?: string | null;
        min_loops?: string | null;
      };
    }
  | {
      type: "retry_block";
      config: {
        max_attempts: number;
        delay_ms?: number | null;
        steps: CompiledNestedAction[];
        failed_steps?: CompiledNestedAction[];
      };
    }
  | {
      type: "switch_condition";
      config: {
        expression: string;
        cases: Array<{ value: string; steps: CompiledNestedAction[] }>;
        default_steps: CompiledNestedAction[];
      };
    }
  | {
      type: "while_loop";
      config: {
        condition: WorkflowCondition;
        max_attempts?: number | null;
        timeout_ms?: number | null;
        steps: CompiledNestedAction[];
      };
    }
  | {
      type: "repeat_until";
      config: {
        condition: WorkflowCondition;
        max_attempts?: number | null;
        timeout_ms?: number | null;
        steps: CompiledNestedAction[];
        timeout_steps: CompiledNestedAction[];
      };
    }
  | {
      type: "try_catch";
      config: {
        try_steps: CompiledNestedAction[];
        success_steps: CompiledNestedAction[];
        error_steps: CompiledNestedAction[];
        finally_steps: CompiledNestedAction[];
      };
    }
  | {
      type: "fallback_block";
      config: {
        primary_steps: CompiledNestedAction[];
        fallback_steps: CompiledNestedAction[];
      };
    }
  | { type: "break_loop"; config: Record<string, never> }
  | { type: "continue_loop"; config: Record<string, never> }
  | {
      type: "stop_workflow";
      config: {
        status: "success" | "failure";
        reason?: string | null;
        close_browser?: boolean | null;
      };
    }
  | {
      type: "transform_variable";
      config: { source_name: string; target_name: string; expression: string };
    }
  | {
      type: "assert_output";
      config: { name: string; match_mode: "contains" | "equals"; value: string };
    }
  | { type: "domain_allowlist"; config: { domains: string[] } }
  | {
      type: "set_cookie";
      config: { name: string; value: string; domain?: string | null; path?: string | null };
    }
  | { type: "clear_cookies"; config: { domain?: string | null } }
  | {
      type: "set_viewport";
      config: {
        width: number;
        height: number;
      };
    }
  | {
      type: "set_geolocation";
      config: { latitude: number; longitude: number; accuracy?: number | null };
    }
  | { type: "set_extra_headers"; config: { headers: HeaderPair[] } }
  | {
      type: "grant_permission";
      config: { origin?: string | null; permissions: string[] };
    }
  | {
      type: "execute_js";
      config: { script: string; output_name?: string | null; timeout_ms?: number | null };
    }
  | {
      type: "wait_for_request";
      config: { url_contains: string; timeout_ms?: number | null };
    }
  | {
      type: "wait_for_response";
      config: { url_contains: string; status?: number | null; timeout_ms?: number | null };
    }
  | {
      type: "block_request";
      config: { url_patterns: string[] };
    }
  | {
      type: "mock_response";
      config: { url_contains: string; status: number; body: string; content_type?: string | null };
    }
  | {
      type: "set_local_storage";
      config: { key: string; value: string };
    }
  | {
      type: "set_session_storage";
      config: { key: string; value: string };
    }
  | {
      type: "get_current_url";
      config: Record<string, never>;
    }
  | {
      type: "check_conditions";
      config: CheckConditionsConfig;
    }
  | {
      type: "calculate_value";
      config: CalculateValueConfig;
    }
  | {
      type: "read_text_file";
      config: {
        path: string;
        output_name: string;
        encoding?: "utf-8" | "base64" | null;
      };
    }
  | {
      type: "parse_csv_excel";
      config: {
        path: string;
        output_name: string;
        has_headers: boolean;
        delimiter?: string | null;
      };
    }
  | {
      type: "write_csv_excel";
      config: {
        path: string;
        source_name: string;
        mode: "overwrite" | "append";
        has_headers: boolean;
      };
    }
  | {
      type: "file_operation";
      config: {
        operation: "exists" | "delete" | "rename" | "move";
        path: string;
        target_path?: string | null;
        output_name?: string | null;
      };
    }
  | {
      type: "http_request";
      config: {
        method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
        url: string;
        headers?: HeaderPair[] | null;
        body?: string | null;
        content_type?: string | null;
        output_name: string;
        timeout_ms?: number | null;
      };
    }
  | {
      type: "date_time_operation";
      config: {
        operation: "current_timestamp" | "format" | "add_subtract" | "diff";
        value?: string | null;
        format_pattern?: string | null;
        offset_value?: number | null;
        offset_unit?: "days" | "hours" | "minutes" | null;
        output_name: string;
      };
    }
  | {
      type: "crypto_operation";
      config: {
        operation: "md5" | "sha256" | "base64_encode" | "base64_decode";
        value: string;
        output_name: string;
      };
    }
  | {
      type: "switch_frame";
      config: {
        iframe_xpath: string;
      };
    }
  | {
      type: "switch_to_parent_frame";
      config: Record<string, never>;
    }
  | {
      type: "desktop_click";
      config: DesktopStepConfig & {
        button?: "left" | "right" | "middle" | null;
        count?: number | null;
      };
    }
  | {
      type: "desktop_set_value";
      config: DesktopStepConfig & { value: string };
    }
  | {
      type: "desktop_type_text";
      config: DesktopStepConfig & { text: string };
    }
  | {
      type: "desktop_press_key";
      config: DesktopStepConfig & { key: string; modifiers?: string[] | null };
    }
  | {
      type: "desktop_hotkey";
      config: DesktopStepConfig & { keys: string[] };
    }
  | {
      type: "desktop_read_text";
      config: DesktopStepConfig & { output_name: string };
    }
  | {
      type: "desktop_wait_for";
      config: DesktopStepConfig & { expect: DesktopPredicateConfig[] };
    }
  | {
      type: "desktop_screenshot";
      config: {
        output_name?: string | null;
        sensitive?: boolean | null;
        timeout_ms?: number | null;
      };
    }
  | {
      type: "desktop_focus_window";
      config: { timeout_ms?: number | null };
    }
  | {
      type: "desktop_invoke_menu";
      config: DesktopStepConfig & { path: string[] };
    }
  | {
      type: "quarantined";
      config: {
        original_type: string | null;
        reason: "unknown_type" | "invalid_config" | "parse_error";
        message: string;
        original_payload: unknown;
      };
    };
