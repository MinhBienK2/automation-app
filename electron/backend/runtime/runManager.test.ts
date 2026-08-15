// @vitest-environment node
//
// `TestDbAdapter` imports `node:sqlite`, which the jsdom environment's bundler
// refuses. Without this the whole file fails to load rather than failing a
// test, which is why it read as "0 tests" rather than as a broken suite.

import { afterEach, describe, expect, test, vi } from "vitest";
import type {
  CompiledWorkflowGraph,
  RunState,
  WorkflowGraph,
  WorkflowSettings,
  WorkflowSummary,
} from "../../../src/types/workflow";
import { idleRunState, RunManager } from "./runManager.js";
import { TestDbAdapter } from "../db/testDbAdapter.js";
import { getMongoCollection } from "../db/mongo.js";

afterEach(async () => {
  const mongoCollection = await getMongoCollection("run_steps");
  if (mongoCollection) {
    await mongoCollection.deleteMany({});
  }
});

describe("RunManager", () => {
  test("marks durable running rows from a previous app process as failed on startup", async () => {
    const database = await TestDbAdapter.create();
    const workflow = workflowSummary("workflow-1", "Interrupted workflow");
    const graph = workflowGraph();
    const settings = workflowSettings(workflow.id, "profile-1");
    
    await database.execute(
      `INSERT INTO workflows (
        id, name, description, tags_json, settings_json, created_at, updated_at, owner_id
      ) VALUES ($1, $2, '', '[]', $3, $4, $5, $6)`,
      [
        workflow.id,
        workflow.name,
        JSON.stringify(settings),
        workflow.created_at,
        workflow.updated_at,
        database.ownerId,
      ]
    );

    await database.execute(
      `INSERT INTO runs (
        id, workflow_id, source, status, started_at, settings_snapshot_json, graph_snapshot_json, owner_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        "run-interrupted",
        workflow.id,
        "manual",
        "running",
        "2026-05-27T10:00:00.000Z",
        JSON.stringify(settings),
        JSON.stringify(graph),
        database.ownerId,
      ]
    );

    new RunManager({
      database,
      runner: {
        run: vi.fn(),
        getRetainedSessionState: vi.fn(() => idleRunState.retained_session),
      },
    });

    const row = await database.queryOne<{
      status: string;
      finished_at: string | null;
      outputs_json: string | null;
      error_json: string | null;
    }>(
      `SELECT status, finished_at, outputs_json, error_json
       FROM runs
       WHERE id = $1`,
      ["run-interrupted"]
    );

    expect(row).not.toBeNull();
    expect(row!.status).toBe("failed");
    expect(row!.finished_at).toEqual(expect.any(String));
    expect(row!.outputs_json).toBe(JSON.stringify({}));
    expect(JSON.parse(row!.error_json ?? "{}")).toMatchObject({
      action_type: "workflow",
      reason: "App exited before the run completed",
    });
  });

  test("tracks active workflow/profile locks and releases them after final persistence", async () => {
    const database = await TestDbAdapter.create();
    const workflow = workflowSummary("workflow-1", "Run manager workflow");
    const graph = workflowGraph();
    const settings = workflowSettings(workflow.id, "profile-1");

    await database.execute(
      `INSERT INTO workflows (
        id, name, description, tags_json, settings_json, created_at, updated_at, owner_id
      ) VALUES ($1, $2, '', '[]', $3, $4, $5, $6)`,
      [
        workflow.id,
        workflow.name,
        JSON.stringify(settings),
        workflow.created_at,
        workflow.updated_at,
        database.ownerId,
      ]
    );

    let finishRun: ((state: RunState) => void) | null = null;
    const runner = {
      run: vi.fn(
        () =>
          new Promise<RunState>((resolve) => {
            finishRun = resolve;
          }),
      ),
      getRetainedSessionState: vi.fn(() => idleRunState.retained_session),
    };
    const manager = new RunManager({ database, runner });

    const started = await manager.startWorkflowRun({
      workflow,
      source: "manual",
      settings,
      graphSnapshot: graph,
      compiledGraph: compiledGraph(),
    });

    expect(started).toMatchObject({
      workflow_id: workflow.id,
      state: { status: "running" },
    });
    expect(manager.activeRunConflict(workflow.id, settings)).toMatchObject({
      reason: "active_workflow",
      field: "workflowId",
    });
    expect(manager.activeRunConflict("workflow-2", workflowSettings("workflow-2", "profile-1")))
      .toMatchObject({
        reason: "active_profile",
        field: "browser_launch.profile_name",
      });

    finishRun?.({
      ...idleRunState,
      status: "success",
      mode: "run_workflow",
      completed_step_ids: ["visit"],
      outputs: { ok: true },
    });
    await flushAsyncWork();

    expect(manager.activeRunConflict(workflow.id, settings)).toBeNull();
    expect(manager.listRunStates()).toEqual([
      expect.objectContaining({
        run_id: started.run_id,
        state: expect.objectContaining({ status: "success" }),
      }),
    ]);

    const runRow = await database.queryOne<{ status: string; outputs_json: string }>(
      "SELECT status, outputs_json FROM runs WHERE id = $1",
      [started.run_id]
    );
    expect(runRow).toMatchObject({
      status: "success",
      outputs_json: JSON.stringify({ ok: true }),
    });

    const mongoCollection = await getMongoCollection("run_steps");
    const count = await mongoCollection!.countDocuments({});
    expect(count).toBe(1);
  });

  test("preserves terminal retained-session snapshot after active run entry is removed", async () => {
    const database = await TestDbAdapter.create();
    const workflow = workflowSummary("workflow-1", "Retained session workflow");
    const graph = workflowGraph();
    const settings = workflowSettings(workflow.id, "profile-1");

    await database.execute(
      `INSERT INTO workflows (
        id, name, description, tags_json, settings_json, created_at, updated_at, owner_id
      ) VALUES ($1, $2, '', '[]', $3, $4, $5, $6)`,
      [
        workflow.id,
        workflow.name,
        JSON.stringify(settings),
        workflow.created_at,
        workflow.updated_at,
        database.ownerId,
      ]
    );

    let finishRun: ((state: RunState) => void) | null = null;
    const runner = {
      run: vi.fn(
        () =>
          new Promise<RunState>((resolve) => {
            finishRun = resolve;
          }),
      ),
      getRetainedSessionState: vi.fn((_workflowId?: string | null, profileName?: string | null) => {
        if (profileName === "profile-1") {
          return {
            available: true,
            workflow_id: workflow.id,
            profile_name: "profile-1",
            reason: null,
          };
        }
        return {
          available: false,
          workflow_id: workflow.id,
          profile_name: profileName ?? null,
          reason: "No retained browser session",
        };
      }),
    };
    const manager = new RunManager({ database, runner });
    await manager.startWorkflowRun({
      workflow,
      source: "manual",
      settings,
      graphSnapshot: graph,
      compiledGraph: compiledGraph(),
    });

    finishRun?.({
      ...idleRunState,
      status: "success",
      mode: "run_workflow",
      retained_session: {
        available: true,
        workflow_id: workflow.id,
        profile_name: "profile-1",
        reason: null,
      },
    });
    await flushAsyncWork();

    expect(manager.getRunState().retained_session).toMatchObject({
      available: true,
      workflow_id: workflow.id,
      profile_name: "profile-1",
    });
    expect(runner.getRetainedSessionState).toHaveBeenLastCalledWith(workflow.id, "profile-1");
  });

  test("keys retained sessions from normal runs by workflow profile", async () => {
    const database = await TestDbAdapter.create();
    const workflow = workflowSummary("workflow-1", "Retained owner workflow");
    const graph = workflowGraph();
    const settings = workflowSettings(workflow.id, "profile-1");

    await database.execute(
      `INSERT INTO workflows (
        id, name, description, tags_json, settings_json, created_at, updated_at, owner_id
      ) VALUES ($1, $2, '', '[]', $3, $4, $5, $6)`,
      [
        workflow.id,
        workflow.name,
        JSON.stringify(settings),
        workflow.created_at,
        workflow.updated_at,
        database.ownerId,
      ]
    );

    const runner = {
      run: vi.fn(async (): Promise<RunState> => ({
        ...idleRunState,
        status: "success",
        mode: "run_workflow",
      })),
      getRetainedSessionState: vi.fn(() => idleRunState.retained_session),
    };
    const manager = new RunManager({ database, runner });

    await manager.startWorkflowRun({
      workflow,
      source: "manual",
      settings,
      graphSnapshot: graph,
      compiledGraph: compiledGraph(),
    });
    await flushAsyncWork();

    expect(runner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        retainedSessionWorkflowId: workflow.id,
      }),
    );
  });

  test("persists variables marked with persist: true back to browser profile environment after a run", async () => {
    const database = await TestDbAdapter.create();
    const workflow = workflowSummary("workflow-1", "Run manager workflow");
    workflow.browser_profile_id = "profile-1";
    const graph = workflowGraph();
    const settings = workflowSettings(workflow.id, "profile-1");

    await database.execute(`
      INSERT INTO projects (id, name, created_at, updated_at, owner_id)
      VALUES ($1, $2, $3, $4, $5)
    `, ["project-1", "Project 1", "2026-05-24T00:00:00.000Z", "2026-05-24T00:00:00.000Z", database.ownerId]);

    const initialEnv = {
      variables: [
        { name: "persist_me", value_type: "text", value: "old-value", persist: true },
        { name: "dont_persist_me", value_type: "text", value: "old-value", persist: false },
      ],
    };
    await database.execute(`
      INSERT INTO browser_profiles (
        id, project_id, name, description, is_default, browser_launch_json, environment_json, created_at, updated_at, owner_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      "profile-1",
      "project-1",
      "profile-1",
      "description",
      0,
      JSON.stringify(settings.browser_launch),
      JSON.stringify(initialEnv),
      "2026-05-24T00:00:00.000Z",
      "2026-05-24T00:00:00.000Z",
      database.ownerId,
    ]);

    await database.execute(
      `INSERT INTO workflows (
        id, name, description, tags_json, settings_json, browser_profile_id, created_at, updated_at, owner_id
      ) VALUES ($1, $2, '', '[]', $3, $4, $5, $6, $7)`,
      [
        workflow.id,
        workflow.name,
        JSON.stringify(settings),
        "profile-1",
        workflow.created_at,
        workflow.updated_at,
        database.ownerId,
      ]
    );

    let finishRun: ((state: RunState) => void) | null = null;
    const runner = {
      run: vi.fn(
        () =>
          new Promise<RunState>((resolve) => {
            finishRun = resolve;
          }),
      ),
      getRetainedSessionState: vi.fn(() => idleRunState.retained_session),
    };
    const manager = new RunManager({ database, runner });

    const started = await manager.startWorkflowRun({
      workflow,
      source: "manual",
      settings,
      graphSnapshot: graph,
      compiledGraph: compiledGraph(),
    });

    finishRun?.({
      ...idleRunState,
      status: "success",
      mode: "run_workflow",
      completed_step_ids: ["visit"],
      outputs: {
        persist_me: "new-value",
        dont_persist_me: "new-value",
      },
    });
    await flushAsyncWork();

    const profileRow = await database.queryOne<{ environment_json: string }>(
      "SELECT environment_json FROM browser_profiles WHERE id = $1",
      ["profile-1"]
    );
    const parsedEnv = JSON.parse(profileRow!.environment_json);
    expect(parsedEnv.variables).toEqual([
      { name: "persist_me", value_type: "text", value: "new-value", persist: true },
      { name: "dont_persist_me", value_type: "text", value: "old-value", persist: false },
    ]);
  });

  test("dynamically refreshes retained-session availability in listRunStates", async () => {
    const database = await TestDbAdapter.create();
    const workflow = workflowSummary("workflow-1", "Retained session workflow");
    const graph = workflowGraph();
    const settings = workflowSettings(workflow.id, "profile-1");

    let isSessionAvailable = true;
    const runner = {
      run: vi.fn(() => new Promise<RunState>(() => {})),
      getRetainedSessionState: vi.fn((_workflowId?: string | null, profileName?: string | null) => {
        return {
          available: isSessionAvailable,
          workflow_id: workflow.id,
          profile_name: profileName ?? null,
          reason: isSessionAvailable ? null : "Browser session was closed",
        };
      }),
    };
    const manager = new RunManager({ database, runner });
    const started = await manager.startWorkflowRun({
      workflow,
      source: "manual",
      settings,
      graphSnapshot: graph,
      compiledGraph: compiledGraph(),
    });

    manager.updateLatestRetainedSession({
      available: true,
      workflow_id: workflow.id,
      profile_name: "profile-1",
      reason: null,
    });

    const activeEntry = (manager as any).runEntries.get(started.run_id);
    if (activeEntry) {
      activeEntry.snapshot.state.status = "success";
    }

    const runs = manager.listRunStates();
    expect(runs).toEqual([
      expect.objectContaining({
        run_id: started.run_id,
        state: expect.objectContaining({
          retained_session: expect.objectContaining({ available: true }),
        }),
      }),
    ]);

    isSessionAvailable = false;

    const refreshedRuns = manager.listRunStates();
    expect(refreshedRuns).toEqual([
      expect.objectContaining({
        run_id: started.run_id,
        state: expect.objectContaining({
          retained_session: expect.objectContaining({ available: false }),
        }),
      }),
    ]);
  });
});


