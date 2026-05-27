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
      position: { x: 0, y: 0 },
      config: null,
      ports: [{ id: "out", label: "Out", direction: "output" }],
    },
    ...includedSteps.map((step, index): GraphNode => ({
      id: `recorded-step-${index + 1}`,
      node_type: "action",
      label: step.label,
      position: { x: NODE_X_SPACING * (index + 1), y: 0 },
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
      position: { x: NODE_X_SPACING * (includedSteps.length + 1), y: 0 },
      config: { close_browser: false },
      ports: [{ id: "in", label: "In", direction: "input" }],
    });
  }

  return {
    version: 2,
    nodes,
    edges: edgesForNodes(nodes),
    viewport: { x: 0, y: 0, zoom: 1 },
    migration_notes: [],
  };
}

function edgesForNodes(nodes: GraphNode[]): GraphEdge[] {
  const edges: GraphEdge[] = [];
  for (let index = 0; index < nodes.length - 1; index += 1) {
    const source = nodes[index];
    const target = nodes[index + 1];
    edges.push({
      id: `edge-${source.id}-${target.id}`,
      source_node_id: source.id,
      source_port: "out",
      target_node_id: target.id,
      target_port: "in",
    });
  }
  return edges;
}
