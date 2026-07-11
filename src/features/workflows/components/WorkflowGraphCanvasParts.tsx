import { useEffect } from "react";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import {
  BaseEdge,
  Handle,
  Position,
  getSmoothStepPath,
  useUpdateNodeInternals,
} from "@xyflow/react";
import type { EdgeProps, NodeProps } from "@xyflow/react";
import type { GraphNodeType, GraphPort } from "../../../types/workflow";
import {
  type WorkflowFlowEdge,
  type WorkflowFlowNode,
  type WorkflowFlowNodeStatus,
  portShape,
} from "../lib/workflowGraph";
import { graphNodeHeightForPorts } from "../lib/graphNodeDimensions";

type WorkflowGraphNodeProps = NodeProps<WorkflowFlowNode> & {
  onNodeSelect: (
    event: ReactMouseEvent | ReactPointerEvent,
    nodeId: string,
  ) => void;
  onPortPointerDown: (
    event: ReactPointerEvent,
    nodeId: string,
    port: GraphPort,
  ) => void;
  onPortPointerUp: (nodeId: string, port: GraphPort) => void;
};

export function WorkflowGraphNode({
  id,
  data,
  selected,
  isConnectable,
  onNodeSelect,
  onPortPointerDown,
  onPortPointerUp,
}: WorkflowGraphNodeProps) {
  const updateNodeInternals = useUpdateNodeInternals();
  const inputPorts = portsByDirection(data.ports, "input");
  const outputPorts = portsByDirection(data.ports, "output");
  const nodeHeight = graphNodeHeightForPorts(data.ports);

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, data.ports, nodeHeight, updateNodeInternals]);

  return (
    <div
      className={[
        "graph-node",
        graphNodeCategoryClass(data.nodeType),
        selected ? "graph-node-selected" : "",
        data.hasIssue ? "graph-node-has-issue" : "",
        graphStatusClass(data.status),
      ].filter(Boolean).join(" ")}
      style={{ height: nodeHeight, minHeight: nodeHeight }}
    >
      <span className="graph-node-type-badge">{graphNodeCategoryLabel(data.nodeType)}</span>
      <button
        type="button"
        aria-label={`Graph canvas node ${id}`}
        className="graph-node-button nodrag"
        onClick={(event) => {
          event.stopPropagation();
          onNodeSelect(event, id);
        }}
      >
        <span>{data.label}</span>
        <small>
          {[data.kindLabel, data.metaLabel].filter(Boolean).join(" · ")}
        </small>
      </button>
      <div aria-hidden="true" className="graph-node-drag-surface" />

      {inputPorts.map((port, index) => {
        const tooltip = graphPortTooltip(data.nodeType, port);
        const shape = port.shape ?? portShape(port.id);

        return (
          <Handle
            aria-label={`${data.label} ${port.label} port`}
            className={`graph-handle graph-handle-input graph-handle-${shape}`}
            data-tooltip={tooltip}
            id={port.id}
            isConnectable={isConnectable}
            key={port.id}
            onPointerUp={() => onPortPointerUp(id, port)}
            position={Position.Left}
            style={{ top: portOffset(index, inputPorts.length) }}
            type="target"
          />
        );
      })}
      {outputPorts.map((port, index) => {
        const tooltip = graphPortTooltip(data.nodeType, port);
        const shape = port.shape ?? portShape(port.id);

        return (
          <Handle
            aria-label={`${data.label} ${port.label} port`}
            className={`graph-handle graph-handle-output graph-handle-${shape}`}
            data-tooltip={tooltip}
            id={port.id}
            isConnectable={isConnectable}
            key={port.id}
            onPointerDown={(event) => onPortPointerDown(event, id, port)}
            position={Position.Right}
            style={{ top: portOffset(index, outputPorts.length) }}
            type="source"
          />
        );
      })}
    </div>
  );
}

function graphNodeCategoryClass(nodeType: GraphNodeType) {
  return `graph-node-${graphNodeCategory(nodeType)}`;
}

