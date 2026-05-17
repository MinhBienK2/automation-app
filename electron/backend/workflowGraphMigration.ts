import type {
  ElementTarget,
  WorkflowGraph,
} from "../../src/types/workflow.js";

export const CURRENT_WORKFLOW_GRAPH_VERSION = 2;

export function migrateWorkflowGraph(graph: WorkflowGraph): WorkflowGraph {
  if (graph.version >= CURRENT_WORKFLOW_GRAPH_VERSION) {
    return {
      ...graph,
      migration_notes: graph.migration_notes ?? [],
    };
  }

  return {
    ...graph,
    version: CURRENT_WORKFLOW_GRAPH_VERSION,
    migration_notes: graph.migration_notes ?? [],
  };
}

export function elementTargetFromXpath(xpath: string, iframeXpath?: string | null): ElementTarget {
  const target: ElementTarget = {
    locators: [{ kind: "xpath", value: xpath.trim() }],
  };
  if (iframeXpath?.trim()) {
    target.iframe = {
      locators: [{ kind: "xpath", value: iframeXpath.trim() }],
    };
  }
  return target;
}
