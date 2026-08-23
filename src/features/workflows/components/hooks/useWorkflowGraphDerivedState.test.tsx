import { render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { SubflowSummary, WorkflowGraph } from "../../../../types/workflow";
import { idleRunState } from "../../../../tests/mocks/workflowScenarios";
import type { GraphSelection } from "../../lib/graphEditorCommands";
import { nodePorts } from "../../lib/workflowGraph";
import { useWorkflowGraphDerivedState } from "./useWorkflowGraphDerivedState";

const graph: WorkflowGraph = {
  version: 2,
  nodes: [
    {
      id: "start",
      node_type: "start",
      label: "Start",
      position: { x: 0, y: 0 },
      config: {},
      ports: nodePorts("start"),
      group_id: null,
    },
    {
      id: "call-login",
      node_type: "call_subflow",
      label: "Login",
      position: { x: 220, y: 0 },
      config: { subflow_id: "subflow-login", input_mapping: [], output_prefix: null },
      ports: nodePorts("call_subflow"),
      group_id: null,
    },
  ],
  edges: [
    {
      id: "edge-start-login",
      source_node_id: "start",
      source_port: "out",
      target_node_id: "call-login",
      target_port: "in",
      label: "next",
      condition: null,
    },
  ],
  viewport: { x: 0, y: 0, zoom: 1 },
};

const subflowOptions: SubflowSummary[] = [
  {
    id: "subflow-login",
    project_id: "project-1",
    name: "Reusable Login",
    description: "",
    tags: [],
    used_by_count: 1,
    created_at: "2026-05-27T00:00:00.000Z",
    updated_at: "2026-05-27T00:00:00.000Z",
  },
];

describe("useWorkflowGraphDerivedState", () => {
  test("derives selected graph entities and flow graph runtime state", () => {
    const onDerived = vi.fn();
    const selection: GraphSelection = { nodeIds: ["call-login"], edgeIds: [] };

    function Harness() {
      onDerived(
        useWorkflowGraphDerivedState({
          graph,
          selection,
          contextMenu: { nodeId: "call-login", x: 10, y: 20 },
          subflowOptions,
          runState: {
            ...idleRunState,
            current_step_id: "call-login",
            completed_step_ids: ["start"],
          },
          validationIssues: [
            {
              level: "warning",
              node_id: "call-login",
              message: "Check subflow mapping",
            },
          ],
        }),
      );
      return null;
    }

    render(<Harness />);

    const derived = onDerived.mock.lastCall?.[0];
    expect(derived.selectedNodeId).toBe("call-login");
    expect(derived.selectedNode?.label).toBe("Login");
    expect(derived.contextMenuSubflowName).toBe("Reusable Login");
    expect(derived.inspectorOpen).toBe(true);
    expect(derived.issueGroups.get("call-login")).toHaveLength(1);
    expect(
      derived.flowGraph.nodes.find(
        (node: { id: string; data: { status: string } }) => node.id === "call-login",
      )?.data.status,
    )
      .toBe("running");
  });
});
