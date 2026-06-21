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
  if (
    nodeType === "set_variable" ||
    nodeType === "set_json_variables" ||
    nodeType === "update_number_variable" ||
    nodeType === "update_text_variable" ||
    nodeType === "update_flag_variable" ||
    nodeType === "update_list_variable" ||
    nodeType === "update_object_variable" ||
    nodeType === "transform_variable" ||
    nodeType === "assert_output" ||
    nodeType === "domain_allowlist" ||
    nodeType === "evaluate_logic" ||
    nodeType === "evaluate_expression"
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
    return "Bắt đầu workflow từ đây.";
  }
  if (
    (nodeType === "end_success" || nodeType === "end_failure") &&
    port.id === "in"
  ) {
    return nodeType === "end_success"
      ? "Kết thúc workflow thành công tại node này."
      : "Kết thúc workflow thất bại tại node này.";
  }
  if (nodeType === "stop_workflow" && port.id === "in") {
    return "Kết thúc workflow theo trạng thái được cấu hình trong node này.";
  }
  if (nodeType === "break_loop" && port.id === "in") {
    return "Chạy lệnh thoát vòng lặp hiện tại; chỉ dùng bên trong loop body.";
  }
  if (nodeType === "continue_loop" && port.id === "in") {
    return "Chạy lệnh bỏ qua phần còn lại của lượt lặp hiện tại; chỉ dùng bên trong loop body.";
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
    case "update_object_variable":
    case "transform_variable":
    case "assert_output":
    case "domain_allowlist":
    case "evaluate_logic":
    case "evaluate_expression":
      return utilityPortUsage(nodeType, port);
    default:
      return genericPortUsage(port);
  }
}

function ifPortUsage(port: GraphPort) {
  switch (port.id) {
    case "in":
      return "Nhận luồng trước khi kiểm tra condition.";
    case "true":
      return "Chạy branch khi condition đúng; bỏ trống thì branch này no-op.";
    case "false":
      return "Chạy branch khi condition sai; bỏ trống thì branch này no-op.";
    case "done":
      return "Quay về flow chính sau khi branch True hoặc False hoàn tất; bỏ trống thì path kết thúc thành công.";
    default:
      return genericPortUsage(port);
  }
}

function switchPortUsage(port: GraphPort) {
  if (port.id === "in") return "Nhận luồng trước khi so khớp switch expression.";
  if (port.id === "default") return "Chạy branch khi không case nào khớp.";
  if (port.id === "done") {
    return "Quay về flow chính sau khi branch case hoặc Default hoàn tất; bỏ trống thì path kết thúc thành công.";
  }
  if (port.id.startsWith("case_")) {
    return "Chạy branch khi case này khớp expression; bỏ trống thì branch này no-op.";
  }
  return genericPortUsage(port);
}

function routerPortUsage(port: GraphPort) {
  if (port.id === "in") return "Nhận luồng trước khi Router kiểm tra các case theo thứ tự.";
  if (port.id === "default") return "Chạy branch khi không case Router nào khớp.";
  if (port.id === "done") {
    return "Quay về flow chính sau khi branch Router được chọn hoàn tất; bỏ trống thì path kết thúc thành công.";
  }
  if (port.id.startsWith("case_")) {
    return "Chạy branch cho case đầu tiên có condition khớp; bỏ trống thì branch này no-op.";
  }
  return genericPortUsage(port);
}

function randomChoicePortUsage(port: GraphPort) {
  if (port.id === "in") return "Nhận luồng trước khi chọn ngẫu nhiên một choice theo weight.";
  if (port.id === "done") {
    return "Quay về flow chính sau khi choice được chọn hoàn tất; bỏ trống thì path kết thúc thành công.";
  }
  if (port.id.startsWith("choice_")) {
    return "Chạy branch nếu choice này được chọn; bỏ trống thì branch này no-op.";
  }
  return genericPortUsage(port);
}

function mergePortUsage(port: GraphPort) {
  if (port.id === "in") {
    return "Nhận nhiều nhánh đi vào cùng một điểm hội tụ; Merge không chờ các nhánh khác.";
  }
  if (port.id === "out") {
    return "Chạy tiếp từ Merge khi một nhánh đã tới điểm hội tụ; bỏ trống thì path kết thúc thành công.";
  }
  return genericPortUsage(port);
}

