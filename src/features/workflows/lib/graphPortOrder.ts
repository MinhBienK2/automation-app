import type { GraphNode } from "../../../types/workflow";

/**
 * Single source of truth for the order a graph node's output ports are walked in.
 *
 * Edge derivation, editor commands, and layout all walk output ports and must
 * agree on the order, otherwise the same graph renders and compiles differently
 * depending on which module looked at it. The per-node-type preferred ordering
 * stays private here; callers only need the ordered ids.
 */
export function orderedOutputPortIds(node: GraphNode) {
  const outputPortIds = node.ports
    .filter((port) => port.direction === "output")
    .map((port) => port.id);
  const preferred = preferredOutputPortOrder(node);
  return [
    ...preferred.filter((portId) => outputPortIds.includes(portId)),
    ...outputPortIds.filter((portId) => !preferred.includes(portId)),
  ];
}

function preferredOutputPortOrder(node: GraphNode) {
  switch (node.node_type) {
    case "start":
    case "action":
    case "merge":
    case "set_variable":
    case "set_json_variables":
    case "check_conditions":
    case "calculate_value":
    case "transform_variable":
    case "update_number_variable":
    case "update_text_variable":
    case "set_text_variable":
    case "append_text":
    case "prepend_text":
    case "replace_text":
    case "trim_text":
    case "change_text_case":
    case "slice_text":
    case "regex_extract":
    case "get_text_length":
    case "check_text_empty":
    case "check_text_contains":
    case "check_text_regex_matches":
    case "update_flag_variable":
    case "set_boolean_variable":
    case "generate_random_boolean":
    case "parse_to_boolean":
    case "boolean_logical_op":
    case "compare_booleans":
    case "check_boolean_property":
    case "update_list_variable":
    case "create_empty_list":
    case "create_list_manual":
    case "split_text_to_list":
    case "generate_number_range":
    case "add_to_list":
    case "remove_from_list_by_index":
    case "remove_from_list_by_value":
    case "merge_lists":
    case "get_list_item":
    case "get_list_length":
    case "slice_list":
    case "join_list":
    case "filter_list":
    case "map_list_property":
    case "sort_reverse_list":
    case "execute_list_script":
    case "check_list_empty":
    case "check_list_contains":
    case "check_list_any_match":
    case "check_list_all_match":
    case "create_empty_object":
    case "create_object_manual":
    case "parse_json_to_object":
    case "set_object_property":
    case "remove_object_property":
    case "merge_objects":
    case "rename_object_property":
    case "get_object_property":
    case "get_object_keys":
    case "get_object_values":
    case "stringify_object":
    case "execute_object_script":
    case "check_object_key_exists":
    case "check_object_empty":
    case "assert_output":
    case "domain_allowlist":
      return ["out"];
    case "if":
      return ["true", "false", "done"];
    case "switch":
      return [
        ...casePortIds(node),
        "default",
        "done",
      ];
    case "router":
      return [
        ...routerCasePortIds(node),
        "default",
        "done",
      ];
    case "random_choice":
      return [
        ...randomChoicePortIds(node),
        "done",
      ];
    case "repeat_times":
    case "repeat_for_each":
    case "while":
      return ["loop", "done"];
    case "repeat_until":
      return ["loop", "timeout", "done"];
    case "retry":
      return ["try", "failed", "success"];
    case "try_catch":
      return ["try", "success", "error", "finally", "done"];
    case "fallback":
      return ["primary", "fallback", "done"];
    default:
      return [];
  }
}

function casePortIds(node: GraphNode) {
  return node.ports
    .filter((port) => port.direction === "output" && /^case_\d+$/.test(port.id))
    .map((port) => port.id)
    .sort((left, right) => Number(left.slice(5)) - Number(right.slice(5)));
}

function routerCasePortIds(node: GraphNode) {
  const cases = Array.isArray((node.config as { cases?: unknown } | null)?.cases)
    ? ((node.config as { cases: Array<{ id?: unknown }> }).cases)
    : [];
  const configured = cases
    .map((caseValue) => typeof caseValue.id === "string" ? `case_${caseValue.id}` : null)
    .filter((portId): portId is string => Boolean(portId));
  const portIds = node.ports
    .filter((port) => port.direction === "output" && port.id.startsWith("case_"))
    .map((port) => port.id);
  return [
    ...configured.filter((portId) => portIds.includes(portId)),
    ...portIds.filter((portId) => !configured.includes(portId)),
  ];
}

function randomChoicePortIds(node: GraphNode) {
  const choices = Array.isArray((node.config as { choices?: unknown } | null)?.choices)
    ? ((node.config as { choices: Array<{ id?: unknown }> }).choices)
    : [];
  const configured = choices
    .map((choice) => typeof choice.id === "string" ? `choice_${choice.id}` : null)
    .filter((portId): portId is string => Boolean(portId));
  const portIds = node.ports
    .filter((port) => port.direction === "output" && port.id.startsWith("choice_"))
    .map((port) => port.id);
  return [
    ...configured.filter((portId) => portIds.includes(portId)),
    ...portIds.filter((portId) => !configured.includes(portId)),
  ];
}
