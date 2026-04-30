import type {
  ActionConfig,
  ActionType,
  GraphNode,
  GraphNodeType,
  GraphPort,
  GraphPosition,
  GraphViewport,
  GraphValidationIssue,
  WorkflowGraph,
  WorkflowStep,
} from "../../../types/workflow";
import type { Edge, Node, Viewport } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";

export const graphIssueKey = "__graph__";

export type WorkflowFlowNodeStatus = "idle" | "running" | "completed" | "failed";

export type WorkflowFlowNodeData = {
  label: string;
  nodeType: GraphNodeType;
  ports: GraphPort[];
  status: WorkflowFlowNodeStatus;
  hasIssue: boolean;
};

export type WorkflowFlowEdgeData = {
  hasIssue: boolean;
};

export type WorkflowFlowNode = Node<WorkflowFlowNodeData, "workflow">;
export type WorkflowFlowEdge = Edge<WorkflowFlowEdgeData>;

type ReactFlowGraphState = {
  selectedNodeId?: string | null;
  runningNodeId?: string | null;
  completedNodeIds?: Set<string>;
  failedNodeId?: string | null;
  issueNodeIds?: Set<string>;
  issueEdgeIds?: Set<string>;
};

type WorkflowReactFlowGraph = {
  nodes: WorkflowFlowNode[];
  edges: WorkflowFlowEdge[];
  viewport: Viewport;
};

export function linearGraphFromSteps(steps: WorkflowStep[]): WorkflowGraph {
  const nodes: GraphNode[] = [
    {
      id: "start",
      node_type: "start",
      label: "Start",
      position: { x: 0, y: 0 },
      config: {},
      ports: nodePorts("start"),
      group_id: null,
    },
    ...steps.map((step, index) => ({
      id: step.id,
      node_type: "action" as const,
      label: step.name,
      position: { x: (index + 1) * 220, y: 0 },
      config: step.config,
      ports: nodePorts("action"),
      group_id: null,
    })),
    {
      id: "end_success",
      node_type: "end_success",
      label: "End Success",
      position: { x: (steps.length + 1) * 220, y: 0 },
      config: {},
      ports: nodePorts("end_success"),
      group_id: null,
    },
  ];

  const sequence = nodes.map((node) => node.id);
  const edges = sequence.slice(0, -1).map((sourceNodeId, index) => ({
    id: `edge-${sourceNodeId}-${sequence[index + 1]}`,
    source_node_id: sourceNodeId,
    source_port: "out",
    target_node_id: sequence[index + 1],
    target_port: "in",
    label: "next",
    condition: null,
  }));

  return {
    version: 1,
    nodes,
    edges,
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

export function toReactFlowGraph(
  graph: WorkflowGraph,
  state: ReactFlowGraphState = {},
): WorkflowReactFlowGraph {
  const edgeOrders = graphEdgeOrders(graph);
  const nodeLabels = new Map(graph.nodes.map((node) => [node.id, node.label]));

  return {
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      type: "workflow",
      position: node.position,
      initialHeight: 64,
      initialWidth: 160,
      dragHandle: ".graph-node-drag-handle",
      selected: state.selectedNodeId === node.id,
      data: {
        label: node.label,
        nodeType: node.node_type,
        ports: node.ports,
        status: graphNodeStatus(node.id, state),
        hasIssue: state.issueNodeIds?.has(node.id) ?? false,
      },
    })),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source_node_id,
      sourceHandle: edge.source_port,
      target: edge.target_node_id,
      targetHandle: edge.target_port,
      label: edgeOrders.get(edge.id)
        ? String(edgeOrders.get(edge.id))
        : edge.label ?? edge.source_port,
      ariaLabel: edgeOrders.get(edge.id)
        ? `Step ${edgeOrders.get(edge.id)}: ${
            nodeLabels.get(edge.source_node_id) ?? edge.source_node_id
          } to ${nodeLabels.get(edge.target_node_id) ?? edge.target_node_id} via ${
            edge.label ?? edge.source_port
          }`
        : `${nodeLabels.get(edge.source_node_id) ?? edge.source_node_id} to ${
            nodeLabels.get(edge.target_node_id) ?? edge.target_node_id
          } via ${edge.label ?? edge.source_port}`,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "rgba(62, 207, 142, 0.72)",
      },
      data: {
        hasIssue: state.issueEdgeIds?.has(edge.id) ?? false,
      },
    })),
    viewport: graph.viewport,
  };
}

