// @vitest-environment node

import { describe, expect, test } from "vitest";
import type {
  CompiledWorkflowGraph,
  RunState,
  WorkflowGraph,
  WorkflowSettings,
} from "../../../src/types/workflow";
import { idleRunState, type RunnerCommandPort } from "./runManager";
import {
  runBatchWorkflowRows,
  type BatchWorkflowRunManager,
} from "./batchWorkflowRun";

describe("runBatchWorkflowRows", () => {
  test("runs rows sequentially with row variables and stops after the first failed row when configured", async () => {
    const manager = new FakeBatchWorkflowRunManager();
    const runnerGraphs: CompiledWorkflowGraph[] = [];
    const runnerSettings: WorkflowSettings[] = [];
    const runner: Pick<RunnerCommandPort, "run"> = {
      async run(request) {
        runnerGraphs.push(request.graph);
        runnerSettings.push(request.settings);
        const rowIndex = runnerGraphs.length - 1;
        return rowIndex === 0
          ? runState("success", ["visit"])
          : runState("failed", [], "row failed");
      },
    };

    const summary = await runBatchWorkflowRows({
      workflowId: "workflow-1",
      request: {
        rows: [{ name: "A" }, { name: "B" }, { name: "C" }],
      },
      settings: workflowSettings({ stopOnFirstFailedRow: true }),
      graphSnapshot: workflowGraph(),
      compiledGraph: compiledGraph(),
      runner,
      runManager: manager,
    });

    expect(summary).toEqual({
      total: 3,
      succeeded: 1,
      failed: 1,
      results: [
        { row_index: 0, status: "success", error: null },
        { row_index: 1, status: "failed", error: "row failed" },
      ],
    });
    expect(runnerGraphs).toHaveLength(2);
    expect(runnerGraphs[0]?.steps[0]).toMatchObject({
      node_id: "batch-row-0",
      config: {
        type: "set_variable",
        config: {
          variables: [{ name: "name", value_type: "text", value: "A" }],
        },
      },
    });
    expect(runnerGraphs[1]?.steps[0]).toMatchObject({
      node_id: "batch-row-1",
      config: {
        type: "set_variable",
        config: {
          variables: [{ name: "name", value_type: "text", value: "B" }],
        },
      },
    });
    expect(runnerSettings.every((settings) => settings.run_policy.browser_retention === "close"))
      .toBe(true);
    expect(manager.runRecordWorkflowIds).toEqual(["workflow-1", "workflow-1"]);
    expect(manager.currentRunIds).toEqual(["run-1", null, "run-2", null]);
    expect(manager.finishedRunIds).toEqual(["run-1", "run-2"]);
    expect(manager.cleared).toBe(true);
    expect(manager.state).toMatchObject({
      status: "failed",
      outputs: {
        batch_total: 3,
        batch_succeeded: 1,
        batch_failed: 1,
      },
    });
  });

  test("finalizes the current row run when runner infrastructure rejects", async () => {
    const manager = new FakeBatchWorkflowRunManager();
    const runner: Pick<RunnerCommandPort, "run"> = {
      async run() {
        throw new Error("Browser launch failed");
      },
    };

    await expect(
      runBatchWorkflowRows({
        workflowId: "workflow-1",
        request: {
          rows: [{ name: "A" }],
        },
        settings: workflowSettings({ stopOnFirstFailedRow: true }),
        graphSnapshot: workflowGraph(),
        compiledGraph: compiledGraph(),
        runner,
        runManager: manager,
      }),
    ).rejects.toThrow("Browser launch failed");

    expect(manager.runRecordWorkflowIds).toEqual(["workflow-1"]);
    expect(manager.currentRunIds).toEqual(["run-1", null]);
    expect(manager.finishedRuns).toEqual([
      expect.objectContaining({
        runId: "run-1",
        state: expect.objectContaining({
          status: "failed",
          mode: "run_workflow",
          error: expect.objectContaining({
            action_type: "workflow",
            reason: "Browser launch failed",
          }),
        }),
      }),
    ]);
    expect(manager.state).toMatchObject({
      status: "failed",
      outputs: {
        batch_total: 1,
        batch_succeeded: 0,
        batch_failed: 1,
      },
      error: {
        action_type: "workflow",
        reason: "Browser launch failed",
      },
    });
    expect(manager.cleared).toBe(true);
  });
});

