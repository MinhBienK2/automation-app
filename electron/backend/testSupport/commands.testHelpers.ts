import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, vi } from "vitest";
import {
  createWorkflowCommandHandlers,
} from "../commands.js";
import type { WorkflowCommandHandlers } from "../commands.js";
import {
  createAppPaths,
} from "../db/database.js";
import { TestDbAdapter } from "../db/testDbAdapter.js";
import type {
  GraphNodeType,
  RunState,
  WorkflowGraph,
} from "../../../src/types/workflow.js";
import type {
  BrowserDriver,
  BrowserDriverContext,
  BrowserDriverLocator,
  BrowserDriverPage,
} from "../browser/sessionManager.js";

export type ProjectWorkflow = {
  id: string;
  name: string;
  project_id: string;
  browser_profile_id: string | null;
};
// Derived from the real factory contract so signature drift fails to compile here.
export type ProjectWorkflowTestHandlers = WorkflowCommandHandlers;

export const tempRoots: string[] = [];

afterEach(async () => {
  vi.useRealTimers();
  for (const root of tempRoots.splice(0)) {
    await fs.rm(root, { recursive: true, force: true });
  }
});

export class FakeRecordingDriver implements BrowserDriver {
  launches: Array<{ kind: "temporary" | "persistent"; options: Record<string, unknown> }> = [];

  constructor(private readonly context: FakeRecordingContext) {}

  async launch(options: Record<string, unknown>): Promise<BrowserDriverContext> {
    this.launches.push({ kind: "temporary", options });
    return this.context;
  }

  async launchPersistent(options: Record<string, unknown> & { userDataDir: string }): Promise<BrowserDriverContext> {
    this.launches.push({ kind: "persistent", options });
    return this.context;
  }
}

export class FakeRecordingContext implements BrowserDriverContext {
  closed = false;

  constructor(readonly page: FakeRecordingPage) {}

  pages(): BrowserDriverPage[] {
    return [this.page];
  }

  async newPage(): Promise<BrowserDriverPage> {
    return this.page;
  }

  async close() {
    this.closed = true;
  }
}

export class FakeRecordingPage implements BrowserDriverPage {
  gotoCalls: string[] = [];
  initScripts: string[] = [];
  bufferedPayloads: Array<Record<string, unknown>> = [];
  exposedCapture: ((payload: Record<string, unknown>) => void | Promise<void>) | null = null;
  frameNavigated: ((frame: { url(): string }) => void) | null = null;
  gotoError: Error | null = null;

  async goto(url: string) {
    this.gotoCalls.push(url);
    if (this.gotoError) throw this.gotoError;
    this.frameNavigated?.({ url: () => url });
  }

  locator(_selector: string): BrowserDriverLocator {
    throw new Error("Not implemented");
  }

  async evaluate<R = unknown, A = unknown>(
    pageFunction: string | ((arg?: A) => R | Promise<R>),
    _arg?: A,
  ): Promise<R> {
    if (typeof pageFunction === "string" && pageFunction.includes("__wamRecorderBufferedEvents.splice")) {
      return this.bufferedPayloads.splice(0) as unknown as R;
    }
    return undefined as unknown as R;
  }

  async addInitScript(script: string) {
    this.initScripts.push(script);
  }

  async exposeFunction(
    name: string,
    callback: (payload: Record<string, unknown>) => void | Promise<void>,
  ): Promise<void> {
    if (name === "__wamRecorderCapture") {
      this.exposedCapture = callback;
    }
  }

  on(eventName: string, handler: (...args: never[]) => void | Promise<void>) {
    if (eventName === "framenavigated") {
      this.frameNavigated = handler as unknown as (frame: { url(): string }) => void;
    }
  }

  async emitRecorderPayload(payload: Record<string, unknown>) {
    if (!this.exposedCapture) throw new Error("Recorder capture binding was not exposed");
    await this.exposedCapture(payload);
  }

  bufferRecorderPayload(payload: Record<string, unknown>) {
    this.bufferedPayloads.push(payload);
  }
}