export function graphEdgeOrders(graph: WorkflowGraph) {
  const orders = new Map<string, number>();
  const edgesBySource = new Map<string, typeof graph.edges>();
  graph.edges.forEach((edge) => {
    edgesBySource.set(edge.source_node_id, [
      ...(edgesBySource.get(edge.source_node_id) ?? []),
      edge,
    ]);
  });

  const visitedNodes = new Set<string>();
  const visitedEdges = new Set<string>();
  const queue = ["start"];
  let order = 1;

  while (queue.length) {
    const sourceId = queue.shift();
    if (!sourceId || visitedNodes.has(sourceId)) continue;
    visitedNodes.add(sourceId);

    for (const edge of edgesBySource.get(sourceId) ?? []) {
      if (!visitedEdges.has(edge.id)) {
        visitedEdges.add(edge.id);
        orders.set(edge.id, order);
        order += 1;
      }
      if (!visitedNodes.has(edge.target_node_id)) {
        queue.push(edge.target_node_id);
      }
    }
  }

  return orders;
}

export function fromReactFlowGraph(
  graph: WorkflowGraph,
  nodes: Array<Node>,
  edges: Array<Edge>,
  viewport: Viewport | GraphViewport,
): WorkflowGraph {
  const nodePositions = new Map(nodes.map((node) => [node.id, node.position]));
  const graphNodes = new Map(graph.nodes.map((node) => [node.id, node]));

  return {
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      position: nodePositions.get(node.id) ?? node.position,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source_node_id: edge.source,
      source_port: edge.sourceHandle ?? "out",
      target_node_id: edge.target,
      target_port: edge.targetHandle ?? "in",
      label:
        typeof edge.label === "string"
          ? cleanEdgeLabel(edge.label)
          : edge.sourceHandle ?? null,
      condition:
        graph.edges.find((graphEdge) => graphEdge.id === edge.id)?.condition ?? null,
    })).filter(
      (edge) =>
        graphNodes.has(edge.source_node_id) &&
        graphNodes.has(edge.target_node_id),
    ),
    viewport: {
      x: viewport.x,
      y: viewport.y,
      zoom: viewport.zoom,
    },
  };
}

function cleanEdgeLabel(label: string) {
  return label.replace(/^\d+\.\s+/, "");
}

export function createDefaultGraphNode(
  nodeType: GraphNodeType,
  position: GraphPosition,
): GraphNode {
  return {
    id: `node-${nodeType}-${Date.now()}`,
    node_type: nodeType,
    label: graphNodeLabel(nodeType),
    position,
    config: defaultGraphNodeConfig(nodeType),
    ports: nodePorts(nodeType),
    group_id: null,
  };
}

export function nodePorts(nodeType: GraphNodeType): GraphPort[] {
  switch (nodeType) {
    case "start":
      return [outputPort("out", "Out")];
    case "end_success":
    case "end_failure":
      return [inputPort("in", "In")];
    case "if":
      return [inputPort("in", "In"), outputPort("true", "True"), outputPort("false", "False")];
    case "switch":
      return [
        inputPort("in", "In"),
        outputPort("case_1", "Case 1"),
        outputPort("default", "Default"),
      ];
    case "repeat_times":
    case "repeat_for_each":
    case "while":
      return [inputPort("in", "In"), outputPort("loop", "Loop"), outputPort("done", "Done")];
    case "repeat_until":
      return [
        inputPort("in", "In"),
        outputPort("loop", "Loop"),
        outputPort("done", "Done"),
        outputPort("timeout", "Timeout"),
      ];
    case "try_catch":
      return [
        inputPort("in", "In"),
        outputPort("try", "Try"),
        outputPort("success", "Success"),
        outputPort("error", "Error"),
        outputPort("finally", "Finally"),
      ];
    case "retry":
      return [
        inputPort("in", "In"),
        outputPort("try", "Try"),
        outputPort("success", "Success"),
        outputPort("failed", "Failed"),
      ];
    case "fallback":
      return [
        inputPort("in", "In"),
        outputPort("primary", "Primary"),
        outputPort("fallback", "Fallback"),
        outputPort("done", "Done"),
      ];
    case "break_loop":
    case "continue_loop":
    case "stop_workflow":
      return [inputPort("in", "In")];
    default:
      return [inputPort("in", "In"), outputPort("out", "Out")];
  }
}