const dataNodeTypes = new Set<string>([
  "extract_text",
  "extract_attribute",
  "extract_input_value",
  "extract_table",
  "extract_list",
  "count_elements",
  "extract_regex_matches",
  "get_current_url",
  "extract_text_content",
  "extract_inner_html",
  "extract_outer_html",
  "extract_computed_style",
  "extract_all_attributes",
  "extract_data_attributes",
  "extract_class_list",
  "extract_descendant_attributes",
  "extract_select_value",
  "extract_select_options",
  "extract_checkbox_state",
  "extract_form_data",
  "extract_table_headers",
  "extract_table_row",
  "extract_table_column",
  "extract_table_cell",
  "extract_list_attributes",
  "extract_structured_list",
  "extract_dimensions",
  "extract_visibility",
  "extract_element_state",
  "check_element_exists",
  "get_page_title",
  "get_meta_content",
  "extract_page_links",
  "extract_numbers",
  "extract_urls",
  "extract_emails",
]);

function graphNodeCategoryLabel(nodeType: GraphNodeType) {
  switch (graphNodeCategory(nodeType)) {
    case "action":
      return "Action";
    case "logic":
      return "Logic";
    case "subflow":
      return "Subflow";
    case "variable":
      return "Variable";
    case "data":
      return "Data";
    case "end":
      return "End";
    default:
      return "Start";
  }
}

function graphNodeCategory(nodeType: GraphNodeType) {
  if (nodeType === "action") return "action";
  if (nodeType === "call_subflow") return "subflow";
  if (nodeType === "start") return "start";
  if (nodeType === "end_success" || nodeType === "end_failure" || nodeType === "stop_workflow") {
    return "end";
  }
  if (dataNodeTypes.has(nodeType)) {
    return "data";
  }
  if (
    nodeType === "set_variable" ||
    nodeType === "set_json_variables" ||
    nodeType === "update_number_variable" ||
    nodeType === "update_text_variable" ||
    nodeType === "update_flag_variable" ||
    nodeType === "update_list_variable" ||
    nodeType === "create_empty_list" ||
    nodeType === "create_list_manual" ||
    nodeType === "split_text_to_list" ||
    nodeType === "generate_number_range" ||
    nodeType === "add_to_list" ||
    nodeType === "remove_from_list_by_index" ||
    nodeType === "remove_from_list_by_value" ||
    nodeType === "merge_lists" ||
    nodeType === "get_list_item" ||
    nodeType === "get_list_length" ||
    nodeType === "slice_list" ||
    nodeType === "join_list" ||
    nodeType === "filter_list" ||
    nodeType === "map_list_property" ||
    nodeType === "sort_reverse_list" ||
    nodeType === "execute_list_script" ||
    nodeType === "check_list_empty" ||
    nodeType === "check_list_contains" ||
    nodeType === "check_list_any_match" ||
    nodeType === "check_list_all_match" ||
    nodeType === "create_empty_object" ||
    nodeType === "create_object_manual" ||
    nodeType === "parse_json_to_object" ||
    nodeType === "set_object_property" ||
    nodeType === "remove_object_property" ||
    nodeType === "merge_objects" ||
    nodeType === "rename_object_property" ||
    nodeType === "get_object_property" ||
    nodeType === "get_object_keys" ||
    nodeType === "get_object_values" ||
    nodeType === "stringify_object" ||
    nodeType === "execute_object_script" ||
    nodeType === "check_object_key_exists" ||
    nodeType === "check_object_empty" ||
    nodeType === "transform_variable" ||
    nodeType === "assert_output" ||
    nodeType === "domain_allowlist" ||
    nodeType === "check_conditions" ||
    nodeType === "calculate_value"
  ) {
    return "variable";
  }
  return "logic";
}

export function WorkflowGraphEdge({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  markerEnd,
  style,
  label,
  interactionWidth,
}: EdgeProps<WorkflowFlowEdge>) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
    offset: 32,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={style}
      label={label}
      labelX={labelX}
      labelY={labelY}
      labelShowBg
      labelBgPadding={[4, 3]}
      labelBgBorderRadius={4}
      interactionWidth={interactionWidth ?? 24}
    />
  );
}

export function graphPortTooltip(nodeType: GraphNodeType, port: GraphPort) {
  return `${port.label}: ${portUsageText(nodeType, port)} ${linkingHint(port)}`;
}