class FakeBatchWorkflowRunManager implements BatchWorkflowRunManager {
  state: RunState | null = null;
  cleared = false;
  runRecordWorkflowIds: string[] = [];
  currentRunIds: Array<string | null> = [];
  finishedRunIds: string[] = [];
  finishedRuns: Array<{
    runId: string | null;
    graph: CompiledWorkflowGraph;
    state: RunState;
  }> = [];
  private runRecordCount = 0;

  beginBatchRun(totalRows: number) {
    this.state = {
      ...idleRunState,
      status: "running",
      mode: "run_workflow",
      outputs: {
        batch_total: totalRows,
        batch_current_row_index: 0,
        batch_succeeded: 0,
        batch_failed: 0,
      },
    };
    return new AbortController();
  }

  getBatchRunState() {
    return this.state;
  }

  setBatchRunState(state: RunState) {
    this.state = state;
  }

  beginRunRecord(workflowId: string) {
    this.runRecordWorkflowIds.push(workflowId);
    this.runRecordCount += 1;
    return `run-${this.runRecordCount}`;
  }

  setCurrentBatchRunId(runId: string | null) {
    this.currentRunIds.push(runId);
  }

  finishRun(runId: string | null, graph: CompiledWorkflowGraph, state: RunState) {
    if (runId) this.finishedRunIds.push(runId);
    this.finishedRuns.push({ runId, graph, state });
  }

  clearBatchRun() {
    this.cleared = true;
  }
}

function workflowSettings({
  stopOnFirstFailedRow,
}: {
  stopOnFirstFailedRow: boolean;
}): WorkflowSettings {
  return {
    workflow_id: "workflow-1",
    version: 2,
    general: {
      name: "Batch",
      description: "",
      tags: [],
      notes: "",
    },
    run_policy: {
      browser_retention: "close",
      execute_js_enabled: false,
      run_from_selected_enabled: false,
      run_from_selected_mode: "selected_and_following",
      batch_headless: true,
      batch_stop_on_first_failed_row: stopOnFirstFailedRow,
    },
    browser_launch: {
      headless: true,
      session_mode: "temporary",
      identity_id: "identity-1",
      display_name: "Identity",
      persona_id: "persona-1",
      persona: {
        id: "persona-1",
        label: "Persona",
        rationale: "",
        os_bucket: "linux",
        browser_channel_bucket: "chromium",
        viewport: { width: 1280, height: 720 },
        window: { width: 1280, height: 720 },
        timezone: "UTC",
        locale: "en-US",
        proxy_geo_policy: "none",
        webrtc_mode: "default",
        font_bundle: { strategy: "system", expected_families: [] },
        behavioral_timing_profile: "default",
      },
      profile_dir: "identity-1",
      profile_name: null,
      fingerprint_seed: "seed-1",
      proxy: { mode: "none" },
      locale: "en-US",
      timezone: "UTC",
    },
    graph_defaults: {
      default_edge_delay: null,
      live_run_enabled: true,
      live_run_follow_current: true,
    },
    environment: { initial_variables: [] },
    migration_notes: [],
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
        config: { type: "navigate", config: { url: "https://owned.test" } },
      },
    ],
  };
}

function runState(
  status: RunState["status"],
  completedStepIds: string[],
  reason?: string,
): RunState {
  return {
    status,
    mode: "run_workflow",
    target_step_id: null,
    current_step_id: null,
    current_step_number: null,
    completed_step_ids: completedStepIds,
    outputs: {},
    retained_session: idleRunState.retained_session,
    error: reason
      ? {
          step_id: "visit",
          step_number: 1,
          action_type: "navigate",
          reason,
        }
      : null,
  };
}
