import type { WorkflowSettings } from "../../../src/types/workflow.js";
import type { DbAdapter } from "../db/dbAdapter.js";
import type { RunManager } from "../runtime/runManager.js";

export type RunGuardsHelpers = {
  lastRunAtForWorkflow: (workflowId: string) => Promise<string | null>;
  activeRunConflict: (
    workflowId: string,
    settings: WorkflowSettings,
  ) => { message: string; field: string } | null;
  schedulerConflictReason: (workflowId: string) => Promise<string | null>;
  assertWorkflowDeletionAllowed: (
    workflowId: string,
    settings: WorkflowSettings,
  ) => Promise<void>;
};

export function createRunGuardsHelpers(deps: {
  database: DbAdapter;
  runManager: RunManager;
  getSettings: (workflowId: string) => Promise<WorkflowSettings>;
}): RunGuardsHelpers {
  const { database, runManager, getSettings } = deps;

  async function lastRunAtForWorkflow(workflowId: string): Promise<string | null> {
    const row = await database.queryOne(
      `SELECT COALESCE(finished_at, started_at) AS last_run_at
       FROM runs
       WHERE workflow_id = $1 AND owner_id = $2
       ORDER BY started_at DESC
       LIMIT 1`,
      [workflowId, database.ownerId],
    ) as { last_run_at?: string | null } | null;
    return row?.last_run_at ?? null;
  }

  function activeRunConflict(workflowId: string, settings: WorkflowSettings) {
    return runManager.activeRunConflict(workflowId, settings);
  }

  async function schedulerConflictReason(workflowId: string) {
    const settings = await getSettings(workflowId);
    return activeRunConflict(workflowId, settings)?.reason ?? null;
  }

  async function assertWorkflowDeletionAllowed(workflowId: string, settings: WorkflowSettings) {
    runManager.assertWorkflowDeletionAllowed(workflowId, settings);
  }

  return {
    lastRunAtForWorkflow,
    activeRunConflict,
    schedulerConflictReason,
    assertWorkflowDeletionAllowed,
  };
}
