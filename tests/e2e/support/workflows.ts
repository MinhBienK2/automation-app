import { expect, type Page } from "@playwright/test";
import type {
  ActionConfig,
  ElementTarget,
  RunState,
  WorkflowBrowserRetention,
  WorkflowGraph,
} from "../../../src/types/workflow";

type E2EEnv = Record<string, string | undefined>;

export type E2EWorkflowRuntimeOverrides = {
  browserRetention: WorkflowBrowserRetention;
  headless: boolean;
  observeAfterRunMs: number;
};

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
  await observeAfterRunWhenRequested(page);
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

  await observeAfterRunWhenRequested(page);
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
  const runtimeOverrides = e2eWorkflowRuntimeOverrides();
  return page.evaluate(
    async ({ workflowName, workflowGraph, runtimeOverrides }) => {
      try {
        const api = window.workflowApi;
        if (!api) throw new Error("Workflow API bridge is unavailable");
        const workflow = await api.createWorkflow(workflowName);
        const settings = await api.getWorkflowSettings(workflow.id);
        await api.saveWorkflowSettings(workflow.id, {
          ...settings,
          run_policy: {
            ...settings.run_policy,
            browser_retention: runtimeOverrides.browserRetention,
          },
          browser_launch: {
            ...settings.browser_launch,
            headless: runtimeOverrides.headless,
          },
        });
        await api.saveWorkflowGraph(workflow.id, workflowGraph);
        await api.runWorkflow(workflow.id);
        return workflow.id;
      } catch (error) {
        if (error instanceof Error) throw error;
        throw new Error(error && typeof error === "object" ? JSON.stringify(error) : String(error));
      }
    },
    { workflowName: name, workflowGraph: graph, runtimeOverrides },
  );
}

export async function createWorkflowWithoutRun(page: Page, name: string, graph: WorkflowGraph) {
  const runtimeOverrides = e2eWorkflowRuntimeOverrides();
  return page.evaluate(
    async ({ workflowName, workflowGraph, runtimeOverrides }) => {
      try {
        const api = window.workflowApi;
        if (!api) throw new Error("Workflow API bridge is unavailable");
        const workflow = await api.createWorkflow(workflowName);
        const settings = await api.getWorkflowSettings(workflow.id);
        await api.saveWorkflowSettings(workflow.id, {
          ...settings,
          run_policy: {
            ...settings.run_policy,
            browser_retention: runtimeOverrides.browserRetention,
          },
          browser_launch: {
            ...settings.browser_launch,
            headless: runtimeOverrides.headless,
          },
        });
        await api.saveWorkflowGraph(workflow.id, workflowGraph);
        return workflow.id;
      } catch (error) {
        if (error instanceof Error) throw error;
        throw new Error(error && typeof error === "object" ? JSON.stringify(error) : String(error));
      }
    },
    { workflowName: name, workflowGraph: graph, runtimeOverrides },
  );
}

export function e2eWorkflowRuntimeOverrides(
  env: E2EEnv = process.env,
): E2EWorkflowRuntimeOverrides {
  const visibleBrowser = isTruthy(env.E2E_VISIBLE_BROWSER);
  return {
    browserRetention: visibleBrowser ? "retain" : "close",
    headless: !visibleBrowser,
    observeAfterRunMs: observeAfterRunMs(env, visibleBrowser),
  };
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

async function observeAfterRunWhenRequested(page: Page) {
  const { observeAfterRunMs } = e2eWorkflowRuntimeOverrides();
  if (observeAfterRunMs <= 0) return;
  await page.waitForTimeout(observeAfterRunMs);
}

function observeAfterRunMs(env: E2EEnv, visibleBrowser: boolean) {
  const fallback = visibleBrowser ? 1500 : 0;
  const value = env.E2E_OBSERVE_MS;
  if (!value) return fallback;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
}

function isTruthy(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(String(value ?? "").toLowerCase());
}
