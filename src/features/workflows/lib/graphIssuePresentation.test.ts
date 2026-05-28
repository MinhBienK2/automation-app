import { describe, expect, test } from "vitest";
import type { GraphValidationIssue, RunState, WorkflowGraph } from "../../../types/workflow";
import {
  getSelectedGraphIssues,
  graphIssueStatusLabel,
  groupGraphIssuesByTarget,
  summarizeGraphHealth,
} from "./graphIssuePresentation";
import { nodePorts } from "./workflowGraph";

describe("graph issue presentation", () => {
  test("summarizes graph health and stale issue state", () => {
    const graph = graphFixture();
    const issues: GraphValidationIssue[] = [
      {
        level: "error",
        node_id: "node-empty",
        edge_id: null,
        message: "Choose an action type before running this node",
      },
      {
        level: "warning",
        node_id: null,
        edge_id: "edge-start-empty",
        message: "Link wait needs review",
      },
    ];

    expect(
      summarizeGraphHealth({
        graph,
        issues,
        issuesNeedRecheck: true,
        runState: failedRunState(),
      }),
    ).toEqual({
      totalNodes: 3,
      totalLinks: 2,
      unconfiguredActionNodes: 1,
      validationIssueCount: 2,
      errorIssueCount: 1,
      warningIssueCount: 1,
      issuesNeedRecheck: true,
      lastRunStatus: "failed",
    });
    expect(graphIssueStatusLabel({ issueCount: 2, issuesNeedRecheck: true }))
      .toBe("2 issues need recheck");
  });

  test("groups issues and returns selected node or link issues", () => {
    const issues: GraphValidationIssue[] = [
      { level: "error", node_id: "node-empty", message: "Missing config" },
      { level: "warning", edge_id: "edge-start-empty", message: "Check link" },
      { level: "error", message: "Graph has no executable path" },
    ];
    const groups = groupGraphIssuesByTarget(issues);

    expect(groups.nodeIssues.get("node-empty")?.map((issue) => issue.message))
      .toEqual(["Missing config"]);
    expect(groups.edgeIssues.get("edge-start-empty")?.map((issue) => issue.message))
      .toEqual(["Check link"]);
    expect(groups.graphIssues.map((issue) => issue.message))
      .toEqual(["Graph has no executable path"]);
    expect(getSelectedGraphIssues(groups, { nodeId: "node-empty" }))
      .toHaveLength(1);
    expect(getSelectedGraphIssues(groups, { edgeId: "edge-start-empty" }))
      .toHaveLength(1);
  });
});

function graphFixture(): WorkflowGraph {
  return {
    version: 2,
    nodes: [
      {
        id: "start",
        node_type: "start",
        label: "Start",
        position: { x: 0, y: 0 },
        config: {},
        ports: nodePorts("start"),
      },
      {
        id: "node-empty",
        node_type: "action",
        label: "New node",
        position: { x: 220, y: 0 },
        config: null,
        ports: nodePorts("action"),
      },
      {
        id: "node-wait",
        node_type: "action",
        label: "Wait",
        position: { x: 440, y: 0 },
        config: {
          type: "wait",
          config: { condition: "duration", duration_ms: 1000 },
        },
        ports: nodePorts("action"),
      },
    ],
    edges: [
      {
        id: "edge-start-empty",
        source_node_id: "start",
        source_port: "out",
        target_node_id: "node-empty",
        target_port: "in",
      },
      {
        id: "edge-empty-wait",
        source_node_id: "node-empty",
        source_port: "out",
        target_node_id: "node-wait",
        target_port: "in",
      },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function failedRunState(): RunState {
  return {
    status: "failed",
    mode: "run_workflow",
    target_step_id: null,
    current_step_id: null,
    current_step_number: null,
    completed_step_ids: ["start"],
    outputs: {},
    error: {
      step_id: "node-wait",
      step_number: 3,
      step_name: "Wait",
      action_type: "wait",
      reason: "Timed out",
    },
  };
}