export function graphIssuesByNode(issues: GraphValidationIssue[]) {
  return issues.reduce((grouped, issue) => {
    const key = issue.node_id ?? graphIssueKey;
    grouped.set(key, [...(grouped.get(key) ?? []), issue]);
    return grouped;
  }, new Map<string, GraphValidationIssue[]>());
}

function graphNodeStatus(
  nodeId: string,
  state: ReactFlowGraphState,
): WorkflowFlowNodeStatus {
  if (state.failedNodeId === nodeId) return "failed";
  if (state.runningNodeId === nodeId) return "running";
  if (state.completedNodeIds?.has(nodeId)) return "completed";
  return "idle";
}

export function graphNodeLabel(nodeType: GraphNodeType) {
  return nodeType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function defaultGraphNodeConfig(nodeType: GraphNodeType): unknown {
  switch (nodeType) {
    case "action":
      return defaultActionConfig("wait");
    case "if":
      return { condition: { kind: "output_equals", name: "name", value: "" } };
    case "repeat_until":
    case "while":
      return {
        condition: { kind: "output_equals", name: "name", value: "" },
        max_attempts: 10,
        timeout_ms: null,
      };
    case "switch":
      return { expression: "", cases: ["case"] };
    case "repeat_times":
      return { times: 1 };
    case "repeat_for_each":
      return { item_name: "item", items: [] };
    case "retry":
      return { max_attempts: 3, delay_ms: 100 };
    case "manual_approval":
      return { reason: "Manual approval required", timeout_ms: null };
    case "rate_limit":
      return { delay_ms: 1000 };
    case "end_failure":
      return { reason: "Graph reached failure end" };
    case "stop_workflow":
      return { status: "success", reason: "" };
    case "set_variable":
      return { name: "variable", value: "" };
    case "transform_variable":
      return { source_name: "input", target_name: "output", expression: "" };
    case "assert_output":
      return { name: "output", match: "equals", value: "" };
    case "run_subworkflow":
      return { workflow_id: "", input_mapping: [], output_mapping: [] };
    case "domain_allowlist":
      return { domains: [] };
    default:
      return {};
  }
}

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
          text: null,
          url: null,
          duration_ms: 1000,
          timeout_ms: null,
        },
      };
    case "input_text":
      return {
        type: actionType,
        config: {
          xpath: "",
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
        config: { xpath: "", iframe_xpath: null, wait_until: null, timeout_ms: null },
      } as ActionConfig;
    case "drag_and_drop":
      return {
        type: actionType,
        config: {
          source_xpath: "",
          target_xpath: "",
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
        config: { xpath: "", iframe_xpath: null, files: [], wait_until: null, timeout_ms: null },
      };
    case "submit_form":
      return {
        type: actionType,
        config: { xpath: null, iframe_xpath: null, wait_until: null, timeout_ms: null },
      };
    case "select_custom_option":
      return {
        type: actionType,
        config: { trigger_xpath: "", option_text: "", iframe_xpath: null, timeout_ms: null },
      };
    case "set_contenteditable":
      return {
        type: actionType,
        config: {
          xpath: "",
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
        config: { xpath: "", iframe_xpath: null, output_name: actionType.replace("extract_", ""), timeout_ms: null },
      } as ActionConfig;
    case "extract_attribute":
      return {
        type: actionType,
        config: {
          xpath: "",
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
      return { type: actionType, config: { xpath: null } };
    case "accept_dialog":
      return { type: actionType, config: { prompt_text: null } };
    case "set_download_directory":
      return { type: actionType, config: { path: "" } };
    case "wait_for_download":
      return { type: actionType, config: { output_name: "download_path", timeout_ms: null } };
    case "set_variable":
      return { type: actionType, config: { name: "name", value: "" } };
    case "assert_element":
      return {
        type: actionType,
        config: { xpath: "", iframe_xpath: null, state: "visible", timeout_ms: null },
      };
    case "assert_text":
      return {
        type: actionType,
        config: { xpath: null, iframe_xpath: null, text: "", match_mode: "contains", timeout_ms: null },
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
      return { type: actionType, config: { item_name: "item", items: [], steps: [] } };
    case "retry_block":
      return { type: actionType, config: { max_attempts: 3, delay_ms: null, steps: [] } };
    case "stop_workflow":
      return { type: actionType, config: { status: "success", reason: null } };
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

function inputPort(id: string, label: string): GraphPort {
  return { id, label, direction: "input" };
}

function outputPort(id: string, label: string): GraphPort {
  return { id, label, direction: "output" };
}
