import type {
  WorkflowDetail,
  WorkflowGraph,
  WorkflowSummary,
  RunValidationIssue,
  WorkflowRunSnapshot,
  WorkflowDeleteOptions,
  CompiledWorkflowGraph,
  ActionConfig,
  BatchRunRequest,
  GraphValidationIssue,
  ProfileEnvironment,
} from "../../../../src/types/workflow.js";
import { commandError } from "../../commandHelpers.js";
import type { WorkflowCommandsDeps } from "../types.js";
import { migrateWorkflowGraph } from "../../graph/migration.js";
import {
  compileWorkflowGraphFromNode,
  compileWorkflowRunPlan,
  compileWorkflowGraph as compileGraph,
  validateActionConfig,
  validateWorkflowGraph as validateGraph,
} from "../../graph/compiler.js";
import { browserProfileKey } from "../../shared/browserProfileKey.js";
import { runBatchWorkflowRows } from "../../runtime/batchWorkflowRun.js";
import {
  listRevisions,
  getRevision,
  restoreRevision,
  tagRevision,
  untagRevision,
  deleteRevision,
} from "./revisionRepository.js";

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

export function createWorkflowCommands(deps: WorkflowCommandsDeps) {
  const {
    repository,
    settingsService,
    runManager,
    runner,
    requireWorkflow,
    getSettings,
    saveSettings,
    createWorkflow,
    getWorkflowGraph,
    activeRunConflict,
    assertWorkflowDeletionAllowed,
    graphContextForWorkflow,
  } = deps;

  async function validateWorkflowRun(workflowId: string): Promise<RunValidationIssue[]> {
    const workflow = await requireWorkflow(workflowId);
    const graph = await getWorkflowGraph(workflowId);
    const settings = await getSettings(workflowId);
    return [
      ...validateGraph(graph, await graphContextForWorkflow(workflow, graph)).map((issue) => ({
        source: "graph" as const,
        field: null,
        node_id: issue.node_id ?? null,
        edge_id: issue.edge_id ?? null,
        message: issue.message,
        level: issue.level,
      })),
      ...settingsService.validateSettings(settings).map((issue: any) => ({
        source: "settings" as const,
        field: issue.field ?? null,
        node_id: null,
        edge_id: null,
        message: issue.message,
        level: issue.level,
      })),
    ];
  }

  async function startWorkflowRun(
    workflowId: string,
    source: "manual" | "schedule" = "manual",
  ): Promise<WorkflowRunSnapshot> {
    const workflow = await requireWorkflow(workflowId);
    const settings = await getSettings(workflowId);
    const conflict = activeRunConflict(workflowId, settings);
    if (conflict) {
      throw commandError(conflict.message, conflict.field);
    }
    const graph = await getWorkflowGraph(workflowId);
    const runIssues = await validateWorkflowRun(workflowId);
    const firstError = runIssues.find((issue) => issue.level === "error");
    if (firstError) {
      if (source === "manual") {
        await deps.operationsRepository.recordLaunchBlocked({ workflow, issues: runIssues });
      }
      throw commandError(firstError.message, firstError.field ?? firstError.node_id ?? "workflowId");
    }
    const graphContext = await graphContextForWorkflow(workflow, graph);
    if (compileGraph(graph, graphContext).steps.length === 0) {
      throw commandError("Workflow graph has no executable steps", "graph");
    }

    let profileEnvironment: ProfileEnvironment | undefined;
    if (workflow.browser_profile_id) {
      const profile = await repository.getBrowserProfile(workflow.browser_profile_id);
      if (profile) {
        profileEnvironment = profile.environment;
      }
    }

    const compiledGraph = compileWorkflowRunPlan(graph, settings, {
      ...graphContext,
      profileEnvironment,
    });
    return await runManager.startWorkflowRun({
      workflow,
      source,
      settings,
      graphSnapshot: graph,
      compiledGraph,
    });
  }



  return {
    async listWorkflows(): Promise<WorkflowSummary[]> {
      return repository.listWorkflows();
    },

    async getWorkflow(id: string): Promise<WorkflowDetail | null> {
      return repository.getWorkflow(id);
    },

    async validateWorkflowRun(workflowId: string): Promise<RunValidationIssue[]> {
      return validateWorkflowRun(workflowId);
    },

    createWorkflow,

    async renameWorkflow(id: string, name: string) {
      const normalized = name.trim();
      if (!normalized) {
        throw commandError("Workflow name is required", "name");
      }
      await requireWorkflow(id);
      await repository.renameWorkflow(id, normalized);
    },

    async deleteWorkflow(id: string, _options: WorkflowDeleteOptions = {}) {
      const settings = await getSettings(id);
      await assertWorkflowDeletionAllowed(id, settings);
      await repository.deleteWorkflow(id);
    },

    async duplicateWorkflow(workflowId: string, name: string): Promise<WorkflowDetail> {
      const sourceWorkflow = await requireWorkflow(workflowId);
      return deps.context.database.transaction(async () => {
        let created = await createWorkflow(name, {
          project_id: sourceWorkflow.project_id,
        });
        if (sourceWorkflow.browser_profile_id) {
          created = await repository.assignWorkflowBrowserProfile(
            created.id,
            sourceWorkflow.browser_profile_id,
          ) ?? created;
        }
        const graph = await repository.getWorkflowGraph(workflowId);
        if (graph) await repository.saveWorkflowGraph(created.id, graph);
        const settings = await getSettings(workflowId);
        if (settings) {
          await saveSettings(created.id, {
            ...settingsService.duplicateWorkflowSettings(settings, created),
            browser_launch: (await getSettings(created.id)).browser_launch,
          });
        }
        return { workflow: created, steps: [] };
      });
    },

    getWorkflowGraph(workflowId: string): Promise<WorkflowGraph> {
      return getWorkflowGraph(workflowId);
    },

    async saveWorkflowGraph(
      workflowId: string,
      graph: WorkflowGraph,
      options?: { comment?: string; tag?: string; skipRevision?: boolean },
    ) {
      await requireWorkflow(workflowId);
      const migrated = migrateWorkflowGraph(graph);
      assertNoUnsupportedGraphDiscriminants(migrated);
      await repository.saveWorkflowGraph(workflowId, migrated, options);
    },

    validateWorkflowGraph(graph: WorkflowGraph): GraphValidationIssue[] {
      return validateGraph(migrateWorkflowGraph(graph));
    },

    compileWorkflowGraph(graph: WorkflowGraph): CompiledWorkflowGraph {
      return compileGraph(migrateWorkflowGraph(graph));
    },

    async runWorkflow(workflowId: string): Promise<WorkflowRunSnapshot> {
      return startWorkflowRun(workflowId, "manual");
    },

    async runWorkflowFromNode(
      workflowId: string,
      startNodeId: string,
      mode?: "selected_only" | "from_selected",
    ): Promise<WorkflowRunSnapshot> {
      const workflow = await requireWorkflow(workflowId);
      const settings = await getSettings(workflowId);
      const conflict = activeRunConflict(workflowId, settings);
      if (conflict) {
        throw commandError(conflict.message, conflict.field);
      }
      const profileKey = browserProfileKey(settings);
      if (settings.browser_launch.session_mode !== "persistent_profile" || !profileKey) {
        throw commandError(
          "Run from selected requires a persistent browser profile",
          "browser_launch.session_mode",
        );
      }
      if (settings.run_policy.browser_retention !== "retain") {
        throw commandError(
          "Run from selected requires browser retention to be set to retain",
          "run_policy.browser_retention",
        );
      }
      if (!runner.hasReusableRetainedSession?.(workflowId, profileKey)) {
        const retained_session = runner.getRetainedSessionState?.(workflowId, profileKey) ?? {
          available: false,
          workflow_id: null,
          profile_name: null,
          reason: "No retained browser session",
        };
        runManager.updateLatestRetainedSession(retained_session);
        throw commandError(
          "No reusable browser session is available. Run the workflow again to create one.",
          "run",
        );
      }

      const runMode = mode ?? settings.run_policy.run_from_selected_mode;
      if (mode && mode !== settings.run_policy.run_from_selected_mode) {
        settings.run_policy.run_from_selected_mode = mode;
        await saveSettings(workflowId, settings);
      }

      let profileEnvironment: ProfileEnvironment | undefined;
      if (workflow.browser_profile_id) {
        const profile = await repository.getBrowserProfile(workflow.browser_profile_id);
        if (profile) {
          profileEnvironment = profile.environment;
        }
      }

      const graph = await getWorkflowGraph(workflowId);
      const compiledGraph = compileWorkflowGraphFromNode(graph, startNodeId, {
        ...(await graphContextForWorkflow(workflow, graph)),
        mode: runMode,
        settings,
        profileEnvironment,
      });
      if (compiledGraph.steps.length === 0) {
        throw commandError("Selected graph node has no executable steps", "startNodeId");
      }

      return await runManager.startWorkflowRun({
        workflow,
        source: "manual",
        settings,
        graphSnapshot: graph,
        compiledGraph,
        targetStepId: startNodeId,
        reuseRetainedSession: true,
        retainedSessionWorkflowId: workflowId,
      });
    },

    async stopRun(runId?: string | null): Promise<WorkflowRunSnapshot> {
      return runManager.stopRun({ runId, fallbackWorkflow: (await repository.listWorkflows())[0] ?? null });
    },

    getRunState() {
      return runManager.getRunState();
    },

    listRunStates(): WorkflowRunSnapshot[] {
      return runManager.listRunStates();
    },

    async runBatchWorkflow(
      workflowId: string,
      request: BatchRunRequest,
    ) {
      const workflow = await requireWorkflow(workflowId);
      if (runManager.hasActiveBatchRun() || runManager.hasActiveWorkflowRuns()) {
        throw commandError("A workflow run is already active", "run");
      }
      const settings = await getSettings(workflowId);
      const concurrencyLimit =
        request.concurrency_limit ?? settings.run_policy.batch_concurrency_limit ?? 1;
      if (concurrencyLimit > 1) {
        throw commandError(
          "Batch concurrency above 1 is not supported until row isolation is implemented",
          "concurrency_limit",
        );
      }
      const graph = await getWorkflowGraph(workflowId);
      const graphContext = await graphContextForWorkflow(workflow, graph);
      if (compileGraph(graph, graphContext).steps.length === 0) {
        throw commandError("Workflow graph has no executable steps", "graph");
      }
      let profileEnvironment: ProfileEnvironment | undefined;
      if (workflow.browser_profile_id) {
        const profile = await repository.getBrowserProfile(workflow.browser_profile_id);
        if (profile) {
          profileEnvironment = profile.environment;
        }
      }
      const compiledGraph = compileWorkflowRunPlan(graph, settings, {
        ...graphContext,
        profileEnvironment,
      });
      return await runBatchWorkflowRows({
        workflowId,
        request,
        settings,
        graphSnapshot: graph,
        compiledGraph,
        runner,
        runManager,
      });
    },

    dryRunValidateConfig(config: ActionConfig) {
      const validation = validateActionConfig(config);
      if (validation) throw commandError(validation.message, validation.field);
    },

    async listWorkflowRevisions(workflowId: string, options?: { limit?: number; offset?: number; onlyBackups?: boolean }) {
      await requireWorkflow(workflowId);
      return listRevisions(deps.context.database, "workflow", workflowId, options ?? {});
    },

    async getWorkflowRevision(revisionId: string) {
      return getRevision(deps.context.database, "workflow", revisionId);
    },

    async restoreWorkflowRevision(workflowId: string, revisionId: string, options?: { comment?: string }) {
      await requireWorkflow(workflowId);
      return restoreRevision(deps.context.database, "workflow", workflowId, revisionId, options ?? {});
    },

    async tagWorkflowRevision(revisionId: string, tag: string) {
      await tagRevision(deps.context.database, "workflow", revisionId, tag);
    },

    async untagWorkflowRevision(revisionId: string) {
      await untagRevision(deps.context.database, "workflow", revisionId);
    },

    async deleteWorkflowRevision(revisionId: string) {
      await deleteRevision(deps.context.database, "workflow", revisionId);
    },

    async listSubflowRevisions(subflowId: string, options?: { limit?: number; offset?: number; onlyBackups?: boolean }) {
      const exists = await deps.context.database.queryOne("SELECT id FROM subflows WHERE id = $1", [subflowId]);
      if (!exists) {
        throw commandError("Subflow not found", "subflowId");
      }
      return listRevisions(deps.context.database, "subflow", subflowId, options ?? {});
    },

    async getSubflowRevision(revisionId: string) {
      return getRevision(deps.context.database, "subflow", revisionId);
    },

    async restoreSubflowRevision(subflowId: string, revisionId: string, options?: { comment?: string }) {
      const exists = await deps.context.database.queryOne("SELECT id FROM subflows WHERE id = $1", [subflowId]);
      if (!exists) {
        throw commandError("Subflow not found", "subflowId");
      }
      return restoreRevision(deps.context.database, "subflow", subflowId, revisionId, options ?? {});
    },

    async tagSubflowRevision(revisionId: string, tag: string) {
      await tagRevision(deps.context.database, "subflow", revisionId, tag);
    },

    async untagSubflowRevision(revisionId: string) {
      await untagRevision(deps.context.database, "subflow", revisionId);
    },

    async deleteSubflowRevision(revisionId: string) {
      await deleteRevision(deps.context.database, "subflow", revisionId);
    },
    
    // We expose startWorkflowRun as a helper for other domains (e.g., schedules) if needed
    _startWorkflowRun: startWorkflowRun,
    _validateWorkflowRun: validateWorkflowRun,
  };
}
