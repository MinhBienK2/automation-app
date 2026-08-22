import type { WorkflowGraph } from "../../../src/types/workflow.js";
import { runMigrations } from "./migrations/index.js";

export const CURRENT_WORKFLOW_GRAPH_VERSION = 9;

/**
 * Thin shim re-exporting the new migration pipeline under the legacy name.
 * Delegates to `runMigrations`; on failure it returns the last-successful
 * graph (same contract as before — no throwing on load).
 */
export function migrateWorkflowGraph(graph: WorkflowGraph): WorkflowGraph {
  return runMigrations(graph).graph;
}
