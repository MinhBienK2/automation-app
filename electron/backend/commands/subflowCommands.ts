import type {
  Subflow,
  SubflowSummary,
  SubflowUsage,
  WorkflowGraph,
  SubflowExport,
} from "../../../src/types/workflow.js";
import { commandError, createDraftGraph } from "../commandHelpers.js";
import type { CommandDeps } from "./types.js";
import { migrateWorkflowGraph } from "../graph/migration.js";
import { validateWorkflowGraph as validateGraph } from "../graph/compiler.js";

function isUnsupportedGraphDiscriminantMessage(message: string) {
  return (
    message.startsWith("Unsupported graph node type: ") ||
    message.startsWith("Unsupported condition kind: ") ||
    message.includes("Unsupported action type: ")
  );
}

function assertNoUnsupportedGraphDiscriminants(graph: WorkflowGraph) {
  const issue = validateGraph(graph).find(
    (candidate) =>
      candidate.level === "error" &&
      isUnsupportedGraphDiscriminantMessage(candidate.message),
  );
  if (!issue) return;
  throw commandError(issue.message, "workflow.graph");
}

export function createSubflowCommands(deps: CommandDeps) {
  const {
    repository,
    requireProject,
  } = deps;

  return {
    createSubflow(
      projectId: string,
      input: { name: string; description?: string | null },
    ): Subflow {
      requireProject(projectId);
      const name = input.name.trim();
      if (!name) throw commandError("Subflow name is required", "name");
      return repository.createSubflow(
        projectId,
        name,
        input.description?.trim() ?? "",
        createDraftGraph(),
      );
    },

    listSubflows(projectId: string): SubflowSummary[] {
      requireProject(projectId);
      return repository.listSubflows(projectId);
    },

    getSubflow(subflowId: string): Subflow {
      const subflow = repository.getSubflow(subflowId);
      if (!subflow) throw commandError("Subflow not found", "subflowId");
      return subflow;
    },

    updateSubflow(
      subflowId: string,
      input: { name?: string; description?: string | null },
    ): Subflow {
      const patch: { name?: string; description?: string | null } = {};
      if (input.name !== undefined) {
        const name = input.name.trim();
        if (!name) throw commandError("Subflow name is required", "name");
        patch.name = name;
      }
      if (input.description !== undefined) {
        patch.description = input.description?.trim() ?? "";
      }
      const updated = repository.updateSubflow(subflowId, patch);
      if (!updated) throw commandError("Subflow not found", "subflowId");
      return updated;
    },

    getSubflowGraph(subflowId: string): WorkflowGraph {
      const graph = repository.getSubflowGraph(subflowId);
      if (!graph) throw commandError("Subflow not found", "subflowId");
      return migrateWorkflowGraph(graph);
    },

    saveSubflowGraph(subflowId: string, graph: WorkflowGraph) {
      const subflow = repository.getSubflow(subflowId);
      if (!subflow) throw commandError("Subflow not found", "subflowId");
      const migrated = migrateWorkflowGraph(graph);
      const nestedCall = migrated.nodes.find((node) => node.node_type === "call_subflow");
      if (nestedCall) {
        throw commandError("Subflows cannot call subflows in the MVP", nestedCall.id);
      }
      assertNoUnsupportedGraphDiscriminants(migrated);
      repository.saveSubflowGraph(subflowId, migrated);
    },

    duplicateSubflow(subflowId: string, name: string): Subflow {
      const normalized = name.trim();
      if (!normalized) throw commandError("Subflow name is required", "name");
      const duplicate = repository.duplicateSubflow(subflowId, normalized);
      if (!duplicate) throw commandError("Subflow not found", "subflowId");
      return duplicate;
    },

    deleteSubflow(subflowId: string) {
      const usage = repository.getSubflowUsage(subflowId);
      if (usage.length > 0) {
        throw commandError(`Subflow is used by ${usage.length} workflow${usage.length === 1 ? "" : "s"}`, "subflowId");
      }
      repository.deleteSubflow(subflowId);
    },

    getSubflowUsage(subflowId: string): SubflowUsage[] {
      if (!repository.getSubflow(subflowId)) {
        throw commandError("Subflow not found", "subflowId");
      }
      return repository.getSubflowUsage(subflowId);
    },

    exportSubflow(subflowId: string): SubflowExport {
      const subflow = repository.getSubflow(subflowId);
      if (!subflow) throw commandError("Subflow not found", "subflowId");
      return {
        version: 1,
        subflow: {
          name: subflow.name,
          description: subflow.description,
          graph: repository.getSubflowGraph(subflow.id) || createDraftGraph(),
        },
      };
    },

    importSubflow(projectId: string, exported: SubflowExport): Subflow {
      requireProject(projectId);
      if (!exported || exported.version !== 1 || !exported.subflow || !exported.subflow.name) {
        throw commandError("Invalid subflow package file", "exported");
      }
      const name = exported.subflow.name.trim();
      if (!name) throw commandError("Subflow name is required", "name");
      const description = exported.subflow.description?.trim() ?? "";
      const graph = migrateWorkflowGraph(exported.subflow.graph);
      return repository.createSubflow(projectId, name, description, graph);
    },

    async saveSubflowPackageFile(packageValue: SubflowExport) {
      if (!deps.context.saveSubflowPackageFile) {
        throw commandError("Subflow package file saving is not available");
      }
      return deps.context.saveSubflowPackageFile(packageValue);
    },
  };
}
