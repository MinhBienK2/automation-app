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
  let lastState: RunState | null = null;

  try {
    await expect
      .poll(async () => {
        lastState = await runState(page);
        return lastState;
      }, { timeout: 45_000 })
      .toMatchObject({ status: "success" });
  } catch (error) {
    const state = await runStateForError(page, lastState);
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
  return createAndRunGraphExpectingFailure(page, name, linearGraph(steps));
}

export async function createAndRunGraphExpectingFailure(
  page: Page,
  name: string,
  graph: WorkflowGraph,
) {
  const workflowId = await createWorkflow(page, name, graph);
  let lastState: RunState | null = null;

  await expect
    .poll(async () => {
      lastState = await runState(page);
      return lastState;
    }, { timeout: 45_000 })
    .toMatchObject({ status: "failed" });

  return { workflowId, state: await runState(page) };
}

export async function runState(page: Page): Promise<RunState> {
  return page.evaluate(async () => {
    const api = window.workflowApi;
    if (!api) throw new Error("Workflow API bridge is unavailable");
    return api.getRunState();
  });
}

export async function createWorkflow(page: Page, name: string, graph: WorkflowGraph) {
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

export async function createWorkflowWithoutRun(page: Page, name: string, graph: WorkflowGraph) {
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
      return workflow.id;
    },
    { workflowName: name, workflowGraph: graph },
  );
}

export async function runWorkflowExpectingCommandError(page: Page, workflowId: string) {
  return page.evaluate(async (id) => {
    const api = window.workflowApi;
    if (!api) throw new Error("Workflow API bridge is unavailable");
    try {
      await api.runWorkflow(id);
      return null;
    } catch (error) {
      return error instanceof Error
        ? { message: error.message }
        : error && typeof error === "object" && "message" in error
          ? { message: String((error as { message?: unknown }).message) }
          : { message: String(error) };
    }
  }, workflowId);
}

export function linearGraph(
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

async function runStateForError(page: Page, fallback: RunState | null) {
  try {
    return await runState(page);
  } catch (error) {
    return {
      unavailable: true,
      fallback,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
