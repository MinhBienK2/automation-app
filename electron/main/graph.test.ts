// @vitest-environment node
import { describe, expect, test } from "vitest";
import {
  compileGraphToRunPlan,
  createDraftGraph,
  validateGraph,
  type ElectronWorkflowGraph,
} from "./graph";

function configuredGraph(): ElectronWorkflowGraph {
  return {
    schemaVersion: 1,
    nodes: [
      {
        id: "start",
        type: "start",
        label: "Start",
        position: { x: 0, y: 0 },
        config: null,
        ports: { outputs: ["out"] },
      },
      {
        id: "nav",
        type: "action",
        label: "Open owned staging",
        position: { x: 240, y: 0 },
        config: {
          type: "navigate",
          url: "https://staging.example.test/login",
          timeoutMs: 10_000,
        },
        ports: { inputs: ["in"], outputs: ["out"] },
      },
      {
        id: "click",
        type: "action",
        label: "Click Login",
        position: { x: 480, y: 0 },
        config: {
          type: "click",
          locator: {
            strategy: "role",
            value: "button",
            name: "Log in",
            exact: true,
            filters: { visible: true },
            fallbacks: [],
          },
        },
        ports: { inputs: ["in"], outputs: ["out"] },
      },
    ],
    edges: [
      {
        id: "e1",
        sourceNodeId: "start",
        sourcePort: "out",
        targetNodeId: "nav",
        targetPort: "in",
      },
      {
        id: "e2",
        sourceNodeId: "nav",
        sourcePort: "out",
        targetNodeId: "click",
        targetPort: "in",
      },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
    metadata: {},
  };
}

describe("Electron graph model", () => {
  test("creates a saveable draft graph that cannot run until configured", () => {
    const graph = createDraftGraph("wf_1");

    expect(graph.nodes.map((node) => node.type)).toEqual(["start", "action"]);
    expect(graph.edges).toHaveLength(1);

    const issues = validateGraph(graph);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: "error",
          nodeId: "wf_1-draft",
          code: "missing_action_config",
        }),
      ]),
    );
  });

  test("rejects ambiguous output and input ports before compile", () => {
    const graph = configuredGraph();
    graph.edges.push({
      id: "e3",
      sourceNodeId: "start",
      sourcePort: "out",
      targetNodeId: "click",
      targetPort: "in",
    });

    const issues = validateGraph(graph);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "duplicate_output_port", edgeId: "e3" }),
        expect.objectContaining({ code: "duplicate_input_port", edgeId: "e3" }),
      ]),
    );
  });

  test("compiles valid graphs to runner-native plans while preserving node ids", () => {
    const graph = configuredGraph();

    expect(validateGraph(graph)).toEqual([]);

    const plan = compileGraphToRunPlan({
      workflowId: "wf_1",
      graphVersionId: "gv_1",
      graph,
    });

    expect(plan).toMatchObject({
      schemaVersion: 1,
      workflowId: "wf_1",
      graphVersionId: "gv_1",
    });
    expect(plan.steps.map((step) => step.sourceNodeId)).toEqual(["nav", "click"]);
    expect(plan.nodeMap).toEqual({
      nav: plan.steps[0]?.id,
      click: plan.steps[1]?.id,
    });
  });
});