export function sampleGraph(overrides: Partial<WorkflowGraph> = {}): WorkflowGraph {
  return {
    version: 2,
    nodes: [
      { id: "start", node_type: "start", label: "Start", position: { x: 0, y: 0 }, config: null, ports: [] },
      { id: "nav", node_type: "action", label: "Navigate", position: { x: 100, y: 0 }, ports: [],
        config: { type: "navigate", config: { url: "https://example.com" } } },
      { id: "end", node_type: "end_success", label: "End", position: { x: 200, y: 0 }, config: null, ports: [] },
    ],
    edges: [
      { id: "e1", source_node_id: "start", source_port: "out", target_node_id: "nav", target_port: "in" },
      { id: "e2", source_node_id: "nav", source_port: "out", target_node_id: "end", target_port: "in" },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
    migration_notes: [],
    ...overrides,
  };
}

export function runnableGraph(actionId?: string): WorkflowGraph {
  if (actionId !== undefined) {
    // Parameterized variant (package-service fixtures): a start node wired to a
    // single named wait action.
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
          id: actionId,
          node_type: "action",
          label: "Wait",
          position: { x: 200, y: 0 },
          config: { type: "wait", config: { condition: "duration", duration_ms: 100 } },
          ports: [
            { id: "in", label: "In", direction: "input" },
            { id: "out", label: "Out", direction: "output" },
          ],
        },
      ],
      edges: [
        {
          id: `start-${actionId}`,
          source_node_id: "start",
          source_port: "out",
          target_node_id: actionId,
          target_port: "in",
        },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
  }
  return {
    version: 1,
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
        id: "visit",
        node_type: "action",
        label: "Visit",
        position: { x: 200, y: 0 },
        config: { type: "navigate", config: { url: "https://owned.test" } },
        ports: [
          { id: "in", label: "In", direction: "input" },
          { id: "out", label: "Out", direction: "output" },
        ],
      },
    ],
    edges: [
      {
        id: "start-visit",
        source_node_id: "start",
        source_port: "out",
        target_node_id: "visit",
        target_port: "in",
        condition: null,
        delay: null,
        label: null,
      },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

export function workflowGraphCallingSubflow(subflowId: string): WorkflowGraph {
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
        id: "call-login",
        node_type: "call_subflow" as GraphNodeType,
        label: "Call Login",
        position: { x: 200, y: 0 },
        config: {
          subflow_id: subflowId,
          input_mapping: [{ input_name: "username", value: "{{account.username}}" }],
          output_prefix: "login",
        },
        ports: [
          { id: "in", label: "In", direction: "input" },
          { id: "out", label: "Out", direction: "output" },
        ],
      },
    ],
    edges: [
      {
        id: "start-call-login",
        source_node_id: "start",
        source_port: "out",
        target_node_id: "call-login",
        target_port: "in",
        condition: null,
        delay: null,
        label: null,
      },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

export function workflowGraphCallingSubflowThenAfter(subflowId: string): WorkflowGraph {
  const graph = workflowGraphCallingSubflow(subflowId);
  return {
    version: 2,
    nodes: [
      ...graph.nodes,
      {
        id: "after",
        node_type: "action",
        label: "After Login",
        position: { x: 420, y: 0 },
        config: { type: "wait", config: { condition: "duration", duration_ms: 1 } },
        ports: [
          { id: "in", label: "In", direction: "input" },
          { id: "out", label: "Out", direction: "output" },
        ],
      },
    ],
    edges: [
      ...graph.edges,
      {
        id: "call-login-after",
        source_node_id: "call-login",
        source_port: "out",
        target_node_id: "after",
        target_port: "in",
      },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

export function subflowGraphWithAction(nodeId: string, label: string): WorkflowGraph {
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
        id: nodeId,
        node_type: "action",
        label,
        position: { x: 220, y: 0 },
        config: {
          type: "input_text",
          config: {
            target: { locators: [{ kind: "xpath", value: "//*[@name='username']" }] },
            text: "{{username}}",
            clear_before_input: true,
            wait_until: "visible",
            timeout_ms: 60000,
          },
        },
        ports: [
          { id: "in", label: "In", direction: "input" },
          { id: "out", label: "Out", direction: "output" },
        ],
      },
    ],
    edges: [
      {
        id: `start-${nodeId}`,
        source_node_id: "start",
        source_port: "out",
        target_node_id: nodeId,
        target_port: "in",
        condition: null,
        delay: null,
        label: null,
      },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

export function startOnlyGraph(version = 1): WorkflowGraph {
  return {
    version,
    nodes: [
      {
        id: "start",
        node_type: "start",
        label: "Start",
        position: { x: 0, y: 0 },
        config: null,
        ports: [{ id: "out", label: "Out", direction: "output" }],
      },
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

export function startToEndSuccessGraph(): WorkflowGraph {
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
        id: "done",
        node_type: "end_success",
        label: "Done",
        position: { x: 220, y: 0 },
        config: { close_browser: false },
        ports: [{ id: "in", label: "In", direction: "input" }],
      },
    ],
    edges: [
      {
        id: "start-done",
        source_node_id: "start",
        source_port: "out",
        target_node_id: "done",
        target_port: "in",
        condition: null,
        delay: null,
        label: null,
      },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

export function edgeForPackage(
  source_node_id: string,
  source_port: string,
  target_node_id: string,
  target_port: string,
) {
  return {
    id: `${source_node_id}-${source_port}-${target_node_id}-${target_port}`,
    source_node_id,
    source_port,
    target_node_id,
    target_port,
    condition: null,
    delay: null,
    label: null,
  };
}

export async function createTestHandlers(
  overrides: Partial<Parameters<typeof createWorkflowCommandHandlers>[0]> = {},
) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "automation-app-"));
  tempRoots.push(tempRoot);
  const appPaths = createAppPaths(tempRoot);
  const database = await TestDbAdapter.create();
  const recorderContext = new FakeRecordingContext(new FakeRecordingPage());
  const handlers = createWorkflowCommandHandlers({
    appPaths,
    database,
    defaultFingerprintFontsDir: null,
    recorderDriver: new FakeRecordingDriver(recorderContext),
    ...overrides,
  });
  await handlers.ensureProjectModelReady();
  return { appPaths, database, handlers };
}

export async function waitForRunStatus(
  handlers: { getRunState(): RunState },
  status: RunState["status"],
) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const state = handlers.getRunState();
    if (state.status === status) return state;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`Timed out waiting for run status ${status}`);
}

export async function waitForRunSnapshotStatus(
  handlers: { listRunStates(): Array<{ run_id: string; state: RunState }> },
  runId: string,
  status: RunState["status"],
) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const state = handlers.listRunStates().find((snapshot) => snapshot.run_id === runId)?.state;
    if (state?.status === status) return state;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`Timed out waiting for run ${runId} status ${status}`);
}

export async function waitFor(predicate: () => boolean) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for predicate");
}

export async function makeTemporary(
  handlers: Awaited<ReturnType<typeof createTestHandlers>>["handlers"],
  workflowId: string,
) {
  const settings = await handlers.getWorkflowSettings(workflowId);
  await handlers.saveWorkflowSettings(workflowId, {
    ...settings,
    browser_launch: {
      ...settings.browser_launch,
      session_mode: "temporary",
      profile_name: null,
    },
  });
}