function workflowSummary(id: string, name: string): WorkflowSummary {
  return {
    id,
    name,
    step_count: 1,
    created_at: "2026-05-24T00:00:00.000Z",
    updated_at: "2026-05-24T00:00:00.000Z",
  };
}

function workflowGraph(): WorkflowGraph {
  return {
    version: 2,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function compiledGraph(): CompiledWorkflowGraph {
  return {
    steps: [
      {
        node_id: "visit",
        label: "Visit",
        config: { type: "wait", config: { duration_ms: 100 } },
      },
    ],
  };
}

function workflowSettings(workflowId: string, profileName: string): WorkflowSettings {
  return {
    workflow_id: workflowId,
    version: 2,
    general: {
      name: "Workflow",
      description: "",
      tags: [],
      notes: "",
      created_at: "2026-05-24T00:00:00.000Z",
      updated_at: "2026-05-24T00:00:00.000Z",
    },
    run_policy: {
      max_workflow_duration_ms: null,
      browser_retention: "retain",
      execute_js_enabled: true,
      run_from_selected_enabled: false,
      run_from_selected_mode: "from_selected",
      batch_concurrency_limit: 1,
      batch_headless: true,
      batch_stop_on_first_failed_row: false,
    },
    browser_launch: {
      session_mode: "persistent_profile",
      identity_id: profileName,
      display_name: profileName,
      profile_dir: profileName,
      fingerprint_seed: "12345",
      profile_name: profileName,
      fingerprint_fonts_dir: null,
      timezone: null,
      locale: null,
      geoip: false,
      proxy_bypass: null,
      webrtc_policy: "default",
      webrtc_ip: null,
      proxy_enabled: false,
      proxy_server: null,
      proxy_username: null,
      proxy_password: null,
      headless: true,
      humanize: true,
      human_preset: "default",
    },
    graph_defaults: {
      default_edge_delay: null,
      live_run_enabled: true,
      live_run_follow_current: false,
    },
    environment: {
      initial_variables: [],
    },
    migration_notes: [],
    created_at: "2026-05-24T00:00:00.000Z",
    updated_at: "2026-05-24T00:00:00.000Z",
  };
}

function flushAsyncWork() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
