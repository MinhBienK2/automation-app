/**
 * Shapes that action configs are built from: element targeting, conditions,
 * router/switch graph configs, and logic rules.
 *
 * These used to be declared roughly 1,300 lines *after* the `ActionConfig` union
 * that references them.
 */

export type HeaderPair = {
  name: string;
  value: string;
};

export type ElementLocatorKind =
  | "test_id"
  | "role"
  | "label"
  | "placeholder"
  | "text"
  | "css"
  | "xpath"
  | "attribute";

export type ElementLocator = {
  kind: ElementLocatorKind;
  value: string;
  role?: string | null;
  attribute?: string | null;
  exact?: boolean | null;
};

export type ElementTargetConstraints = {
  visible?: boolean | null;
  enabled?: boolean | null;
  contains_text?: string | null;
  index?: number | null;
};

export type ElementTarget = {
  locators: ElementLocator[];
  constraints?: ElementTargetConstraints | null;
  iframe?: ElementTarget | null;
};

export type FindElementRank = "first" | "nearest_viewport_center" | "largest_visible_area";

export type FindElementFilter = {
  in_viewport?: boolean | null;
};

export type WorkflowCondition =
  | { kind: "variable_is_true"; name: string }
  | { kind: "text_visible"; text: string }
  | { kind: "url_contains"; value: string }
  | {
      kind: "element_visible";
      xpath?: string | null;
      target?: ElementTarget | null;
      target_ref?: string | null;
    };

export type RouterGraphCase = {
  id: string;
  label: string;
  condition: WorkflowCondition;
};

export type RouterGraphConfig = {
  mode: "first_match";
  cases: RouterGraphCase[];
  default_label?: string | null;
};

/** Exported only so the `ActionConfig` union can reference it across modules. */
export type ElementTargetActionConfig = {
  xpath?: string | null;
  target?: ElementTarget | null;
  target_ref?: string | null;
  iframe_xpath?: string | null;
  wait_until?: "attached" | "visible" | "enabled" | "clickable" | null;
  timeout_ms?: number | null;
};

/** Exported only so the `ActionConfig` union can reference it across modules. */
export type DataCaptureElementConfig = {
  xpath?: string | null;
  target?: ElementTarget | null;
  target_ref?: string | null;
  iframe_xpath?: string | null;
  output_name: string;
  timeout_ms?: number | null;
  separator?: string | null;
  join_list?: boolean | null;
  join_separator?: string | null;
};

export type CheckConditionsConfig = {
  output_name: string;
  mode: "visual" | "script";
  script?: string;
  rules_group?: LogicRuleGroup;
  evaluation_type?: "static" | "dynamic";
};

export type CalculateValueConfig = {
  output_name: string;
  expression: string;
  evaluation_type?: "static" | "dynamic";
};

export type LogicRuleGroup = {
  operator: "and" | "or";
  rules: Array<LogicRule | LogicRuleGroup>;
};

export type LogicRule = {
  type: "value_compare" | "element_state" | "url_check";
  
  // value_compare
  left_operand?: string;
  comparison?:
    | "equals"
    | "not_equals"
    | "contains"
    | "not_contains"
    | "greater_than"
    | "less_than"
    | "greater_than_or_equals"
    | "less_than_or_equals"
    | "is_empty"
    | "is_not_empty"
    | "matches_regex";
  right_operand?: string;

  // element_state
  element_source?: "xpath" | "ref";
  xpath?: string;
  target_ref?: string;
  element_property?:
    | "visible"
    | "hidden"
    | "enabled"
    | "disabled"
    | "checked"
    | "unchecked";

  // url_check
  url_comparison?: "contains" | "not_contains" | "matches_regex";
  url_value?: string;
};
