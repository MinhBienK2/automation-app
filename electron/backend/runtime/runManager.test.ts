// @vitest-environment node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import type {
  CompiledWorkflowGraph,
  RunState,
  WorkflowGraph,
  WorkflowSettings,
  WorkflowSummary,
} from "../../../src/types/workflow";
import { createAppPaths, initializeDatabase } from "../persistence/database";
import { idleRunState, RunManager } from "./runManager";

const tempRoots: string[] = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await fs.rm(root, { recursive: true, force: true });
  }
});

describe("RunManager", () => {
  test("tracks active workflow/profile locks and releases them after final persistence", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "run-manager-"));
    tempRoots.push(tempRoot);
    const database = initializeDatabase(createAppPaths(tempRoot));
    const workflow = workflowSummary("workflow-1", "Run manager workflow");
    const graph = workflowGraph();
    const settings = workflowSettings(workflow.id, "profile-1");
    database
      .prepare(
        `INSERT INTO workflows (
          id, name, description, tags_json, graph_json, settings_json, created_at, updated_at
        ) VALUES (?, ?, '', '[]', ?, ?, ?, ?)`,
      )
      .run(
        workflow.id,
        workflow.name,
        JSON.stringify(graph),
        JSON.stringify(settings),
        workflow.created_at,
        workflow.updated_at,
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
    expect(
      database.prepare("SELECT status, outputs_json FROM runs WHERE id = ?").get(started.run_id),
    ).toMatchObject({
      status: "success",
      outputs_json: JSON.stringify({ ok: true }),
    });
    expect(database.prepare("SELECT COUNT(*) AS count FROM run_steps").get()).toEqual({
      count: 1,
    });
    database.close();
  });

  test("preserves terminal retained-session snapshot after active run entry is removed", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "run-manager-"));
    tempRoots.push(tempRoot);
    const database = initializeDatabase(createAppPaths(tempRoot));
    const workflow = workflowSummary("workflow-1", "Retained session workflow");
    const graph = workflowGraph();
    const settings = workflowSettings(workflow.id, "profile-1");
    database
      .prepare(
        `INSERT INTO workflows (
          id, name, description, tags_json, graph_json, settings_json, created_at, updated_at
        ) VALUES (?, ?, '', '[]', ?, ?, ?, ?)`,
      )
      .run(
        workflow.id,
        workflow.name,
        JSON.stringify(graph),
        JSON.stringify(settings),
        workflow.created_at,
        workflow.updated_at,
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
    database.close();
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
