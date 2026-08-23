import { migrateWorkflowGraph } from "../graph/migration.js";
import { commandError, createDraftGraph } from "../commandHelpers.js";
import type {
  WorkflowGraph,
  WorkflowSummary,
} from "../../../src/types/workflow.js";

import type { WorkflowRepository } from "./workflows/workflowRepository.js";

export type GraphHelpers = {
  callSubflowIds: (graph: WorkflowGraph) => string[];
  remapCallSubflowIds: (
    graph: WorkflowGraph,
    subflowIdMap: Map<string, string>,
  ) => WorkflowGraph;
  graphContextForWorkflow: (
    workflow: WorkflowSummary,
    graph?: WorkflowGraph,
  ) => Promise<{
    projectId: string | null;
    workflowLabel: string;
    resolveSubflow: (subflowId: string) => any;
  }>;
  referencedSubflowsForWorkflowGraph: (
    workflow: WorkflowSummary,
    graph: WorkflowGraph,
  ) => Promise<any[]>;
  getWorkflowGraph: (workflowId: string) => Promise<WorkflowGraph>;
};

function callSubflowIds(graph: WorkflowGraph): string[] {
  return [
    ...new Set(
      graph.nodes
        .filter((node) => node.node_type === "call_subflow")
        .map((node) => (node.config as { subflow_id?: unknown }).subflow_id)
        .filter((subflowId): subflowId is string =>
          typeof subflowId === "string" && subflowId.trim().length > 0
        ),
    ),
  ];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function createGraphHelpers(deps: {
  repository: WorkflowRepository;
  requireWorkflow: (workflowId: string) => Promise<WorkflowSummary>;
}): GraphHelpers {
  const { repository, requireWorkflow } = deps;
  async function graphContextForWorkflow(workflow: WorkflowSummary, graph?: WorkflowGraph) {
    const subflowMap = new Map<string, any>();
    if (graph) {
      const subflowIds = callSubflowIds(graph);
      await Promise.all(
        subflowIds.map(async (subflowId) => {
          const subflow = await repository.getSubflow(subflowId);
          if (subflow) {
            subflowMap.set(subflowId, {
              id: subflow.id,
              project_id: subflow.project_id,
              name: subflow.name,
              graph: migrateWorkflowGraph(subflow.graph),
            });
          }
        })
      );
    }

    return {
      projectId: workflow.project_id ?? null,
      workflowLabel: workflow.name,
      resolveSubflow(subflowId: string) {
        return subflowMap.get(subflowId) ?? null;
      },
    };
  }

  async function referencedSubflowsForWorkflowGraph(
    workflow: WorkflowSummary,
    graph: WorkflowGraph,
  ): Promise<any[]> {
    const projectId = workflow.project_id;
    if (!projectId) return [];
    const referencedIds = callSubflowIds(graph);
    const subflows = [];
    for (const subflowId of referencedIds) {
      const subflow = await repository.getSubflow(subflowId);
      if (!subflow) {
        throw commandError("Workflow references a missing subflow", "workflow.graph");
      }
      if (subflow.project_id !== projectId) {
        throw commandError(
          "Workflow references a subflow outside its project",
          "workflow.graph",
        );
      }
      subflows.push(subflow);
    }
    return subflows;
  }

  function remapCallSubflowIds(
    graph: WorkflowGraph,
    subflowIdMap: Map<string, string>,
  ): WorkflowGraph {
    return {
      ...graph,
      nodes: graph.nodes.map((node) => {
        if (node.node_type !== "call_subflow") return node;
        const config = node.config as { subflow_id?: unknown };
        const nextSubflowId =
          typeof config.subflow_id === "string"
            ? subflowIdMap.get(config.subflow_id) ?? config.subflow_id
            : config.subflow_id;
        return {
          ...node,
          config: {
            ...asRecord(node.config),
            subflow_id: nextSubflowId,
          },
        };
      }),
    };
  }

  async function getWorkflowGraph(workflowId: string): Promise<WorkflowGraph> {
    const graph = await repository.getWorkflowGraph(workflowId);
    if (!graph) {
      await requireWorkflow(workflowId);
      return createDraftGraph();
    }
    const migrated = migrateWorkflowGraph(graph);
    if (JSON.stringify(migrated) !== JSON.stringify(graph)) {
      await repository.saveWorkflowGraph(workflowId, migrated);
    }
    return migrated;
  }

  return {
    callSubflowIds,
    remapCallSubflowIds,
    graphContextForWorkflow,
    referencedSubflowsForWorkflowGraph,
    getWorkflowGraph,
  };
}

