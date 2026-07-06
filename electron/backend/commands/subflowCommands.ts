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
    async createSubflow(
      projectId: string,
      input: { name: string; description?: string | null },
    ): Promise<Subflow> {
      await requireProject(projectId);
      const name = input.name.trim();
      if (!name) throw commandError("Subflow name is required", "name");
      return await repository.createSubflow(
        projectId,
        name,
        input.description?.trim() ?? "",
        createDraftGraph(),
      );
    },

    async listSubflows(projectId: string): Promise<SubflowSummary[]> {
      await requireProject(projectId);
      return await repository.listSubflows(projectId);
    },

    async getSubflow(subflowId: string): Promise<Subflow> {
      const subflow = await repository.getSubflow(subflowId);
      if (!subflow) throw commandError("Subflow not found", "subflowId");
      return subflow;
    },

    async updateSubflow(
      subflowId: string,
      input: { name?: string; description?: string | null },
    ): Promise<Subflow> {
      const patch: { name?: string; description?: string | null } = {};
      if (input.name !== undefined) {
        const name = input.name.trim();
        if (!name) throw commandError("Subflow name is required", "name");
        patch.name = name;
      }
      if (input.description !== undefined) {
        patch.description = input.description?.trim() ?? "";
      }
      const updated = await repository.updateSubflow(subflowId, patch);
      if (!updated) throw commandError("Subflow not found", "subflowId");
      return updated;
    },

    async getSubflowGraph(subflowId: string): Promise<WorkflowGraph> {
      const graph = await repository.getSubflowGraph(subflowId);
      if (!graph) throw commandError("Subflow not found", "subflowId");
      return migrateWorkflowGraph(graph);
    },

    async saveSubflowGraph(
      subflowId: string,
      graph: WorkflowGraph,
      options?: { comment?: string; tag?: string; skipRevision?: boolean },
    ) {
      const subflow = await repository.getSubflow(subflowId);
      if (!subflow) throw commandError("Subflow not found", "subflowId");
      const migrated = migrateWorkflowGraph(graph);
      const nestedCall = migrated.nodes.find((node) => node.node_type === "call_subflow");
      if (nestedCall) {
        throw commandError("Subflows cannot call subflows in the MVP", nestedCall.id);
      }
      assertNoUnsupportedGraphDiscriminants(migrated);
      await repository.saveSubflowGraph(subflowId, migrated, options);
    },

    async duplicateSubflow(subflowId: string, name: string): Promise<Subflow> {
      const normalized = name.trim();
      if (!normalized) throw commandError("Subflow name is required", "name");
      const duplicate = await repository.duplicateSubflow(subflowId, normalized);
      if (!duplicate) throw commandError("Subflow not found", "subflowId");
      return duplicate;
    },

    async deleteSubflow(subflowId: string) {
      const usage = await repository.getSubflowUsage(subflowId);
      if (usage.length > 0) {
        throw commandError(`Subflow is used by ${usage.length} workflow${usage.length === 1 ? "" : "s"}`, "subflowId");
      }
      await repository.deleteSubflow(subflowId);
    },

    async getSubflowUsage(subflowId: string): Promise<SubflowUsage[]> {
      if (!(await repository.getSubflow(subflowId))) {
        throw commandError("Subflow not found", "subflowId");
      }
      return await repository.getSubflowUsage(subflowId);
    },

    async exportSubflow(subflowId: string): Promise<SubflowExport> {
      const subflow = await repository.getSubflow(subflowId);
      if (!subflow) throw commandError("Subflow not found", "subflowId");
      return {
        version: 1,
        subflow: {
          name: subflow.name,
          description: subflow.description,
          graph: (await repository.getSubflowGraph(subflow.id)) || createDraftGraph(),
        },
      };
    },

    async importSubflow(projectId: string, exported: SubflowExport): Promise<Subflow> {
      await requireProject(projectId);
      if (!exported || exported.version !== 1 || !exported.subflow || !exported.subflow.name) {
        throw commandError("Invalid subflow package file", "exported");
      }
      const name = exported.subflow.name.trim();
      if (!name) throw commandError("Subflow name is required", "name");
      const description = exported.subflow.description?.trim() ?? "";
      const graph = migrateWorkflowGraph(exported.subflow.graph);
      return await repository.createSubflow(projectId, name, description, graph);
    },

    async saveSubflowPackageFile(packageValue: SubflowExport) {
      if (!deps.context.saveSubflowPackageFile) {
        throw commandError("Subflow package file saving is not available");
      }
      return deps.context.saveSubflowPackageFile(packageValue);
    },
  };
}
