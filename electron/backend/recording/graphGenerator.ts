import type {
  GraphEdge,
  GraphNode,
  ReviewedRecordingStep,
  WorkflowGraph,
} from "../../../src/types/workflow.js";

type GenerateRecordingGraphOptions = {
  addTerminalSuccess: boolean;
};

const NODE_X_SPACING = 260;
const NODE_LANE_Y_SPACING = 180;
const NODE_COLUMNS_PER_LANE = 8;

export function generateRecordingGraph(
  steps: ReviewedRecordingStep[],
  options: GenerateRecordingGraphOptions,
): WorkflowGraph {
  const includedSteps = steps.filter((step) => step.included);
  const nodes: GraphNode[] = [
    {
      id: "start",
      node_type: "start",
      label: "Start",
      position: recordingNodePosition(0),
      config: null,
      ports: [{ id: "out", label: "Out", direction: "output" }],
    },
    ...includedSteps.map((step, index): GraphNode => ({
      id: `recorded-step-${index + 1}`,
      node_type: "action",
      label: step.label,
      position: recordingNodePosition(index + 1),
      config: step.action,
      ports: [
        { id: "in", label: "In", direction: "input" },
        { id: "out", label: "Out", direction: "output" },
      ],
    })),
  ];

  if (options.addTerminalSuccess) {
    nodes.push({
      id: "recorded-end-success",
      node_type: "end_success",
      label: "End Success",
      position: recordingNodePosition(includedSteps.length + 1),
      config: { close_browser: false },
      ports: [{ id: "in", label: "In", direction: "input" }],
    });
  }

  return {
    version: 2,
    nodes,
    edges: edgesForNodes(nodes, includedSteps),
    viewport: { x: 0, y: 0, zoom: 1 },
    migration_notes: [],
  };
}

function edgesForNodes(
  nodes: GraphNode[],
  includedSteps: ReviewedRecordingStep[],
): GraphEdge[] {
  const edges: GraphEdge[] = [];
  for (let index = 0; index < nodes.length - 1; index += 1) {
    const source = nodes[index];
    const target = nodes[index + 1];
    const edge: GraphEdge = {
      id: `edge-${source.id}-${target.id}`,
      source_node_id: source.id,
      source_port: "out",
      target_node_id: target.id,
      target_port: "in",
    };
    const delay = recordedDelayBeforeTarget(index, includedSteps);
    if (delay) edge.delay = delay;
    edges.push(edge);
  }
  return edges;
}

function recordingNodePosition(index: number) {
  if (index <= 0) return { x: 0, y: 0 };
  const lane = Math.floor((index - 1) / NODE_COLUMNS_PER_LANE);
  const columnInLane = (index - 1) % NODE_COLUMNS_PER_LANE;
  const serpentineColumn =
    lane % 2 === 0
      ? columnInLane + 1
      : NODE_COLUMNS_PER_LANE - columnInLane;

  return {
    x: serpentineColumn * NODE_X_SPACING,
    y: lane * NODE_LANE_Y_SPACING,
  };
}

function recordedDelayBeforeTarget(
  sourceNodeIndex: number,
  includedSteps: ReviewedRecordingStep[],
): GraphEdge["delay"] | null {
  const targetStepIndex = sourceNodeIndex;
  if (targetStepIndex <= 0 || targetStepIndex >= includedSteps.length) {
    return null;
  }

  const previousStep = includedSteps[targetStepIndex - 1];
  const targetStep = includedSteps[targetStepIndex];
  const previousFinishedAt = timestampMs(previousStep.timing?.last_event_at);
  const targetStartedAt = timestampMs(targetStep.timing?.first_event_at);
  if (previousFinishedAt == null || targetStartedAt == null) return null;

  const durationMs = Math.round(targetStartedAt - previousFinishedAt);
  return durationMs > 0 ? { type: "fixed", duration_ms: durationMs } : null;
}

function timestampMs(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}
