import type {
  BatchRunRequest,
  BatchRunSummary,
  CompiledWorkflowGraph,
  RunState,
  WorkflowGraph,
  WorkflowSettings,
} from "../../../src/types/workflow.js";
import { prependBatchRowVariables } from "../commandHelpers.js";
import { idleRunState, type RunnerCommandPort } from "./runManager.js";

export type BatchWorkflowRunManager = {
  beginBatchRun(totalRows: number): AbortController;
  getBatchRunState(): RunState | null;
  setBatchRunState(state: RunState): void;
  beginRunRecord(
    workflowId: string,
    settings: WorkflowSettings,
    graph: WorkflowGraph,
  ): string;
  setCurrentBatchRunId(runId: string | null): void;
  finishRun(runId: string | null, graph: CompiledWorkflowGraph, state: RunState): void;
  clearBatchRun(abortController: AbortController): void;
};

export async function runBatchWorkflowRows({
  workflowId,
  request,
  settings,
  graphSnapshot,
  compiledGraph,
  runner,
  runManager,
}: {
  workflowId: string;
  request: BatchRunRequest;
  settings: WorkflowSettings;
  graphSnapshot: WorkflowGraph;
  compiledGraph: CompiledWorkflowGraph;
  runner: Pick<RunnerCommandPort, "run">;
  runManager: BatchWorkflowRunManager;
}): Promise<BatchRunSummary> {
  const batchSettings: WorkflowSettings = {
    ...settings,
    run_policy: {
      ...settings.run_policy,
      browser_retention: "close",
    },
    browser_launch: {
      ...settings.browser_launch,
      headless: request.headless ?? settings.run_policy.batch_headless,
    },
  };
  const results: BatchRunSummary["results"] = [];
  let succeeded = 0;
  let failed = 0;
  let activeRowRunId: string | null = null;
  let activeRowGraph: CompiledWorkflowGraph | null = null;
  let activeRowIndex: number | null = null;
  const abortController = runManager.beginBatchRun(request.rows.length);
  try {
    for (const [rowIndex, row] of request.rows.entries()) {
      if (abortController.signal.aborted) break;
      runManager.setBatchRunState({
        ...(runManager.getBatchRunState() ?? idleRunState),
        status: "running",
        outputs: {
          ...(runManager.getBatchRunState()?.outputs ?? {}),
          batch_total: request.rows.length,
          batch_current_row_index: rowIndex,
          batch_succeeded: succeeded,
          batch_failed: failed,
        },
      });
      const rowGraph = prependBatchRowVariables(compiledGraph, rowIndex, row);
      const runId = runManager.beginRunRecord(workflowId, batchSettings, graphSnapshot);
      activeRowRunId = runId;
      activeRowGraph = rowGraph;
      activeRowIndex = rowIndex;
      runManager.setCurrentBatchRunId(runId);
      let result = await runner.run({
        runId,
        graph: rowGraph,
        settings: batchSettings,
        mode: "run_workflow",
        signal: abortController.signal,
        onProgress(progress) {
          if (abortController.signal.aborted && runManager.getBatchRunState()?.status === "stopped") {
            return;
          }
          runManager.setBatchRunState({
            ...(runManager.getBatchRunState() ?? idleRunState),
            ...progress,
            status: "running",
            mode: "run_workflow",
            outputs: {
              ...(runManager.getBatchRunState()?.outputs ?? {}),
              batch_total: request.rows.length,
              batch_current_row_index: rowIndex,
              batch_succeeded: succeeded,
              batch_failed: failed,
            },
          });
        },
      });
      if (abortController.signal.aborted && runManager.getBatchRunState()?.status === "stopped") {
        result = {
          ...result,
          status: "stopped",
          error: null,
        };
      }
      runManager.finishRun(runId, rowGraph, result);
      activeRowRunId = null;
      activeRowGraph = null;
      activeRowIndex = null;
      runManager.setCurrentBatchRunId(null);
      if (result.status === "success") {
        succeeded += 1;
      } else if (result.status === "failed") {
        failed += 1;
      }
      results.push({
        row_index: rowIndex,
        status: result.status,
        error: result.error?.reason ?? null,
      });
      runManager.setBatchRunState({
        ...(runManager.getBatchRunState() ?? idleRunState),
        status: result.status === "stopped" ? "stopped" : "running",
        current_step_id: null,
        current_step_number: null,
        outputs: {
          ...(runManager.getBatchRunState()?.outputs ?? {}),
          batch_total: request.rows.length,
          batch_current_row_index: rowIndex,
          batch_succeeded: succeeded,
          batch_failed: failed,
        },
        error: result.status === "failed" ? result.error : null,
      });
      if (result.status === "stopped") break;
      if (result.status !== "success" && settings.run_policy.batch_stop_on_first_failed_row) {
        break;
      }
    }
    if (runManager.getBatchRunState()?.status !== "stopped") {
      runManager.setBatchRunState({
        ...(runManager.getBatchRunState() ?? idleRunState),
        status: failed > 0 ? "failed" : "success",
        current_step_id: null,
        current_step_number: null,
        outputs: {
          ...(runManager.getBatchRunState()?.outputs ?? {}),
          batch_total: request.rows.length,
          batch_succeeded: succeeded,
          batch_failed: failed,
        },
      });
    }
  } catch (error) {
    const batchState = runManager.getBatchRunState();
    const reason = error instanceof Error ? error.message : String(error);
    let failedCount = failed;
    if (activeRowRunId && activeRowGraph) {
      failedCount += 1;
      failed = failedCount;
      const failedState: RunState = {
        ...idleRunState,
        status: "failed",
        mode: "run_workflow",
        completed_step_ids: batchState?.completed_step_ids ?? [],
        retained_session: batchState?.retained_session ?? idleRunState.retained_session,
        error: {
          step_id: batchState?.current_step_id,
          step_number: batchState?.current_step_number ?? 0,
          step_name: null,
          action_type: "workflow",
          reason,
        },
      };
      runManager.finishRun(activeRowRunId, activeRowGraph, failedState);
      runManager.setCurrentBatchRunId(null);
      results.push({
        row_index: activeRowIndex ?? results.length,
        status: "failed",
        error: reason,
      });
      activeRowRunId = null;
      activeRowGraph = null;
      activeRowIndex = null;
    }
    runManager.setBatchRunState({
      ...idleRunState,
      status: "failed",
      mode: "run_workflow",
      outputs: {
        batch_total: request.rows.length,
        batch_succeeded: succeeded,
        batch_failed: failedCount,
      },
      error: {
        step_id: batchState?.current_step_id,
        step_number: batchState?.current_step_number ?? 0,
        step_name: null,
        action_type: "workflow",
        reason,
      },
    });
    throw error;
  } finally {
    runManager.clearBatchRun(abortController);
  }
  return {
    total: request.rows.length,
    succeeded,
    failed,
    results,
  };
}
