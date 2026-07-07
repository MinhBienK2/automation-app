import type {
  RunState,
  WorkflowGraph,
  WorkflowSettings,
} from "../../../types/workflow";

export function runFromSelectedState({
  graph,
  selectedNodeId,
  settings,
  runState,
  isRunning,
}: {
  graph: WorkflowGraph;
  selectedNodeId: string | null;
  settings: WorkflowSettings | null;
  runState: RunState;
  isRunning: boolean;
}) {
  if (!settings) {
    return {
      enabled: false,
      reason: "Workflow settings are not loaded.",
      visible: false,
    };
  }
  if (isRunning) return { enabled: false, reason: "A workflow run is already active.", visible: true };
  if (!selectedNodeId) return { enabled: false, reason: "Select one node to run from.", visible: true };
  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId);
  if (!selectedNode || selectedNode.node_type === "start" || selectedNode.node_type === "merge") {
    return { enabled: false, reason: "Select an executable graph node.", visible: true };
  }
  const retainedProfileKey = workflowBrowserProfileKey(settings);
  if (!retainedProfileKey) {
    return {
      enabled: false,
      reason: "Select a persistent browser profile before using Run from selected.",
      visible: true,
    };
  }
  if (settings.run_policy?.browser_retention !== "retain") {
    return {
      enabled: false,
      reason: "Set Browser retention to retain before using Run from selected.",
      visible: true,
    };
  }
  if (
    !runState.retained_session?.available ||
    runState.retained_session.workflow_id !== settings.workflow_id ||
    runState.retained_session.profile_name !== retainedProfileKey
  ) {
    return {
      enabled: false,
      reason: "Browser session was closed. Run the workflow again to create a reusable session.",
      visible: true,
    };
  }
  return {
    enabled: true,
    reason:
      settings.run_policy.run_from_selected_mode === "selected_only"
        ? "Run only the selected node using the retained browser session."
        : "Run from the selected node using the retained browser session.",
    visible: true,
  };
}

function workflowBrowserProfileKey(settings: WorkflowSettings) {
  if (settings.browser_launch?.session_mode !== "persistent_profile") return null;
  return (
    settings.browser_launch.profile_dir?.trim() ||
    settings.browser_launch.profile_name?.trim() ||
    null
  );
}

/*
function mainPathNodeIds(graph: WorkflowGraph) {
  const ids = new Set<string>();
  let node = graph.nodes.find((candidate) => candidate.node_type === "start") ?? null;
  const visited = new Set<string>();

  while (node && !visited.has(node.id)) {
    ids.add(node.id);
    visited.add(node.id);
    const nextPort = mainContinuationPort(node.node_type);
    if (!nextPort) break;
    const currentNodeId = node.id;
    const nextId = graph.edges
      .filter((edge) => edge.source_node_id === currentNodeId && edge.source_port === nextPort)
      .sort((left, right) => left.id.localeCompare(right.id))[0]?.target_node_id;
    node = nextId
      ? graph.nodes.find((candidate) => candidate.id === nextId) ?? null
      : null;
  }

  return ids;
}
*/

/*
function mainContinuationPort(nodeType: GraphNodeType) {
  switch (nodeType) {
    case "start":
    case "action":
    case "set_variable":
    case "set_json_variables":
    case "update_number_variable":
    case "update_text_variable":
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
    case "transform_variable":
    case "assert_output":
    case "domain_allowlist":
    case "call_subflow":
    case "merge":
      return "out";
    case "if":
    case "switch":
    case "router":
    case "random_choice":
    case "repeat_times":
    case "repeat_for_each":
    case "while":
    case "repeat_until":
    case "try_catch":
    case "fallback":
      return "done";
    case "retry":
      return "success";
    default:
      return null;
  }
}
*/
