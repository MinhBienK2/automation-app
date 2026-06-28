import type { WorkflowGraph } from "../../../../src/types/workflow.js";
import type { Migration } from "./types.js";

/**
 * 001_baseline — normalises legacy v1 graphs to the v2 contract.
 *
 * v2 introduced the `migration_notes` array. This migration ensures it
 * always exists (defaulting to `[]`) and bumps the version marker.
 */
export const migration001Baseline: Migration = {
  version: 2,
  description: "Normalise to baseline v2 (migration_notes field)",
  up: (graph: WorkflowGraph): WorkflowGraph => {
    return {
      ...graph,
      version: 2,
      migration_notes: graph.migration_notes ?? [],
    };
  },
};