function portUsageText(nodeType: GraphNodeType, port: GraphPort) {
  if (nodeType === "start" && port.id === "out") {
    return "Start workflow from here.";
  }
  if (
    (nodeType === "end_success" || nodeType === "end_failure") &&
    port.id === "in"
  ) {
    return nodeType === "end_success"
      ? "End workflow successfully at this node."
      : "End workflow in failure at this node.";
  }
  if (nodeType === "stop_workflow" && port.id === "in") {
    return "Stop workflow with the configured status.";
  }
  if (nodeType === "break_loop" && port.id === "in") {
    return "Break out of the current loop; only use within loop body.";
  }
  if (nodeType === "continue_loop" && port.id === "in") {
    return "Skip to next iteration of the loop; only use within loop body.";
  }

  switch (nodeType) {
    case "if":
      return ifPortUsage(port);
    case "switch":
      return switchPortUsage(port);
    case "router":
      return routerPortUsage(port);
    case "random_choice":
      return randomChoicePortUsage(port);
    case "merge":
      return mergePortUsage(port);
    case "repeat_times":
    case "repeat_for_each":
    case "while":
      return loopPortUsage(port);
    case "repeat_until":
      return repeatUntilPortUsage(port);
    case "retry":
      return retryPortUsage(port);
    case "try_catch":
      return tryCatchPortUsage(port);
    case "fallback":
      return fallbackPortUsage(port);
    case "action":
      return actionPortUsage(port);
    case "set_variable":
    case "set_json_variables":
    case "update_number_variable":
    case "update_text_variable":
    case "update_flag_variable":
    case "update_list_variable":
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
    case "check_conditions":
    case "calculate_value":
      return utilityPortUsage(nodeType, port);
    default:
      return genericPortUsage(port);
  }
}

function ifPortUsage(port: GraphPort) {
  switch (port.id) {
    case "in":
      return "Receive control flow before checking condition.";
    case "true":
      return "Execute branch when condition is true; if empty, this branch is a no-op.";
    case "false":
      return "Execute branch when condition is false; if empty, this branch is a no-op.";
    case "done":
      return "Return to main flow after True or False branch completes; if empty, path ends in success.";
    default:
      return genericPortUsage(port);
  }
}

function switchPortUsage(port: GraphPort) {
  if (port.id === "in") return "Receive control flow before matching switch expression.";
  if (port.id === "default") return "Execute branch when no cases match.";
  if (port.id === "done") {
    return "Return to main flow after case or Default branch completes; if empty, path ends in success.";
  }
  if (port.id.startsWith("case_")) {
    return "Execute branch when this case matches expression; if empty, this branch is a no-op.";
  }
  return genericPortUsage(port);
}

function routerPortUsage(port: GraphPort) {
  if (port.id === "in") return "Receive control flow before Router checks cases sequentially.";
  if (port.id === "default") return "Execute branch when no Router cases match.";
  if (port.id === "done") {
    return "Return to main flow after selected Router branch completes; if empty, path ends in success.";
  }
  if (port.id.startsWith("case_")) {
    return "Execute branch for first case with matching condition; if empty, this branch is a no-op.";
  }
  return genericPortUsage(port);
}

function randomChoicePortUsage(port: GraphPort) {
  if (port.id === "in") return "Receive control flow before randomly selecting a choice by weight.";
  if (port.id === "done") {
    return "Return to main flow after selected choice completes; if empty, path ends in success.";
  }
  if (port.id.startsWith("choice_")) {
    return "Execute branch if this choice is selected; if empty, this branch is a no-op.";
  }
  return genericPortUsage(port);
}

function mergePortUsage(port: GraphPort) {
  if (port.id === "in") {
    return "Receive multiple incoming paths to a single convergence point; Merge does not wait for others.";
  }
  if (port.id === "out") {
    return "Continue from Merge when any path reaches convergence point; if empty, path ends in success.";
  }
  return genericPortUsage(port);
}

function loopPortUsage(port: GraphPort) {
  if (port.id === "in") return "Receive control flow before starting loop.";
  if (port.id === "loop") return "Execute loop body; this port must be connected before run.";
  if (port.id === "done") {
    return "Continue after loop completes; if empty, path ends in success.";
  }
  return genericPortUsage(port);
}

function repeatUntilPortUsage(port: GraphPort) {
  if (port.id === "timeout") {
    return "Execute optional branch if loop limit or timeout is reached before condition is met.";
  }
  if (port.id === "loop") {
    return "Execute body until condition is met; this port must be connected before run.";
  }
  return loopPortUsage(port);
}

