// @vitest-environment node

import { describe, expect, test, vi } from "vitest";
import type {
  CompiledWorkflowGraph,
  WorkflowGraph,
  WorkflowSettings,
  WorkflowSummary,
} from "../../../src/types/workflow";
import { RunManager, idleRunState } from "./runManager.js";
import { TestDbAdapter } from "../db/testDbAdapter.js";

/**
 * The desktop half of the run lifecycle: which surface a run opens, and the
 * Desktop Target lock.
 *
 * The surface itself is a stub. What is under test is that the run lifecycle
 * asks for one at all, and that two runs cannot drive the same application at
 * once — the failure that produces interleaved keystrokes in a shared window.
 */

function desktopWorkflow(id: string, targetId: string | null): WorkflowSummary {
  return {
    id,
    name: `Desktop ${id}`,
    surface: "desktop",
    step_count: 1,
    desktop_target_id: targetId,
    created_at: "2026-08-15T00:00:00.000Z",
    updated_at: "2026-08-15T00:00:00.000Z",
  };
}

function settingsFor(workflowId: string): WorkflowSettings {
  return {
    workflow_id: workflowId,
    version: 2,
    general: { name: "Workflow", description: "", tags: [], notes: "" },
    browser_launch: {
      profile_name: null,
      headless: true,
      proxy_enabled: false,
      proxy_server: null,
      proxy_username: null,
      proxy_password: null,
    },
    run_policy: { browser_retention: "close", max_workflow_duration_ms: null },
    environment: { initial_variables: [] },
    graph_defaults: {
      default_edge_delay: null,
      live_run_enabled: false,
      live_run_follow_current: false,
    },
  } as unknown as WorkflowSettings;
}

const GRAPH: WorkflowGraph = { version: 2, nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };
const COMPILED: CompiledWorkflowGraph = {
  steps: [{ node_id: "wait", label: "Wait", config: { type: "wait", config: { duration_ms: 1 } } }],
};

async function seedWorkflow(database: TestDbAdapter, workflow: WorkflowSummary) {
  await database.execute(
    `INSERT INTO workflows (id, name, description, tags_json, settings_json, surface, desktop_target_id, created_at, updated_at, owner_id)
     VALUES ($1, $2, '', '[]', $3, $4, $5, $6, $7, $8)`,
    [
      workflow.id,
      workflow.name,
      JSON.stringify(settingsFor(workflow.id)),
      "desktop",
      workflow.desktop_target_id ?? null,
      workflow.created_at,
      workflow.updated_at,
      database.ownerId,
    ],
  );
}

describe("RunManager, desktop runs", () => {
  test("hands the runner the surface the provider opened, and never launches a browser", async () => {
    const database = await TestDbAdapter.create();
    const workflow = desktopWorkflow("wf-desktop", "target-ledger");
    await seedWorkflow(database, workflow);

    const run = vi.fn(async () => ({ ...idleRunState, status: "success" as const }));
    const openSurface = vi.fn(async () => async () => ({
      surface: { kind: "desktop" as const, driver: {} as never, binding: {} as never },
      close: async () => {},
    }));

    const manager = new RunManager({
      database,
      runner: { run },
      openDesktopSurface: openSurface,
    });

    await manager.startWorkflowRun({
      workflow,
      source: "manual",
      settings: settingsFor(workflow.id),
      graphSnapshot: GRAPH,
      compiledGraph: COMPILED,
    });
    await vi.waitFor(() => expect(run).toHaveBeenCalled());

    expect(openSurface).toHaveBeenCalledWith(
      expect.objectContaining({ workflow, retention: "close" }),
    );
    expect(run.mock.calls[0][0]).toHaveProperty("openSurface");
  });

  test("a web workflow gets no opener, so nothing changes for runs that predate the surface", async () => {
    const database = await TestDbAdapter.create();
    const workflow = { ...desktopWorkflow("wf-web", null), surface: "web" as const };
    await seedWorkflow(database, workflow);

    const run = vi.fn(async () => ({ ...idleRunState, status: "success" as const }));
    // A provider that declines is how the composition root says "not desktop".
    const manager = new RunManager({
      database,
      runner: { run },
      openDesktopSurface: async () => null,
    });

    await manager.startWorkflowRun({
      workflow,
      source: "manual",
      settings: settingsFor(workflow.id),
      graphSnapshot: GRAPH,
      compiledGraph: COMPILED,
    });
    await vi.waitFor(() => expect(run).toHaveBeenCalled());

    expect(run.mock.calls[0][0]).not.toHaveProperty("openSurface");
  });

  test("refuses a second run against a Desktop Target already being driven", async () => {
    const database = await TestDbAdapter.create();
    const first = desktopWorkflow("wf-1", "target-ledger");
    const second = desktopWorkflow("wf-2", "target-ledger");
    await seedWorkflow(database, first);
    await seedWorkflow(database, second);

    // Never settles: the first run stays active for the length of the test.
    const manager = new RunManager({
      database,
      runner: { run: vi.fn(() => new Promise(() => {})) as never },
      openDesktopSurface: async () => async () => ({
        surface: { kind: "desktop" as const, driver: {} as never, binding: {} as never },
        close: async () => {},
      }),
    });

    await manager.startWorkflowRun({
      workflow: first,
      source: "manual",
      settings: settingsFor(first.id),
      graphSnapshot: GRAPH,
      compiledGraph: COMPILED,
    });

    const conflict = manager.activeRunConflict(
      second.id,
      settingsFor(second.id),
      second.desktop_target_id,
    );

    expect(conflict).toMatchObject({
      reason: "active_desktop_target",
      field: "desktop_target_id",
    });
  });

  test("a different Desktop Target is free to run at the same time", async () => {
    // The lock is the application, not the machine. Serialising all desktop
    // work would make batches useless.
    const database = await TestDbAdapter.create();
    const first = desktopWorkflow("wf-1", "target-ledger");
    const second = desktopWorkflow("wf-2", "target-calculator");
    await seedWorkflow(database, first);
    await seedWorkflow(database, second);

    const manager = new RunManager({
      database,
      runner: { run: vi.fn(() => new Promise(() => {})) as never },
      openDesktopSurface: async () => async () => ({
        surface: { kind: "desktop" as const, driver: {} as never, binding: {} as never },
        close: async () => {},
      }),
    });

    await manager.startWorkflowRun({
      workflow: first,
      source: "manual",
      settings: settingsFor(first.id),
      graphSnapshot: GRAPH,
      compiledGraph: COMPILED,
    });

    expect(
      manager.activeRunConflict(second.id, settingsFor(second.id), second.desktop_target_id),
    ).toBeNull();
  });

  test("releases the target lock when the run finishes", async () => {
    const database = await TestDbAdapter.create();
    const workflow = desktopWorkflow("wf-1", "target-ledger");
    await seedWorkflow(database, workflow);

    const manager = new RunManager({
      database,
      runner: { run: vi.fn(async () => ({ ...idleRunState, status: "success" as const })) },
      openDesktopSurface: async () => async () => ({
        surface: { kind: "desktop" as const, driver: {} as never, binding: {} as never },
        close: async () => {},
      }),
    });

    await manager.startWorkflowRun({
      workflow,
      source: "manual",
      settings: settingsFor(workflow.id),
      graphSnapshot: GRAPH,
      compiledGraph: COMPILED,
    });

    await vi.waitFor(() =>
      expect(
        manager.activeRunConflict("wf-other", settingsFor("wf-other"), "target-ledger"),
      ).toBeNull(),
    );
  });
});
