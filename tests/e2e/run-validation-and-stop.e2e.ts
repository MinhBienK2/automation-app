import { test, expect } from "./support/electronFixture";
import {
  createAndRunGraphExpectingFailure,
  createWorkflowWithoutRun,
  linearGraph,
  runState,
  runWorkflowExpectingCommandError,
} from "./support/workflows";
import type { WorkflowGraph } from "../../src/types/workflow";

test.describe("desktop run validation, policy, and stop behavior", () => {
  test("blocks an unconfigured draft node before runner launch", async ({ appWindow }) => {
    const workflowId = await createWorkflowWithoutRun(
      appWindow,
      "E2E invalid draft graph",
      unconfiguredGraph(),
    );

    const error = await runWorkflowExpectingCommandError(appWindow, workflowId);

    expect(error).toMatchObject({
      message: expect.stringContaining("Choose an action type before running this node"),
    });
    await expect.poll(() => runState(appWindow)).toMatchObject({ status: "idle" });
  });

  test("fails navigation outside a graph domain allowlist before page navigation", async ({
    appWindow,
    fixtureServer,
  }) => {
    const { state } = await createAndRunGraphExpectingFailure(
      appWindow,
      "E2E domain allowlist block",
      domainBlockedGraph(`${fixtureServer.baseUrl}/basic`, "https://blocked.example/login"),
    );

    expect(state.error).toMatchObject({
      step_id: "navigate-blocked",
      action_type: "navigate",
      reason: expect.stringContaining("is not in the allowlist"),
    });
    expect(state.completed_step_ids).not.toContain("navigate-blocked");
  });

  test("stops a running workflow while a long wait node is active", async ({ appWindow }) => {
    const workflowId = await createWorkflowWithoutRun(
      appWindow,
      "E2E stop during wait",
      linearGraph([
        {
          id: "long-wait",
          label: "Long Wait",
          config: { type: "wait", config: { condition: "duration", duration_ms: 30_000 } },
        },
      ]),
    );

    const started = await appWindow.evaluate(async (id) => {
      const api = window.workflowApi;
      if (!api) throw new Error("Workflow API bridge is unavailable");
      return api.runWorkflow(id);
    }, workflowId);
    expect(started).toMatchObject({ status: "running" });

    await expect
      .poll(() => runState(appWindow), { timeout: 10_000 })
      .toMatchObject({ status: "running", current_step_id: "long-wait" });

    const stopped = await appWindow.evaluate(async () => {
      const api = window.workflowApi;
      if (!api) throw new Error("Workflow API bridge is unavailable");
      return api.stopRun();
    });

    expect(stopped).toMatchObject({ status: "stopped" });
    await expect.poll(() => runState(appWindow)).toMatchObject({ status: "stopped" });
  });
});

function unconfiguredGraph(): WorkflowGraph {
  return {
    version: 2,
    nodes: [
      {
        id: "start",
        node_type: "start",
        label: "Start",
        position: { x: 0, y: 0 },
        config: null,
        ports: [{ id: "out", label: "Out", direction: "output" }],
      },
      {
        id: "draft-node",
        node_type: "action",
        label: "New node",
        position: { x: 220, y: 0 },
        config: null,
        ports: [
          { id: "in", label: "In", direction: "input" },
          { id: "out", label: "Out", direction: "output" },
        ],
      },
    ],
    edges: [
      {
        id: "edge-start-draft",
        source_node_id: "start",
        source_port: "out",
        target_node_id: "draft-node",
        target_port: "in",
      },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
    migration_notes: [],
  };
}

function domainBlockedGraph(allowedUrl: string, blockedUrl: string): WorkflowGraph {
  const allowedHostname = new URL(allowedUrl).hostname;

  return {
    version: 2,
    nodes: [
      {
        id: "start",
        node_type: "start",
        label: "Start",
        position: { x: 0, y: 0 },
        config: null,
        ports: [{ id: "out", label: "Out", direction: "output" }],
      },
      {
        id: "navigate-allowed",
        node_type: "action",
        label: "Navigate Allowed",
        position: { x: 220, y: 0 },
        config: { type: "navigate", config: { url: allowedUrl } },
        ports: [
          { id: "in", label: "In", direction: "input" },
          { id: "out", label: "Out", direction: "output" },
        ],
      },
      {
        id: "allow-owned",
        node_type: "domain_allowlist",
        label: "Allow Owned Domains",
        position: { x: 440, y: 0 },
        config: { domains: [allowedHostname] },
        ports: [
          { id: "in", label: "In", direction: "input" },
          { id: "out", label: "Out", direction: "output" },
        ],
      },
      {
        id: "navigate-blocked",
        node_type: "action",
        label: "Navigate Blocked",
        position: { x: 660, y: 0 },
        config: { type: "navigate", config: { url: blockedUrl } },
        ports: [
          { id: "in", label: "In", direction: "input" },
          { id: "out", label: "Out", direction: "output" },
        ],
      },
    ],
    edges: [
      {
        id: "edge-start-allow",
        source_node_id: "start",
        source_port: "out",
        target_node_id: "navigate-allowed",
        target_port: "in",
      },
      {
        id: "edge-navigate-allow",
        source_node_id: "navigate-allowed",
        source_port: "out",
        target_node_id: "allow-owned",
        target_port: "in",
      },
      {
        id: "edge-allow-navigate",
        source_node_id: "allow-owned",
        source_port: "out",
        target_node_id: "navigate-blocked",
        target_port: "in",
      },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
    migration_notes: [],
  };
}
