// @vitest-environment node

import { afterEach, describe, expect, test, vi } from "vitest";
import { TestDbAdapter } from "../db/testDbAdapter.js";
import { beginRun, finishRun } from "./runDbHelpers.js";
import type { CompiledWorkflowGraph, RunState, WorkflowGraph, WorkflowSettings } from "../../../src/types/workflow.js";
import { getMongoCollection } from "../db/mongo.js";

afterEach(async () => {
  const mongoCollection = await getMongoCollection("run_steps");
  if (mongoCollection) {
    await mongoCollection.deleteMany({});
  }
});

function workflowSettings(workflowId: string): WorkflowSettings {
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
      identity_id: "profile-1",
      display_name: "profile-1",
      profile_dir: "profile-1",
      fingerprint_seed: "12345",
      profile_name: "profile-1",
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

describe("runDbHelpers", () => {
  test("finishRun executes inserts in a single batch query", async () => {
    const database = await TestDbAdapter.create();
    const workflowId = "workflow-1";
    const settings = workflowSettings(workflowId);
    const graph: WorkflowGraph = {
      version: 2,
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    const compiledGraph: CompiledWorkflowGraph = {
      steps: [
        { node_id: "step-1", label: "Step 1", config: { type: "wait", config: { duration_ms: 100 } } },
        { node_id: "step-2", label: "Step 2", config: { type: "wait", config: { duration_ms: 100 } } },
        { node_id: "step-3", label: "Step 3", config: { type: "wait", config: { duration_ms: 100 } } },
      ],
    };

    const state: RunState = {
      status: "success",
      mode: "run_workflow",
      target_step_id: null,
      current_step_id: null,
      current_step_number: null,
      completed_step_ids: ["step-1", "step-2", "step-3"],
      outputs: {
        __action_traces: [
          { node_id: "step-1", label: "Step 1", action_type: "wait", status: "success", started_at: "2026-05-24T00:00:00.000Z", finished_at: "2026-05-24T00:00:01.000Z" },
          { node_id: "step-2", label: "Step 2", action_type: "wait", status: "success", started_at: "2026-05-24T00:00:01.000Z", finished_at: "2026-05-24T00:00:02.000Z" },
          { node_id: "step-3", label: "Step 3", action_type: "wait", status: "success", started_at: "2026-05-24T00:00:02.000Z", finished_at: "2026-05-24T00:00:03.000Z" },
          { node_id: "nested-1", parent_node_id: "step-2", label: "Nested 1", action_type: "wait", status: "success", started_at: "2026-05-24T00:00:01.500Z", finished_at: "2026-05-24T00:00:01.800Z" },
        ],
      },
      retained_session: null,
      error: null,
    };

    await database.execute(
      `INSERT INTO workflows (id, name, description, tags_json, settings_json, created_at, updated_at, owner_id)
       VALUES ($1, $2, '', '[]', $3, $4, $5, $6)`,
      [workflowId, "Workflow 1", JSON.stringify(settings), "2026-05-24", "2026-05-24", database.ownerId]
    );

    const runId = await beginRun(database, workflowId, settings, graph);

    // Spy on database.execute to count queries
    const executeSpy = vi.spyOn(database, "execute");

    await finishRun(database, runId, compiledGraph, state);

    // Only 1 Postgres update query for the runs table
    expect(executeSpy).toHaveBeenCalledTimes(1);

    executeSpy.mockRestore();

    // Verify all steps are in MongoDB
    const mongoCollection = await getMongoCollection("run_steps");
    expect(mongoCollection).not.toBeNull();
    const stepRows = await mongoCollection!.find({ run_id: runId }).sort({ step_number: 1 }).toArray();
    expect(stepRows).toHaveLength(4);
    expect(stepRows[0]).toMatchObject({ node_id: "step-1", status: "success" });
    expect(stepRows[3]).toMatchObject({ node_id: "nested-1", status: "success" });
  });
});