function retryPortUsage(port: GraphPort) {
  switch (port.id) {
    case "in":
      return "Receive control flow before starting retry block.";
    case "try":
      return "Execute branch task to retry; this port must be connected before run.";
    case "success":
      return "Continue when Try succeeds; if empty, path ends in success.";
    case "failed":
      return "Execute optional branch when retries are exhausted; if empty, workflow fails with the last error.";
    default:
      return genericPortUsage(port);
  }
}

function tryCatchPortUsage(port: GraphPort) {
  switch (port.id) {
    case "in":
      return "Receive control flow before starting Try/Catch.";
    case "try":
      return "Execute main branch to intercept errors; this port must be connected before run.";
    case "success":
      return "Execute optional branch when Try completes successfully.";
    case "error":
      return "Execute optional branch when Try throws an error; if empty, workflow fails with the original error.";
    case "finally":
      return "Execute optional branch always running after Try, regardless of success or error.";
    case "done":
      return "Return to main flow after Try/Catch; if empty, path ends in success.";
    default:
      return genericPortUsage(port);
  }
}

function fallbackPortUsage(port: GraphPort) {
  switch (port.id) {
    case "in":
      return "Receive control flow before running fallback block.";
    case "primary":
      return "Execute main branch to try first; this port must be connected before run.";
    case "fallback":
      return "Execute optional fallback branch when Primary fails; if empty, workflow fails with Primary error.";
    case "done":
      return "Return to main flow after Primary or Fallback; if empty, path ends in success.";
    default:
      return genericPortUsage(port);
  }
}

function actionPortUsage(port: GraphPort) {
  if (port.id === "in") return "Receive control flow to run action in this node.";
  if (port.id === "out") return "Execute next node after action completes.";
  return genericPortUsage(port);
}

function utilityPortUsage(nodeType: GraphNodeType, port: GraphPort) {
  if (port.id === "in") return `Receive control flow to ${utilityNodeVerb(nodeType)}.`;
  if (port.id === "out") return `Execute next node after ${utilityNodeVerb(nodeType)} completes.`;
  return genericPortUsage(port);
}

function utilityNodeVerb(nodeType: GraphNodeType) {
  switch (nodeType) {
    case "set_variable":
      return "set variable";
    case "set_json_variables":
      return "set JSON variables";
    case "update_number_variable":
      return "update number variable";
    case "update_text_variable":
      return "update text variable";
    case "update_flag_variable":
      return "update flag variable";
    case "update_list_variable":
      return "update list variable";
    case "create_empty_object":
      return "create empty object";
    case "create_object_manual":
      return "create object manually";
    case "parse_json_to_object":
      return "parse JSON to object";
    case "set_object_property":
      return "set object property";
    case "remove_object_property":
      return "remove object property";
    case "merge_objects":
      return "merge objects";
    case "rename_object_property":
      return "rename object property";
    case "get_object_property":
      return "get object property";
    case "get_object_keys":
      return "get object keys";
    case "get_object_values":
      return "get object values";
    case "stringify_object":
      return "stringify object";
    case "execute_object_script":
      return "execute object script";
    case "check_object_key_exists":
      return "check object key exists";
    case "check_object_empty":
      return "check object empty";
    case "transform_variable":
      return "transform variable";
    case "assert_output":
      return "assert output";
    case "domain_allowlist":
      return "apply domain allowlist";
    case "check_conditions":
      return "check conditions";
    case "calculate_value":
      return "calculate value";
    default:
      return "run node";
  }
}

function genericPortUsage(port: GraphPort) {
  return port.direction === "input"
    ? "Receive control flow running from previous node."
    : "Execute next node when flow exits this node.";
}

function linkingHint(port: GraphPort) {
  return port.direction === "input"
    ? "Connect output of previous node to this port."
    : "Drag from this port to input of next node.";
}

function portsByDirection(
  ports: GraphPort[],
  direction: GraphPort["direction"],
) {
  return ports.filter((port) => port.direction === direction);
}

function portOffset(index: number, total: number) {
  return `${portOffsetRatio(index, total) * 100}%`;
}

function portOffsetRatio(index: number, total: number) {
  if (total <= 1) return 0.5;
  return (index + 1) / (total + 1);
}

function graphStatusClass(status: WorkflowFlowNodeStatus) {
  switch (status) {
    case "failed":
      return "graph-node-failed";
    case "running":
      return "graph-node-running";
    case "completed":
      return "graph-node-completed";
    default:
      return "";
  }
}
