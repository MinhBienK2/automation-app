import type {
  GraphNodeType,
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
  if (!settings.run_policy?.run_from_selected_enabled) {
    return {
      enabled: false,
      reason: "Enable Run from selected in Workflow Settings Run Policy first.",
      visible: false,
    };
  }
  if (isRunning) return { enabled: false, reason: "A workflow run is already active.", visible: true };
  if (!selectedNodeId) return { enabled: false, reason: "Select one main-path node to run from.", visible: true };
  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId);
  if (!selectedNode || selectedNode.node_type === "start") {
    return { enabled: false, reason: "Select an executable graph node.", visible: true };
  }
  if (!mainPathNodeIds(graph).has(selectedNodeId)) {
    return {
      enabled: false,
      reason: "Run from selected only supports main-path nodes in this version.",
      visible: true,
    };
  }
  const retainedProfileKey = workflowBrowserProfileKey(settings);
  if (!retainedProfileKey) {
    return {
      enabled: false,
      reason: "Enable Reuse login session in Workflow Settings first.",
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

function mainContinuationPort(nodeType: GraphNodeType) {
  switch (nodeType) {
    case "start":
    case "action":
    case "set_variable":
    case "set_json_variables":
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
