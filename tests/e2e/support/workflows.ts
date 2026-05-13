import { expect, type Page } from "@playwright/test";
import type {
  ActionConfig,
  ElementTarget,
  RunState,
  WorkflowGraph,
} from "../../../src/types/workflow";

export function target(testId: string): ElementTarget {
  return { locators: [{ kind: "test_id", value: testId }] };
}

export function labelTarget(label: string): ElementTarget {
  return { locators: [{ kind: "label", value: label }] };
}

export async function createAndRunWorkflow(
  page: Page,
  name: string,
  steps: Array<{ id: string; label: string; config: ActionConfig }>,
) {
  return createAndRunGraph(page, name, linearGraph(steps));
}

export async function createAndRunGraph(page: Page, name: string, graph: WorkflowGraph) {
  const workflowId = await createWorkflow(page, name, graph);

  try {
    await expect
      .poll(() => runState(page), { timeout: 45_000 })
      .toMatchObject({ status: "success" });
  } catch (error) {
    const state = await runState(page);
    throw new Error(
      `Workflow did not finish successfully. Last run state: ${JSON.stringify(state)}`,
      { cause: error },
    );
  }
  return { workflowId, state: await runState(page) };
}

export async function createAndRunWorkflowExpectingFailure(
  page: Page,
  name: string,
  steps: Array<{ id: string; label: string; config: ActionConfig }>,
) {
  const graph = linearGraph(steps);
  const workflowId = await createWorkflow(page, name, graph);

  await expect
    .poll(() => runState(page), { timeout: 45_000 })
    .toMatchObject({ status: "failed" });

  return { workflowId, state: await runState(page) };
}

async function runState(page: Page): Promise<RunState> {
  return page.evaluate(async () => {
    const api = window.workflowApi;
    if (!api) throw new Error("Workflow API bridge is unavailable");
    return api.getRunState();
  });
}

async function createWorkflow(page: Page, name: string, graph: WorkflowGraph) {
  return page.evaluate(
    async ({ workflowName, workflowGraph }) => {
      const api = window.workflowApi;
      if (!api) throw new Error("Workflow API bridge is unavailable");
      const workflow = await api.createWorkflow(workflowName);
      const settings = await api.getWorkflowSettings(workflow.id);
      await api.saveWorkflowSettings(workflow.id, {
        ...settings,
        run_policy: {
          ...settings.run_policy,
          browser_retention: "close",
        },
        browser_launch: {
          ...settings.browser_launch,
          headless: true,
        },
      });
      await api.saveWorkflowGraph(workflow.id, workflowGraph);
      await api.runWorkflow(workflow.id);
      return workflow.id;
    },
    { workflowName: name, workflowGraph: graph },
  );
}

function linearGraph(
  steps: Array<{ id: string; label: string; config: ActionConfig }>,
): WorkflowGraph {
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
      ...steps.map((step, index) => ({
        id: step.id,
        node_type: "action" as const,
        label: step.label,
        position: { x: (index + 1) * 220, y: 0 },
        config: step.config,
        ports: [
          { id: "in", label: "In", direction: "input" as const },
          { id: "out", label: "Out", direction: "output" as const },
        ],
      })),
    ],
    edges: [
      ...steps.map((step, index) => ({
        id: `edge-${index === 0 ? "start" : steps[index - 1].id}-${step.id}`,
        source_node_id: index === 0 ? "start" : steps[index - 1].id,
        source_port: "out",
        target_node_id: step.id,
        target_port: "in",
      })),
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
    migration_notes: [],
  };
}