function loopPortUsage(port: GraphPort) {
  if (port.id === "in") return "Nhận luồng trước khi bắt đầu vòng lặp.";
  if (port.id === "loop") return "Chạy body của vòng lặp; port này cần được nối trước khi run.";
  if (port.id === "done") {
    return "Chạy tiếp sau khi vòng lặp hoàn tất; bỏ trống thì path kết thúc thành công.";
  }
  return genericPortUsage(port);
}

function repeatUntilPortUsage(port: GraphPort) {
  if (port.id === "timeout") {
    return "Chạy branch optional khi vòng lặp hết giới hạn hoặc timeout trước khi condition đạt.";
  }
  if (port.id === "loop") {
    return "Chạy body cho tới khi condition đạt; port này cần được nối trước khi run.";
  }
  return loopPortUsage(port);
}

function retryPortUsage(port: GraphPort) {
  switch (port.id) {
    case "in":
      return "Nhận luồng trước khi bắt đầu retry block.";
    case "try":
      return "Chạy branch công việc cần thử lại; port này cần được nối trước khi run.";
    case "success":
      return "Chạy tiếp khi Try thành công; bỏ trống thì path kết thúc thành công.";
    case "failed":
      return "Chạy branch optional khi hết lượt retry; bỏ trống thì workflow fail với lỗi cuối.";
    default:
      return genericPortUsage(port);
  }
}

function tryCatchPortUsage(port: GraphPort) {
  switch (port.id) {
    case "in":
      return "Nhận luồng trước khi bắt đầu Try/Catch.";
    case "try":
      return "Chạy branch chính cần bắt lỗi; port này cần được nối trước khi run.";
    case "success":
      return "Chạy branch optional khi Try hoàn tất thành công.";
    case "error":
      return "Chạy branch optional khi Try lỗi; bỏ trống thì workflow fail với lỗi gốc.";
    case "finally":
      return "Chạy branch optional luôn chạy sau Try, dù thành công hay lỗi.";
    case "done":
      return "Quay về flow chính sau Try/Catch; bỏ trống thì path kết thúc thành công.";
    default:
      return genericPortUsage(port);
  }
}

function fallbackPortUsage(port: GraphPort) {
  switch (port.id) {
    case "in":
      return "Nhận luồng trước khi chạy fallback block.";
    case "primary":
      return "Chạy branch chính cần thử trước; port này cần được nối trước khi run.";
    case "fallback":
      return "Chạy branch dự phòng optional khi Primary lỗi; bỏ trống thì workflow fail với lỗi Primary.";
    case "done":
      return "Quay về flow chính sau Primary hoặc Fallback; bỏ trống thì path kết thúc thành công.";
    default:
      return genericPortUsage(port);
  }
}

function actionPortUsage(port: GraphPort) {
  if (port.id === "in") return "Nhận luồng để chạy action trong node này.";
  if (port.id === "out") return "Chạy node tiếp theo sau khi action hoàn tất.";
  return genericPortUsage(port);
}

function utilityPortUsage(nodeType: GraphNodeType, port: GraphPort) {
  if (port.id === "in") return `Nhận luồng để ${utilityNodeVerb(nodeType)}.`;
  if (port.id === "out") return `Chạy node tiếp theo sau khi ${utilityNodeVerb(nodeType)} hoàn tất.`;
  return genericPortUsage(port);
}

function utilityNodeVerb(nodeType: GraphNodeType) {
  switch (nodeType) {
    case "set_variable":
      return "ghi biến";
    case "set_json_variables":
      return "ghi biến từ JSON";
    case "update_number_variable":
      return "cập nhật biến số";
    case "update_text_variable":
      return "cập nhật biến chữ";
    case "update_flag_variable":
      return "cập nhật biến flag";
    case "update_list_variable":
      return "cập nhật biến danh sách";
    case "update_object_variable":
      return "cập nhật biến đối tượng";
    case "transform_variable":
      return "biến đổi biến";
    case "assert_output":
      return "kiểm tra output";
    case "domain_allowlist":
      return "áp dụng domain allowlist";
    case "evaluate_logic":
      return "kiểm tra điều kiện";
    case "evaluate_expression":
      return "đánh giá biểu thức";
    default:
      return "chạy node";
  }
}

function genericPortUsage(port: GraphPort) {
  return port.direction === "input"
    ? "Nhận luồng chạy từ node trước."
    : "Chạy node tiếp theo khi luồng đi ra từ node này.";
}

function linkingHint(port: GraphPort) {
  return port.direction === "input"
    ? "Nối output của node trước vào port này."
    : "Kéo từ port này sang input của node kế tiếp.";
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
